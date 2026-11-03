import json
import logging
import re
from xml.sax.saxutils import escape

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

NEXT_STEPS_SYSTEM_PROMPT = (
    "You are writing the 'Next Steps' section of an executive report for a "
    "CEO audience. Based on the team activity data provided (per-person "
    "metrics, task stats, company totals), write one bullet per team member, "
    "naming them, with the specific task(s) they should do next -- derived "
    "from their own metrics and task stats (e.g. overdue tasks to clear, "
    "activity types they logged zero of, follow-ups to complete). After the "
    "per-member bullets, add up to 2 short team-wide action items if "
    "warranted. Plain business English only. Output only a bullet list -- no "
    "heading, no preamble, no sign-off."
)


_HYPHEN_VARIANTS = str.maketrans({
    "‐": "-",  # hyphen
    "‑": "-",  # non-breaking hyphen (missing glyph in report fonts)
    "‒": "-",  # figure dash
})


def _sanitize_narrative(text: str) -> str:
    return text.translate(_HYPHEN_VARIANTS)


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
        return _sanitize_narrative(response.content)
    except Exception as exc:
        logger.error("Report narrative LLM call failed, falling back to template: %s", exc)
        return _render_template_fallback(data)


def render_next_steps(data: ReportData, user_next_steps: str = "") -> str:
    if user_next_steps.strip():
        return _sanitize_narrative(user_next_steps.strip())
    try:
        router = _get_llm_router()
        response = router.chat(
            messages=[
                {"role": "system", "content": NEXT_STEPS_SYSTEM_PROMPT},
                {"role": "user", "content": _serialize_report_data(data)},
            ],
            task_type="report_next_steps",
        )
        return _sanitize_narrative(response.content)
    except Exception as exc:
        logger.error("Next steps LLM call failed, falling back to template: %s", exc)
        return _next_steps_template_fallback(data)


def _next_steps_template_fallback(data: ReportData) -> str:
    lines = []
    for member in data.team:
        stats = data.task_stats.get(member.user_id, {})
        overdue = stats.get("overdue") or 0
        open_tasks = stats.get("open") or 0
        is_idle = not any([
            member.organizations_added, member.contacts_added, member.communications_logged,
            member.meetings_completed, member.opportunities_managed, member.followups_completed,
        ])

        tasks = []
        if overdue:
            tasks.append(f"clear {overdue} overdue task{'s' if overdue != 1 else ''}")
        elif open_tasks:
            tasks.append(f"work through {open_tasks} open task{'s' if open_tasks != 1 else ''}")
        if is_idle:
            tasks.append("log activity -- no organizations, contacts, communications, meetings, opportunities, or follow-ups recorded this period")
        else:
            if not member.followups_completed:
                tasks.append("complete outstanding follow-ups")
            if not member.communications_logged:
                tasks.append("log communications with contacts")

        if not tasks:
            tasks.append("maintain current pace")

        lines.append(f"- {member.name}: {'; '.join(tasks)}.")

    if not data.company_totals.get("followups_completed"):
        lines.append("- Team-wide: reinforce the follow-up process -- zero follow-ups were completed this period.")
    if not lines:
        lines.append("- Maintain current momentum and continue logging activity consistently.")
    return "\n".join(lines)


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


def _normalize_heading_text(line: str) -> str:
    stripped = line.strip()
    stripped = re.sub(r"^#{1,6}\s*", "", stripped)
    stripped = stripped.strip("*").strip()
    return stripped.rstrip(":")


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


def _add_markdown_bold_paragraph(document: Document, line: str) -> None:
    paragraph = document.add_paragraph()
    parts = re.split(r"\*\*(.+?)\*\*", line)
    for idx, part in enumerate(parts):
        if not part:
            continue
        run = paragraph.add_run(part)
        run.bold = bool(idx % 2)


def render_docx(narrative: str, data: ReportData, path: str, next_steps: str = "") -> None:
    document = Document()
    document.add_heading("Executive Report", level=0)
    document.add_paragraph(f"Period: {data.period_start} to {data.period_end}")

    for line in narrative.splitlines():
        normalized = _normalize_heading_text(line)
        if not normalized:
            continue
        if normalized in NARRATIVE_SECTION_HEADINGS:
            document.add_heading(normalized, level=1)
        else:
            _add_markdown_bold_paragraph(document, line)

    document.add_heading("Per-Person Metrics", level=1)
    rows = _team_table_rows(data)
    table = document.add_table(rows=len(rows), cols=len(TEAM_TABLE_HEADERS))
    table.style = "Light Grid Accent 1"
    for row_idx, row in enumerate(rows):
        for col_idx, value in enumerate(row):
            table.cell(row_idx, col_idx).text = str(value)

    if next_steps.strip():
        document.add_heading("Next Steps", level=1)
        for line in next_steps.splitlines():
            if line.strip():
                _add_markdown_bold_paragraph(document, line)

    document.save(path)


def _pdf_bold_paragraph(line: str, style) -> Paragraph:
    parts = line.split("**")
    escaped = "".join(
        escape(part) if idx % 2 == 0 else f"<b>{escape(part)}</b>"
        for idx, part in enumerate(parts)
    )
    return Paragraph(escaped, style)


def render_pdf(narrative: str, data: ReportData, path: str, next_steps: str = "") -> None:
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(path, pagesize=letter)
    flowables = [
        Paragraph("Executive Report", styles["Title"]),
        Paragraph(f"Period: {data.period_start} to {data.period_end}", styles["Normal"]),
        Spacer(1, 12),
    ]

    for line in narrative.splitlines():
        normalized = _normalize_heading_text(line)
        if not normalized:
            continue
        if normalized in NARRATIVE_SECTION_HEADINGS:
            flowables.append(Paragraph(escape(normalized), styles["Heading1"]))
        else:
            flowables.append(_pdf_bold_paragraph(line, styles["Normal"]))

    flowables.append(Spacer(1, 12))
    flowables.append(Paragraph("Per-Person Metrics", styles["Heading1"]))
    rows = _team_table_rows(data)
    table = Table(rows)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    flowables.append(table)

    if next_steps.strip():
        flowables.append(Spacer(1, 12))
        flowables.append(Paragraph("Next Steps", styles["Heading1"]))
        for line in next_steps.splitlines():
            if line.strip():
                flowables.append(_pdf_bold_paragraph(line, styles["Normal"]))

    doc.build(flowables)
