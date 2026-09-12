import math
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func, cast, Text

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.meeting import Meeting, MeetingType, MeetingStatus
from app.models.followup import FollowUp, FollowUpPriority, FollowUpStatus
from app.models.activity import ContactActivity
from app.schemas.meeting import (
    MeetingCreate,
    MeetingUpdate,
    MeetingComplete,
    MeetingCancel,
    MeetingReschedule,
    MeetingOut,
    MeetingDetailOut,
    PaginatedMeetingsOut,
    MeetingContactInfo,
)

router = APIRouter(prefix="/api/business-development", tags=["Meetings"])


def _format_meeting_out(meeting: Meeting) -> MeetingOut:
    return MeetingOut(
        id=meeting.id,
        organization_id=meeting.organization_id,
        organization_name=meeting.organization.name if meeting.organization else None,
        primary_contact_id=meeting.primary_contact_id,
        primary_contact_name=meeting.primary_contact.full_name if meeting.primary_contact else None,
        opportunity_id=meeting.opportunity_id,
        opportunity_name=meeting.opportunity.name if meeting.opportunity else None,
        contact_ids=meeting.contact_ids or [],
        title=meeting.title,
        meeting_type=meeting.meeting_type,
        scheduled_at=meeting.scheduled_at,
        duration_minutes=meeting.duration_minutes,
        location=meeting.location,
        meeting_url=meeting.meeting_url,
        status=meeting.status,
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
    )


def _format_meeting_detail_out(meeting: Meeting, db: Session) -> MeetingDetailOut:
    attendee_infos = []
    if meeting.contact_ids:
        contacts = (
            db.query(Contact)
            .filter(Contact.id.in_(meeting.contact_ids), Contact.is_deleted.is_(False))
            .all()
        )
        attendee_infos = [
            MeetingContactInfo(
                id=c.id,
                full_name=c.full_name,
                designation=c.designation,
                email=c.email,
                is_decision_maker=c.is_decision_maker,
                is_primary_contact=c.is_primary_contact,
            )
            for c in contacts
        ]
    elif meeting.primary_contact:
        c = meeting.primary_contact
        attendee_infos = [
            MeetingContactInfo(
                id=c.id,
                full_name=c.full_name,
                designation=c.designation,
                email=c.email,
                is_decision_maker=c.is_decision_maker,
                is_primary_contact=c.is_primary_contact,
            )
        ]

    return MeetingDetailOut(
        id=meeting.id,
        organization_id=meeting.organization_id,
        organization_name=meeting.organization.name if meeting.organization else None,
        primary_contact_id=meeting.primary_contact_id,
        primary_contact_name=meeting.primary_contact.full_name if meeting.primary_contact else None,
        opportunity_id=meeting.opportunity_id,
        opportunity_name=meeting.opportunity.name if meeting.opportunity else None,
        contact_ids=meeting.contact_ids or [],
        title=meeting.title,
        meeting_type=meeting.meeting_type,
        description=meeting.description,
        scheduled_at=meeting.scheduled_at,
        duration_minutes=meeting.duration_minutes,
        location=meeting.location,
        meeting_url=meeting.meeting_url,
        status=meeting.status,
        agenda=meeting.agenda,
        notes=meeting.notes,
        decisions=meeting.decisions,
        next_actions=meeting.next_actions,
        cancellation_reason=meeting.cancellation_reason,
        attendees=attendee_infos,
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
    )


