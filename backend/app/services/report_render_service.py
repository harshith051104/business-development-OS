import json
import logging

from app.services.copilot.engine import _get_llm_router
from app.services.copilot.llm_router import AllProvidersExhausted
from app.services.report_agent_service import ReportData

logger = logging.getLogger("elly.bd_portal")

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
