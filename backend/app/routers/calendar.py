"""
Calendar router — Google Calendar integration + local calendar.
Works with or without Google Calendar configured (falls back to local DB).
"""
import json
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from pydantic import BaseModel

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.core.config import settings
from app.models.meeting import Meeting, MeetingStatus
from app.models.organization import Organization
from app.models.contact import Contact

router = APIRouter(prefix="/api/calendar", tags=["Calendar"])


class CalendarEvent(BaseModel):
    id: int
    title: str
    start: str
    end: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    meeting_type: Optional[str] = None
    status: str
    organization_name: Optional[str] = None
    contact_names: List[str] = []
    meeting_url: Optional[str] = None


class CalendarSyncRequest(BaseModel):
    meeting_id: int
    google_event_id: Optional[str] = None


def _meeting_to_event(meeting: Meeting, db: Session = None) -> CalendarEvent:
    """Convert a Meeting model to a calendar event."""
    org_name = meeting.organization.name if meeting.organization else None
    contact_names = []
    if meeting.primary_contact:
        contact_names.append(f"{meeting.primary_contact.first_name} {meeting.primary_contact.last_name}")
    elif meeting.contact_ids and db:
        contacts = db.query(Contact).filter(Contact.id.in_(meeting.contact_ids)).all()
        contact_names = [f"{c.first_name} {c.last_name}" for c in contacts]

    start_time = ""
    end_time = None
    if meeting.scheduled_at:
        dt = meeting.scheduled_at if meeting.scheduled_at.tzinfo else meeting.scheduled_at.replace(tzinfo=timezone.utc)
        start_time = dt.isoformat()
        if meeting.duration_minutes:
            from datetime import timedelta
            end_dt = dt + timedelta(minutes=meeting.duration_minutes)
            end_time = end_dt.isoformat()

    return CalendarEvent(
        id=meeting.id,
        title=meeting.title or f"Meeting with {org_name or 'Organization'}",
        start=start_time,
        end=end_time,
        description=meeting.description or meeting.agenda or "",
        location=meeting.location or "",
        meeting_type=meeting.meeting_type or "",
        status=meeting.status or "Scheduled",
        organization_name=org_name,
        contact_names=contact_names,
        meeting_url=meeting.meeting_url,
    )


@router.get("/events", response_model=List[CalendarEvent])
def get_calendar_events(
    start_date: Optional[str] = Query(None, description="ISO date string"),
    end_date: Optional[str] = Query(None, description="ISO date string"),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(require_business_development),
):
    """Get all meetings as calendar events."""
    query = db.query(Meeting).options(
        joinedload(Meeting.organization),
        joinedload(Meeting.primary_contact),
    ).filter(Meeting.is_deleted == False)

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            # Use string comparison for SQLite compatibility
            query = query.filter(Meeting.scheduled_at >= start_dt.strftime("%Y-%m-%d %H:%M:%S"))
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            query = query.filter(Meeting.scheduled_at <= end_dt.strftime("%Y-%m-%d %H:%M:%S"))
        except ValueError:
            pass

    if status:
        query = query.filter(Meeting.status == status)
    else:
        query = query.filter(Meeting.status != "Cancelled")

    meetings = query.order_by(Meeting.scheduled_at).all()
    return [_meeting_to_event(m, db) for m in meetings]


@router.get("/today")
def get_today_events(
    db: Session = Depends(get_db),
    current_user=Depends(require_business_development),
):
    """Get today's meetings."""
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start.replace(hour=23, minute=59, second=59)

    meetings = db.query(Meeting).options(
        joinedload(Meeting.organization),
        joinedload(Meeting.primary_contact),
    ).filter(
        Meeting.is_deleted == False,
        Meeting.scheduled_at >= start,
        Meeting.scheduled_at <= end,
        Meeting.status != "Cancelled",
    ).order_by(Meeting.scheduled_at).all()

    return [_meeting_to_event(m, db) for m in meetings]


@router.get("/upcoming")
def get_upcoming_events(
    days: int = Query(7, description="Number of days ahead"),
    db: Session = Depends(get_db),
    current_user=Depends(require_business_development),
):
    """Get upcoming meetings for the next N days."""
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    end = now + timedelta(days=days)

    meetings = db.query(Meeting).options(
        joinedload(Meeting.organization),
        joinedload(Meeting.primary_contact),
    ).filter(
        Meeting.is_deleted == False,
        Meeting.scheduled_at >= now,
        Meeting.scheduled_at <= end,
        Meeting.status != "Cancelled",
    ).order_by(Meeting.scheduled_at).all()

    return [_meeting_to_event(m, db) for m in meetings]


@router.post("/sync-to-google/{meeting_id}")
async def sync_meeting_to_google(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_business_development),
):
    """Sync a meeting to Google Calendar."""
    if not settings.GOOGLE_CALENDAR_CREDENTIALS_FILE:
        return {
            "status": "local_only",
            "message": "Google Calendar not configured. Meeting saved locally.",
            "meeting_id": meeting_id,
        }

    meeting = db.query(Meeting).options(
        joinedload(Meeting.organization),
        joinedload(Meeting.primary_contact),
    ).filter(Meeting.id == meeting_id).first()

    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    try:
        from app.services.google_calendar_service import sync_meeting_to_calendar
        result = sync_meeting_to_calendar(meeting)
        return {"status": "synced", "google_event_id": result.get("id"), "meeting_id": meeting_id}
    except Exception as e:
        return {
            "status": "sync_failed",
            "message": f"Google Calendar sync failed: {str(e)}. Meeting saved locally.",
            "meeting_id": meeting_id,
        }


@router.get("/availability")
def check_availability(
    date: str = Query(..., description="ISO date string"),
    db: Session = Depends(get_db),
    current_user=Depends(require_business_development),
):
    """Check available time slots for a given date."""
    try:
        check_date = datetime.fromisoformat(date.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    start = check_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start.replace(hour=23, minute=59, second=59)

    meetings = db.query(Meeting).filter(
        Meeting.is_deleted == False,
        Meeting.scheduled_at >= start,
        Meeting.scheduled_at <= end,
        Meeting.status != "Cancelled",
    ).all()

    booked_hours = set()
    for m in meetings:
        if m.scheduled_at:
            booked_hours.add(m.scheduled_at.hour)

    available = []
    for hour in range(9, 18):  # 9 AM to 5 PM
        if hour not in booked_hours:
            available.append({
                "time": f"{hour:02d}:00",
                "hour": hour,
                "available": True,
            })
        else:
            available.append({
                "time": f"{hour:02d}:00",
                "hour": hour,
                "available": False,
            })

    return {"date": date, "slots": available}