@router.get("/meetings", response_model=PaginatedMeetingsOut)
def list_meetings(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search title, org, contact, description"),
    organization_id: Optional[int] = Query(None, description="Filter by organization ID"),
    contact_id: Optional[int] = Query(None, description="Filter by contact ID"),
    status: Optional[str] = Query(None, description="Filter by status: Scheduled, Completed, Cancelled, Rescheduled"),
    meeting_type: Optional[str] = Query(None, description="Filter by meeting type"),
    date_from: Optional[datetime] = Query(None, description="Start date filter"),
    date_to: Optional[datetime] = Query(None, description="End date filter"),
    owner_scope: str = Query("mine", description="Scope: 'mine' or 'all'"),
    sort_by: str = Query("scheduled_at", description="Sort by: scheduled_at, created_at, title"),
    sort_order: str = Query("asc", description="Sort direction: asc, desc"),
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve paginated business meetings with search and multi-criteria filtering."""
    query = (
        db.query(Meeting)
        .join(Organization, Meeting.organization_id == Organization.id)
        .outerjoin(Contact, Meeting.primary_contact_id == Contact.id)
        .filter(Meeting.is_deleted.is_(False))
    )

    # Ownership scoping
    if owner_scope == "mine" and current_user.role != "ADMIN":
        query = query.filter(Meeting.owner_id == current_user.id)

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Meeting.title).like(term),
                func.lower(Meeting.description).like(term),
                func.lower(Meeting.agenda).like(term),
                func.lower(Organization.name).like(term),
                func.lower(Contact.first_name).like(term),
                func.lower(Contact.last_name).like(term),
            )
        )

    if organization_id is not None:
        query = query.filter(Meeting.organization_id == organization_id)

    if contact_id is not None:
        contact_id_str = str(contact_id)
        query = query.filter(
            or_(
                Meeting.primary_contact_id == contact_id,
                cast(Meeting.contact_ids, Text).ilike(f"%{contact_id_str}%"),
            )
        )

    if status and status.strip() and status.strip().lower() != "all":
        query = query.filter(func.lower(Meeting.status) == status.strip().lower())

    if meeting_type and meeting_type.strip() and meeting_type.strip().lower() != "all":
        query = query.filter(func.lower(Meeting.meeting_type) == meeting_type.strip().lower())

    if date_from is not None:
        query = query.filter(Meeting.scheduled_at >= date_from)

    if date_to is not None:
        query = query.filter(Meeting.scheduled_at <= date_to)

    total = query.count()

    # Sorting
    if sort_by == "title":
        sort_col = Meeting.title
    elif sort_by == "created_at":
        sort_col = Meeting.created_at
    else:
        sort_col = Meeting.scheduled_at

    if sort_order.lower() == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    offset = (page - 1) * page_size
    items = (
        query.options(joinedload(Meeting.organization), joinedload(Meeting.primary_contact))
        .offset(offset)
        .limit(page_size)
        .all()
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedMeetingsOut(
        items=[_format_meeting_out(m) for m in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/meetings/active-upcoming")
def get_active_upcoming_meetings(
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """
    Returns meetings that are currently active (in progress) or scheduled within the next 30 minutes,
    enabling automatic alerts and auto-entry into Google Meet, Microsoft Teams, Zoom, etc.
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=60)
    window_end = now + timedelta(minutes=30)

    query = (
        db.query(Meeting)
        .join(Organization, Meeting.organization_id == Organization.id)
        .outerjoin(Contact, Meeting.primary_contact_id == Contact.id)
        .filter(
            Meeting.is_deleted.is_(False),
            Meeting.status == MeetingStatus.SCHEDULED.value,
            Meeting.scheduled_at >= window_start,
            Meeting.scheduled_at <= window_end,
        )
        .order_by(Meeting.scheduled_at.asc())
    )
    if current_user.role != "ADMIN":
        query = query.filter(or_(Meeting.owner_id == current_user.id, Meeting.owner_id.is_(None)))

    meetings = query.options(joinedload(Meeting.organization), joinedload(Meeting.primary_contact)).all()
    results = []
    for m in meetings:
        meeting_end = m.scheduled_at + timedelta(minutes=m.duration_minutes)
        is_active = m.scheduled_at <= now <= meeting_end
        time_to_start_seconds = int((m.scheduled_at - now).total_seconds())
        results.append({
            "id": m.id,
            "title": m.title,
            "organization_name": m.organization.name if m.organization else None,
            "primary_contact_name": m.primary_contact.full_name if m.primary_contact else None,
            "scheduled_at": m.scheduled_at.isoformat(),
            "duration_minutes": m.duration_minutes,
            "location": m.location,
            "meeting_url": m.meeting_url,
            "is_active": is_active,
            "time_to_start_seconds": time_to_start_seconds,
            "auto_enter_eligible": is_active or (-120 <= time_to_start_seconds <= 60),
        })
    return {"meetings": results, "server_time": now.isoformat()}


