"""Template engine — renders {{placeholders}} with actual entity data.

Supported placeholders:
  Contact:    {{contact_name}}, {{contact_first_name}}, {{contact_last_name}},
              {{contact_email}}, {{contact_phone}}, {{contact_designation}},
              {{contact_department}}, {{contact_linkedin}}
  Org:        {{organization_name}}, {{org_name}}, {{org_industry}}, {{org_city}},
              {{org_state}}, {{org_country}}, {{org_type}}, {{org_website}},
              {{org_phone}}, {{org_email}}, {{org_size}}
  Project:    {{project_name}}, {{project_description}}, {{project_category}}
  Opportunity:{{opportunity_name}}, {{opportunity_stage}}, {{opportunity_value}}
  Sender:     {{sender_name}}, {{sender_email}}, {{sender_company}}
  Meeting:    {{meeting_date}}, {{meeting_time}}, {{meeting_link}}
  Misc:       {{current_date}}, {{current_year}}
"""
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# All recognized placeholders
PLACEHOLDER_PATTERNS = re.compile(r"\{\{(\w+)\}\}")

PLACEHOLDER_MAP: Dict[str, str] = {
    # Contact
    "contact_name": "contact_name",
    "contact_first_name": "contact_first_name",
    "contact_last_name": "contact_last_name",
    "contact_email": "contact_email",
    "contact_phone": "contact_phone",
    "contact_designation": "contact_designation",
    "contact_department": "contact_department",
    "contact_linkedin": "contact_linkedin",
    # Organization
    "organization_name": "organization_name",
    "org_name": "organization_name",
    "org_industry": "org_industry",
    "org_city": "org_city",
    "org_state": "org_state",
    "org_country": "org_country",
    "org_type": "org_type",
    "org_website": "org_website",
    "org_phone": "org_phone",
    "org_email": "org_email",
    "org_size": "org_size",
    # Project
    "project_name": "project_name",
    "project_description": "project_description",
    "project_category": "project_category",
    # Opportunity
    "opportunity_name": "opportunity_name",
    "opportunity_stage": "opportunity_stage",
    "opportunity_value": "opportunity_value",
    # Sender
    "sender_name": "sender_name",
    "sender_email": "sender_email",
    "sender_company": "sender_company",
    # Meeting
    "meeting_date": "meeting_date",
    "meeting_time": "meeting_time",
    "meeting_link": "meeting_link",
    # Misc
    "current_date": "current_date",
    "current_year": "current_year",
}


