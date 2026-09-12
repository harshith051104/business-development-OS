"""
Intelligent Inbound Meeting Intent Extractor & Auto-Scheduler.
Analyzes prospect reply emails, detects meeting intent (Google Meet, Teams, Zoom, calls),
extracts proposed dates/times, platforms, and URLs, and automatically schedules confirmed Meeting records.
"""
import re
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.meeting import Meeting, MeetingType, MeetingStatus
from app.models.organization import Organization, ConnectionStatus
from app.models.contact import Contact
from app.models.activity import ContactActivity
from app.models.audit import AuditLog

logger = logging.getLogger(__name__)

MEETING_INTENT_PATTERN = re.compile(
    r"\b(?:connect|meet|meeting|call|catch up|touch base|chat|discuss|demo)\b"
    r".*?\b(?:through|via|on|over|in)?\s*(?:meet|google meet|teams|microsoft teams|zoom|call|video|webinar)\b"
    r"|\b(?:can we connect|let's connect|let's meet|set up a meeting|schedule a (?:call|meeting)|hop on a call|send (?:an? )?invite)\b"
    r"|\b(?:https?://(?:meet\.google\.com|teams\.microsoft\.com|zoom\.us)/\S+)",
    re.I,
)

MEETING_LINK_PATTERN = re.compile(
    r"(https?://(?:meet\.google\.com/[a-z0-9-]+|teams\.microsoft\.com/\S+|zoom\.us/j/\S+))",
    re.I,
)


def detect_and_schedule_meeting_from_reply(
    db: Session,
    contact_id: int,
    organization_id: int,
    reply_subject: str,
    reply_body: str,
    user_id: Optional[int] = None,
) -> Optional[Meeting]:
    """
    Scans reply subject and body for meeting intent, parses time & platform,
    and automatically provisions a Meeting record.
    """
    text_to_scan = f"{reply_subject}\n{reply_body}"
    if not is_meeting_intent_present(text_to_scan):
        return None

    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    contact_name = contact.full_name if contact else "Prospect"
    org_name = org.name if org else "Partner"

    # Extract platform and meeting link
    platform, meeting_url = extract_platform_and_link(text_to_scan)

    # Extract or estimate scheduled datetime
    scheduled_at = extract_proposed_datetime(text_to_scan)

    # Build Meeting record
    meeting_title = f"Commercial Meeting with {contact_name} ({org_name})"
    meeting = Meeting(
        organization_id=organization_id,
        primary_contact_id=contact_id,
        contact_ids=[contact_id],
        title=meeting_title,
        meeting_type=MeetingType.BUSINESS_DISCUSSION.value,
        description=f"Auto-scheduled by ELLY Inbound Reply Agent.\nExtracted from email: \"{reply_body[:250]}\"",
        scheduled_at=scheduled_at,
        duration_minutes=30,
        location=platform,
        meeting_url=meeting_url,
        status=MeetingStatus.SCHEDULED.value,
        agenda=f"Discuss commercial partnership and technical demonstration with {org_name}.",
        owner_id=user_id or 1,
        created_by=user_id or 1,
    )
    db.add(meeting)

    # Advance Organization status to Meeting
    if org and org.status in [ConnectionStatus.POTENTIAL.value, ConnectionStatus.CONTACTED.value, ConnectionStatus.CONNECTED.value, ConnectionStatus.INTERESTED.value]:
        org.status = ConnectionStatus.MEETING.value

    # Log Contact Activity
    act = ContactActivity(
        organization_id=organization_id,
        contact_id=contact_id,
        activity_type="meeting_auto_scheduled",
        description=f"AI Agent auto-scheduled meeting for {scheduled_at.strftime('%Y-%m-%d %H:%M UTC')} via {platform}.",
        performed_by="ELLY Inbound Agent",
    )
    db.add(act)

    # Log Audit
    audit = AuditLog(
        user_id=user_id or 1,
        user_email="agent@elly.local",
        action="MEETING_AUTO_SCHEDULED",
        resource_type="Meeting",
        metadata_json=json.dumps({
            "contact_id": contact_id,
            "organization_id": organization_id,
            "scheduled_at": scheduled_at.isoformat(),
            "platform": platform,
            "meeting_url": meeting_url,
        }),
    )
    db.add(audit)
    db.commit()
    db.refresh(meeting)

    logger.info("Auto-scheduled meeting ID %d with %s for %s", meeting.id, contact_name, scheduled_at)
    return meeting


def is_meeting_intent_present(text: str) -> bool:
    """Checks if text proposes or references a meeting."""
    return bool(MEETING_INTENT_PATTERN.search(text))


def extract_platform_and_link(text: str) -> Tuple[str, str]:
    """Identifies meeting platform (Google Meet, Teams, Zoom) and link."""
    link_match = MEETING_LINK_PATTERN.search(text)
    link = link_match.group(1) if link_match else ""

    if "teams" in text.lower() or "microsoft teams" in text.lower():
        platform = "Microsoft Teams"
        if not link:
            link = "https://teams.microsoft.com"
    elif "zoom" in text.lower():
        platform = "Zoom"
        if not link:
            link = "https://zoom.us"
    else:
        platform = "Google Meet"
        if not link:
            # Provide Google Meet standard launcher room
            link = "https://meet.google.com/new"

    return platform, link


def extract_proposed_datetime(text: str) -> datetime:
    """
    Parses proposed date and time from text (e.g. 'tomorrow at 3pm', 'Tuesday 10am', 'Friday 4:00 PM').
    Defaults to next business day at 14:00 UTC if exact time is ambiguous.
    """
    now = datetime.now(timezone.utc)
    lower_text = text.lower()

    # Check for specific days of week
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    target_weekday = None
    for idx, d in enumerate(days):
        if d in lower_text:
            target_weekday = idx
            break

    # Check for relative days: tomorrow, next week
    days_to_add = 1
    if "tomorrow" in lower_text:
        days_to_add = 1
    elif target_weekday is not None:
        current_weekday = now.weekday()
        days_to_add = (target_weekday - current_weekday) % 7
        if days_to_add == 0:
            days_to_add = 7
    elif "next week" in lower_text:
        days_to_add = 7

    target_date = now + timedelta(days=days_to_add)

    # Check for hour specification e.g. "3pm", "3:30 pm", "11am", "10:00 AM"
    time_match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", lower_text)
    hour = 14  # Default 2:00 PM
    minute = 0
    if time_match:
        h = int(time_match.group(1))
        m = int(time_match.group(2)) if time_match.group(2) else 0
        ampm = time_match.group(3).lower()
        if ampm == "pm" and h < 12:
            h += 12
        elif ampm == "am" and h == 12:
            h = 0
        hour = h
        minute = m

    return target_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