@router.get("/meetings/{id}", response_model=MeetingDetailOut)
def get_meeting(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve full meeting details, attendee roster, and discussion records."""
    meeting = (
        db.query(Meeting)
        .options(joinedload(Meeting.organization), joinedload(Meeting.primary_contact))
        .filter(Meeting.id == id, Meeting.is_deleted.is_(False))
        .first()
    )
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID {id} not found.",
        )
    return _format_meeting_detail_out(meeting, db)


@router.post("/meetings", response_model=MeetingDetailOut, status_code=status.HTTP_201_CREATED)
def create_meeting(
    payload: MeetingCreate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Schedule a new business meeting linked to an organization and contacts."""
    # 1. Validate organization exists
    org = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target organization with ID {payload.organization_id} does not exist.",
        )

    # 2. Validate contacts belong to organization if specified
    all_contact_ids = list(payload.contact_ids or [])
    if payload.primary_contact_id and payload.primary_contact_id not in all_contact_ids:
        all_contact_ids.append(payload.primary_contact_id)

    if all_contact_ids:
        valid_contacts_count = (
            db.query(Contact)
            .filter(
                Contact.id.in_(all_contact_ids),
                Contact.organization_id == payload.organization_id,
                Contact.is_deleted.is_(False),
            )
            .count()
        )
        if valid_contacts_count != len(all_contact_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more specified contacts do not belong to the selected organization.",
            )

    now = datetime.now(timezone.utc)
    primary_contact_id = payload.primary_contact_id
    if not primary_contact_id and payload.contact_ids and len(payload.contact_ids) > 0:
        primary_contact_id = payload.contact_ids[0]

    new_meeting = Meeting(
        organization_id=payload.organization_id,
        primary_contact_id=primary_contact_id,
        opportunity_id=payload.opportunity_id,
        contact_ids=all_contact_ids,
        title=payload.title.strip(),
        meeting_type=payload.meeting_type.strip(),
        description=payload.description.strip() if payload.description else None,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        location=payload.location.strip() if payload.location else None,
        meeting_url=payload.meeting_url.strip() if payload.meeting_url else None,
        status=MeetingStatus.SCHEDULED.value,
        agenda=payload.agenda.strip() if payload.agenda else None,
        notes=payload.notes.strip() if payload.notes else None,
        decisions=payload.decisions.strip() if payload.decisions else None,
        next_actions=payload.next_actions.strip() if payload.next_actions else None,
        is_deleted=False,
        created_by=current_user.id,
        owner_id=current_user.id,
        created_at=now,
        updated_at=now,
    )

    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)

    # Log Activity
    act = ContactActivity(
        activity_type="meeting_scheduled",
        description=f"Meeting '{new_meeting.title}' scheduled for {new_meeting.scheduled_at.strftime('%Y-%m-%d %H:%M')} with {org.name}.",
        contact_id=primary_contact_id,
        organization_id=org.id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(new_meeting)

    return _format_meeting_detail_out(new_meeting, db)


@router.put("/meetings/{id}", response_model=MeetingDetailOut)
def update_meeting(
    id: int,
    payload: MeetingUpdate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Update meeting details."""
    meeting = db.query(Meeting).filter(Meeting.id == id, Meeting.is_deleted.is_(False)).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        if value is not None and isinstance(value, str):
            setattr(meeting, field, value.strip())
        else:
            setattr(meeting, field, value)

    meeting.updated_at = now
    db.commit()
    db.refresh(meeting)

    return _format_meeting_detail_out(meeting, db)


@router.post("/meetings/{id}/complete", response_model=MeetingDetailOut)
def complete_meeting(
    id: int,
    payload: MeetingComplete,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Mark meeting as completed, record discussion notes/decisions/next actions, and optionally create follow-up or advance org status."""
    meeting = db.query(Meeting).filter(Meeting.id == id, Meeting.is_deleted.is_(False)).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    meeting.status = MeetingStatus.COMPLETED.value
    if payload.notes:
        meeting.notes = payload.notes.strip()
    if payload.decisions:
        meeting.decisions = payload.decisions.strip()
    if payload.next_actions:
        meeting.next_actions = payload.next_actions.strip()

    meeting.updated_at = now

    # Optionally advance organization stage
    if payload.advance_org_status and payload.advance_org_status.strip():
        org = db.query(Organization).filter(Organization.id == meeting.organization_id).first()
        if org:
            org.status = payload.advance_org_status.strip()
            org.updated_at = now

    # Optionally create follow-up
    if payload.followup_title and payload.followup_due_at:
        new_followup = FollowUp(
            organization_id=meeting.organization_id,
            contact_id=meeting.primary_contact_id,
            meeting_id=meeting.id,
            title=payload.followup_title.strip(),
            due_at=payload.followup_due_at,
            priority=payload.followup_priority.strip() if payload.followup_priority else FollowUpPriority.HIGH.value,
            status=FollowUpStatus.PENDING.value,
            is_deleted=False,
            created_by=current_user.id,
            created_at=now,
            updated_at=now,
        )
        db.add(new_followup)
    else:
        # Auto-create follow-up if none provided — prevents dropped threads
        auto_followup = FollowUp(
            organization_id=meeting.organization_id,
            contact_id=meeting.primary_contact_id,
            meeting_id=meeting.id,
            title=f"Follow up after meeting: {meeting.title}",
            due_at=now + timedelta(days=3),
            priority=FollowUpPriority.HIGH.value,
            status=FollowUpStatus.PENDING.value,
            is_deleted=False,
            created_by=current_user.id,
            created_at=now,
            updated_at=now,
        )
        db.add(auto_followup)

    # Auto-advance opportunity stage if meeting completed and opportunity exists
    if meeting.opportunity_id:
        from app.models.opportunity import Opportunity, OpportunityStage
        opp = db.query(Opportunity).filter(Opportunity.id == meeting.opportunity_id).first()
        if opp and opp.stage not in [OpportunityStage.MEETING.value, OpportunityStage.DEMO.value, OpportunityStage.DISCUSSION.value, OpportunityStage.PROPOSAL.value, OpportunityStage.NEGOTIATION.value, OpportunityStage.PARTNERSHIP.value, OpportunityStage.CUSTOMER.value]:
            opp.stage = OpportunityStage.MEETING.value
            opp.updated_at = now

    # Activity log
    act = ContactActivity(
        activity_type="meeting_completed",
        description=f"Meeting '{meeting.title}' marked as Completed. Notes recorded by {current_user.name}.",
        contact_id=meeting.primary_contact_id,
        organization_id=meeting.organization_id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(meeting)

    return _format_meeting_detail_out(meeting, db)


@router.post("/meetings/{id}/cancel", response_model=MeetingDetailOut)
def cancel_meeting(
    id: int,
    payload: MeetingCancel,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Cancel a scheduled meeting with cancellation reason."""
    meeting = db.query(Meeting).filter(Meeting.id == id, Meeting.is_deleted.is_(False)).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    meeting.status = MeetingStatus.CANCELLED.value
    meeting.cancellation_reason = payload.reason.strip() if payload.reason else "Cancelled by BD team"
    meeting.updated_at = now

    act = ContactActivity(
        activity_type="meeting_cancelled",
        description=f"Meeting '{meeting.title}' cancelled: {meeting.cancellation_reason}",
        contact_id=meeting.primary_contact_id,
        organization_id=meeting.organization_id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(meeting)

    return _format_meeting_detail_out(meeting, db)


@router.post("/meetings/{id}/reschedule", response_model=MeetingDetailOut)
def reschedule_meeting(
    id: int,
    payload: MeetingReschedule,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Reschedule a meeting to a new date and time."""
    meeting = db.query(Meeting).filter(Meeting.id == id, Meeting.is_deleted.is_(False)).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    old_time = meeting.scheduled_at.strftime("%Y-%m-%d %H:%M")
    new_time = payload.scheduled_at.strftime("%Y-%m-%d %H:%M")

    meeting.scheduled_at = payload.scheduled_at
    meeting.status = MeetingStatus.RESCHEDULED.value
    if payload.duration_minutes:
        meeting.duration_minutes = payload.duration_minutes

    reschedule_desc = f"Rescheduled from {old_time} to {new_time}. {payload.note or ''}"
    meeting.updated_at = now

    act = ContactActivity(
        activity_type="meeting_rescheduled",
        description=reschedule_desc,
        contact_id=meeting.primary_contact_id,
        organization_id=meeting.organization_id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(meeting)

    return _format_meeting_detail_out(meeting, db)


@router.delete("/meetings/{id}")
def delete_meeting(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Soft delete a meeting."""
    meeting = db.query(Meeting).filter(Meeting.id == id, Meeting.is_deleted.is_(False)).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meeting with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    meeting.is_deleted = True
    meeting.updated_at = now
    db.commit()

    return {"status": "success", "message": f"Meeting '{meeting.title}' deleted successfully."}


# ─────────────────────────────────────────────────────────────
# TIER 2: MEETING AUTO-FOLLOWUP SUGGESTIONS
# ─────────────────────────────────────────────────────────────

@router.get("/{id}/suggest-followups")
def suggest_meeting_followups(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    After a meeting, suggest follow-up actions based on meeting type and status.
    Returns suggested follow-ups that can be created with one click.
    """
    meeting = db.query(Meeting).filter(Meeting.id == id, Meeting.is_deleted.is_(False)).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    now = datetime.now(timezone.utc)
    suggestions = []

    # Check if follow-ups already exist for this meeting
    existing_followups = (
        db.query(FollowUp)
        .filter(FollowUp.meeting_id == id, FollowUp.is_deleted.is_(False))
        .all()
    )
    existing_titles = {f.title.lower() for f in existing_followups}

    # 1. Always suggest "Send meeting summary/notes"
    if "send meeting summary" not in existing_titles:
        suggestions.append({
            "title": "Send meeting summary",
            "description": f"Send a summary of {meeting.title} to attendees with key takeaways and next steps.",
            "priority": "High",
            "due_days": 1,
            "category": "summary",
        })

    # 2. Demo meeting → suggest proposal follow-up
    if meeting.meeting_type and "Demo" in meeting.meeting_type:
        if "send proposal" not in existing_titles:
            suggestions.append({
                "title": "Send proposal/pricing",
                "description": f"Follow up on the demo with a tailored proposal for {meeting.organization.name if meeting.organization else 'the organization'}.",
                "priority": "High",
                "due_days": 3,
                "category": "proposal",
            })

    # 3. Discovery meeting → suggest deeper technical call
    if meeting.meeting_type and "Discovery" in meeting.meeting_type:
        if "schedule technical deep-dive" not in existing_titles:
            suggestions.append({
                "title": "Schedule technical deep-dive",
                "description": "Discovery complete — schedule a technical deep-dive with their engineering team.",
                "priority": "Medium",
                "due_days": 5,
                "category": "technical",
            })

    # 4. Meeting is past and status is Completed → suggest next steps
    if meeting.scheduled_at and meeting.scheduled_at < now and meeting.status == MeetingStatus.COMPLETED.value:
        suggestions.append({
            "title": "Log meeting outcome",
            "description": "Record key decisions, action items, and relationship progression from this meeting.",
            "priority": "High",
            "due_days": 0,
            "category": "outcome",
        })

    # 5. If no contact_id set → suggest linking a contact
    if not meeting.contact_id:
        suggestions.append({
            "title": "Link a contact to this meeting",
            "description": "No contact is associated with this meeting. Link one for better relationship tracking.",
            "priority": "Medium",
            "due_days": 0,
            "category": "link_contact",
        })

    return {
        "meeting_id": meeting.id,
        "meeting_title": meeting.title,
        "meeting_type": meeting.meeting_type,
        "scheduled_at": meeting.scheduled_at.isoformat() if meeting.scheduled_at else None,
        "existing_followups_count": len(existing_followups),
        "suggestions": suggestions,
    }