def _build_context(
    contact: Optional[Any] = None,
    organization: Optional[Any] = None,
    project: Optional[Any] = None,
    opportunity: Optional[Any] = None,
    sender_name: str = "Business Development Team",
    sender_email: str = "",
    sender_company: str = "ELLY",
    meeting_date: str = "",
    meeting_time: str = "",
    meeting_link: str = "",
    extra: Optional[Dict[str, str]] = None,
) -> Dict[str, str]:
    """Build flat context dict from entity objects."""
    ctx: Dict[str, str] = {}

    # Defaults
    now = datetime.now(timezone.utc)
    ctx["current_date"] = now.strftime("%B %d, %Y")
    ctx["current_year"] = str(now.year)
    ctx["sender_name"] = sender_name
    ctx["sender_email"] = sender_email
    ctx["sender_company"] = sender_company
    ctx["meeting_date"] = meeting_date
    ctx["meeting_time"] = meeting_time
    ctx["meeting_link"] = meeting_link

    # Contact
    if contact:
        first = getattr(contact, "first_name", "") or ""
        last = getattr(contact, "last_name", "") or ""
        ctx["contact_first_name"] = first
        ctx["contact_last_name"] = last
        ctx["contact_name"] = f"{first} {last}".strip() or "[Contact Name]"
        ctx["contact_email"] = getattr(contact, "email", "") or ""
        ctx["contact_phone"] = getattr(contact, "phone", "") or ""
        ctx["contact_designation"] = getattr(contact, "designation", "") or ""
        ctx["contact_department"] = getattr(contact, "department", "") or ""
        ctx["contact_linkedin"] = getattr(contact, "linkedin_url", "") or ""

    # Organization
    if organization:
        ctx["organization_name"] = getattr(organization, "name", "") or "[Organization]"
        ctx["org_name"] = ctx["organization_name"]
        ctx["org_industry"] = getattr(organization, "industry", "") or ""
        ctx["org_city"] = getattr(organization, "city", "") or ""
        ctx["org_state"] = getattr(organization, "state", "") or ""
        ctx["org_country"] = getattr(organization, "country", "") or ""
        ctx["org_type"] = getattr(organization, "organization_type", "") or ""
        ctx["org_website"] = getattr(organization, "website", "") or ""
        ctx["org_phone"] = getattr(organization, "phone", "") or ""
        ctx["org_email"] = getattr(organization, "email", "") or ""
        ctx["org_size"] = getattr(organization, "size", "") or ""

    # Project
    if project:
        ctx["project_name"] = getattr(project, "name", "") or ""
        ctx["project_description"] = getattr(project, "description", "") or ""
        ctx["project_category"] = getattr(project, "category", "") or ""

    # Opportunity
    if opportunity:
        ctx["opportunity_name"] = getattr(opportunity, "name", "") or ""
        ctx["opportunity_stage"] = getattr(opportunity, "stage", "") or ""
        val = getattr(opportunity, "deal_value", None)
        ctx["opportunity_value"] = str(val) if val else ""

    # Extra overrides
    if extra:
        ctx.update(extra)

    return ctx


def render_template(
    text: str,
    contact: Optional[Any] = None,
    organization: Optional[Any] = None,
    project: Optional[Any] = None,
    opportunity: Optional[Any] = None,
    sender_name: str = "Business Development Team",
    sender_email: str = "",
    sender_company: str = "ELLY",
    meeting_date: str = "",
    meeting_time: str = "",
    meeting_link: str = "",
    extra: Optional[Dict[str, str]] = None,
) -> str:
    """Replace all {{placeholders}} in text with entity data.

    Unknown placeholders are left unchanged so user can see what's missing.
    """
    ctx = _build_context(
        contact=contact,
        organization=organization,
        project=project,
        opportunity=opportunity,
        sender_name=sender_name,
        sender_email=sender_email,
        sender_company=sender_company,
        meeting_date=meeting_date,
        meeting_time=meeting_time,
        meeting_link=meeting_link,
        extra=extra,
    )

    def _replace(match: re.Match) -> str:
        key = match.group(1)
        return ctx.get(key, match.group(0))  # Keep original if unknown

    return PLACEHOLDER_PATTERNS.sub(_replace, text)


def get_available_placeholders() -> Dict[str, list]:
    """Return categorized list of available placeholders for UI hints."""
    return {
        "contact": [
            "{{contact_name}}", "{{contact_first_name}}", "{{contact_last_name}}",
            "{{contact_email}}", "{{contact_phone}}", "{{contact_designation}}",
            "{{contact_department}}", "{{contact_linkedin}}",
        ],
        "organization": [
            "{{organization_name}}", "{{org_industry}}", "{{org_city}}",
            "{{org_state}}", "{{org_country}}", "{{org_type}}",
            "{{org_website}}", "{{org_phone}}", "{{org_email}}", "{{org_size}}",
        ],
        "project": ["{{project_name}}", "{{project_description}}", "{{project_category}}"],
        "opportunity": ["{{opportunity_name}}", "{{opportunity_stage}}", "{{opportunity_value}}"],
        "sender": ["{{sender_name}}", "{{sender_email}}", "{{sender_company}}"],
        "meeting": ["{{meeting_date}}", "{{meeting_time}}", "{{meeting_link}}"],
        "misc": ["{{current_date}}", "{{current_year}}"],
    }
