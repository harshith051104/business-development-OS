import json
import logging

from docx import Document
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

from app.services.copilot.engine import _get_llm_router
from app.services.copilot.llm_router import AllProvidersExhausted
from app.services.report_agent_service import ReportData

logger = logging.getLogger("elly.bd_portal")

NARRATIVE_SECTION_HEADINGS = (
    "Overview",
    "Team Highlights",
    "Per-Person Summary",
    "Watch Items",
)

TEAM_TABLE_HEADERS = (
    "Name",
    "Organizations",
    "Contacts",
    "Communications",
    "Meetings",
    "Opportunities",
    "Follow-ups",
)

REPORT_SYSTEM_PROMPT = (
    "You are writing an executive report for a CEO audience. Use plain "
    "business English only -- no technical, engineering, or database "
    "language, and never mention field names or table names. Structure "
    "the report as four short sections, each with its own heading: "
    "Overview, Team Highlights, Per-Person Summary, Watch Items. Keep it "
    "concise and readable."
)


def render_narrative(data: ReportData) -> str:
    try:
        router = _get_llm_router()
        response = router.chat(
            messages=[
                {"role": "system", "content": REPORT_SYSTEM_PROMPT},
                {"role": "user", "content": _serialize_report_data(data)},
            ],
            task_type="report_narrative",
        )
        return response.content
    except Exception as exc:
        logger.error("Report narrative LLM call failed, falling back to template: %s", exc)
        return _render_template_fallback(data)


def _serialize_report_data(data: ReportData) -> str:
    return json.dumps(
        {
            "period_start": data.period_start.isoformat() if data.period_start else None,
            "period_end": data.period_end.isoformat() if data.period_end else None,
            "team": [member.model_dump() for member in data.team],
            "task_stats": data.task_stats,
            "company_totals": data.company_totals,
        },
        default=str,
    )


def _render_template_fallback(data: ReportData) -> str:
    lines = ["Executive Report", ""]
    lines.append(f"Period: {data.period_start} to {data.period_end}")
    lines.append("")
    lines.append("Company Totals:")
    for key, value in data.company_totals.items():
        lines.append(f"  {key}: {value}")
    lines.append("")
    lines.append("Team Performance:")
    for member in data.team:
        lines.append(f"  {member.name}: {member.model_dump()}")
    return "\n".join(lines)


def _team_table_rows(data: ReportData) -> list:
    rows = [list(TEAM_TABLE_HEADERS)]
    for member in data.team:
        rows.append([
            member.name,
            member.organizations_added,
            member.contacts_added,
            member.communications_logged,
            member.meetings_completed,
            member.opportunities_managed,
            member.followups_completed,
        ])
    return rows


def render_docx(narrative: str, data: ReportData, path: str) -> None:
    document = Document()
    document.add_heading("Executive Report", level=0)
    document.add_paragraph(f"Period: {data.period_start} to {data.period_end}")

    for line in narrative.splitlines():
        stripped = line.strip().rstrip(":")
        if not stripped:
            continue
        if stripped in NARRATIVE_SECTION_HEADINGS:
            document.add_heading(stripped, level=1)
        else:
            document.add_paragraph(line)

    document.add_heading("Per-Person Metrics", level=1)
    rows = _team_table_rows(data)
    table = document.add_table(rows=len(rows), cols=len(TEAM_TABLE_HEADERS))
    table.style = "Light Grid Accent 1"
    for row_idx, row in enumerate(rows):
        for col_idx, value in enumerate(row):
            table.cell(row_idx, col_idx).text = str(value)

    document.save(path)


def render_pdf(narrative: str, data: ReportData, path: str) -> None:
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(path, pagesize=letter)
    flowables = [
        Paragraph("Executive Report", styles["Title"]),
        Paragraph(f"Period: {data.period_start} to {data.period_end}", styles["Normal"]),
        Spacer(1, 12),
    ]

    for line in narrative.splitlines():
        stripped = line.strip().rstrip(":")
        if not stripped:
            continue
        if stripped in NARRATIVE_SECTION_HEADINGS:
            flowables.append(Paragraph(stripped, styles["Heading1"]))
        else:
            flowables.append(Paragraph(line, styles["Normal"]))

    flowables.append(Spacer(1, 12))
    flowables.append(Paragraph("Per-Person Metrics", styles["Heading1"]))
    rows = _team_table_rows(data)
    table = Table(rows)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    flowables.append(table)

    doc.build(flowables)
