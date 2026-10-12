"""
Public config endpoint — serves dropdown options to frontend without admin auth.
Reads from SystemSetting DB, falls back to sensible defaults.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.setting import SystemSetting

router = APIRouter(prefix="/api/config", tags=["Config"])


@router.get("/sheets-status")
def get_sheets_sync_status(current_user=Depends(require_business_development)):
    """Whether Google Sheets CRM sync is configured, and the sheet's link if so."""
    from app.services.google_sheets_service import is_configured, get_spreadsheet_url
    return {
        "configured": is_configured(),
        "spreadsheet_url": get_spreadsheet_url() if is_configured() else None,
    }

# Universal defaults — no healthcare hardcoding
DEFAULT_ORG_TYPES = [
    "SaaS Company", "Software Company", "Technology Company", "AI Company",
    "Fintech Company", "Financial Services", "Healthcare Company", "Hospital",
    "Hospital Group", "Healthcare Technology Company", "Manufacturing",
    "Industrial", "Energy", "Logistics", "Retail", "E-commerce", "Consulting",
    "Insurance Company", "NGO", "Other",
]

DEFAULT_CONNECTION_STATUSES = [
    "New", "Contacted", "Responded", "Meeting", "Demo", "Discussion",
    "Proposal", "Negotiation", "Partnership", "Customer",
]

DEFAULT_PARTNERSHIP_TYPES = [
    "Technology Partnership", "Business Partnership", "Strategic Partnership",
    "Integration Partnership", "Service Partnership", "Distribution Partnership",
    "Referral Partnership", "Other",
]

DEFAULT_MEETING_TYPES = [
    "Business Discussion", "Project Showcase", "Partnership Discussion",
    "Introduction", "Technical Discussion", "Follow-up", "Other",
]

DEFAULT_MEETING_STATUSES = ["Scheduled", "Completed", "Rescheduled", "Cancelled"]

DEFAULT_PRIORITY_LEVELS = ["High", "Medium", "Low"]

DEFAULT_CHANNELS = ["Email", "Phone", "LinkedIn", "WhatsApp", "Meeting", "Video Call", "In Person", "Other"]

DEFAULT_PARTNERSHIP_STATUSES = ["Active", "On Hold", "Completed", "Ended"]

DEFAULT_PROJECT_CATEGORIES = [
    "AI Platform", "Cloud Solution", "Cybersecurity", "Data Analytics",
    "Digital Transformation", "Healthcare Tech", "FinTech", "EdTech",
    "SaaS Platform", "IoT", "Other",
]

DEFAULT_SHOWCASE_CATEGORIES = [
    "Artificial Intelligence", "Communication", "Automation", "Data Science",
    "Business", "Cloud Platform", "Cybersecurity", "IoT", "Other",
]

DEFAULT_DIRECTIONS = ["Outgoing", "Incoming"]

DEFAULT_COMMUNICATION_STATUSES = ["Completed", "Pending", "Cancelled"]

DEFAULT_OUTREACH_STAGES = ["Contacted", "Connected", "Interested", "Active Discussion"]

DEFAULT_FOLLOWUP_DURATIONS = ["1", "3", "5", "7"]

DEFAULT_ROLES = [
    "CEO", "CTO", "CDO", "CIO", "CFO", "COO",
    "VP of Sales", "VP of Engineering", "VP of Marketing",
    "Head of Business Development", "Head of Partnerships",
    "Head of Innovation", "Director of Operations",
    "Other",
]

DEFAULT_INDUSTRY_TYPES = [
    "Technology", "Healthcare", "Manufacturing", "Financial Services",
    "Retail", "Energy", "Logistics", "Education", "Real Estate",
    "Media", "Telecommunications", "Agriculture", "Government", "Other",
]


class ConfigResponse(BaseModel):
    organization_types: List[str]
    connection_statuses: List[str]
    partnership_types: List[str]
    partnership_statuses: List[str]
    meeting_types: List[str]
    meeting_statuses: List[str]
    priority_levels: List[str]
    channels: List[str]
    project_categories: List[str]
    showcase_categories: List[str]
    directions: List[str]
    communication_statuses: List[str]
    outreach_stages: List[str]
    followup_durations: List[str]
    roles: List[str]
    industry_types: List[str]


def _get_setting(db: Session, key: str, default: list) -> list:
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    return setting.value_json if setting and setting.value_json else default


@router.get("/dropdowns", response_model=ConfigResponse)
def get_dropdown_config(db: Session = Depends(get_db)):
    """Public endpoint — all dropdown options in one call."""
    return ConfigResponse(
        organization_types=_get_setting(db, "organization_types", DEFAULT_ORG_TYPES),
        connection_statuses=DEFAULT_CONNECTION_STATUSES,
        partnership_types=_get_setting(db, "partnership_types", DEFAULT_PARTNERSHIP_TYPES),
        partnership_statuses=DEFAULT_PARTNERSHIP_STATUSES,
        meeting_types=_get_setting(db, "meeting_types", DEFAULT_MEETING_TYPES),
        meeting_statuses=DEFAULT_MEETING_STATUSES,
        priority_levels=DEFAULT_PRIORITY_LEVELS,
        channels=DEFAULT_CHANNELS,
        project_categories=_get_setting(db, "project_categories", DEFAULT_PROJECT_CATEGORIES),
        showcase_categories=DEFAULT_SHOWCASE_CATEGORIES,
        directions=DEFAULT_DIRECTIONS,
        communication_statuses=DEFAULT_COMMUNICATION_STATUSES,
        outreach_stages=DEFAULT_OUTREACH_STAGES,
        followup_durations=DEFAULT_FOLLOWUP_DURATIONS,
        roles=DEFAULT_ROLES,
        industry_types=DEFAULT_INDUSTRY_TYPES,
    )
