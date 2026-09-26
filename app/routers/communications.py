import math
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, desc, asc, func

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.opportunity import Opportunity
from app.models.meeting import Meeting
from app.models.followup import FollowUp
from app.models.activity import ContactActivity
from app.models.communication import (
    Communication,
    CommunicationChannel,
    CommunicationDirection,
    CommunicationStatus,
)
from app.schemas.communication import (
    CommunicationCreate,
    CommunicationUpdate,
    CommunicationOut,
    CommunicationDetailOut,
    PaginatedCommunicationsOut,
    TimelineItemOut,
    RelationshipTimelineOut,
)

router = APIRouter(
    prefix="/api/business-development/communications",
    tags=["Communications & Outreach"],
    dependencies=[Depends(require_business_development)],
)


def _enrich_communication_out(comm: Communication, db: Session) -> CommunicationOut:
    org_name = None
    if comm.organization_id:
        org = db.query(Organization).filter(Organization.id == comm.organization_id).first()
        org_name = org.name if org else None

    contact_name = None
    contact_designation = None
    if comm.contact_id:
        c = db.query(Contact).filter(Contact.id == comm.contact_id).first()
        if c:
            contact_name = c.full_name
            contact_designation = c.designation

    opp_name = None
    if comm.opportunity_id:
        opp = db.query(Opportunity).filter(Opportunity.id == comm.opportunity_id).first()
        opp_name = opp.name if opp else None

    meeting_title = None
    if comm.meeting_id:
        m = db.query(Meeting).filter(Meeting.id == comm.meeting_id).first()
        meeting_title = m.title if m else None

    followup_title = None
    if comm.followup_id:
        fol = db.query(FollowUp).filter(FollowUp.id == comm.followup_id).first()
        followup_title = fol.title if fol else None

    return CommunicationOut(
        id=comm.id,
        organization_id=comm.organization_id,
        contact_id=comm.contact_id,
        opportunity_id=comm.opportunity_id,
        meeting_id=comm.meeting_id,
        followup_id=comm.followup_id,
        channel=comm.channel,
        direction=comm.direction,
        subject=comm.subject,
        content=comm.content,
        summary=comm.summary,
        communication_date=comm.communication_date,
        status=comm.status,
        source=comm.source,
        duration_minutes=comm.duration_minutes,
        call_outcome=comm.call_outcome,
        external_message_id=comm.external_message_id,
        created_by=comm.created_by,
        owner_id=comm.owner_id,
        created_at=comm.created_at,
        updated_at=comm.updated_at,
        organization_name=org_name,
        contact_name=contact_name,
        contact_designation=contact_designation,
        opportunity_name=opp_name,
        meeting_title=meeting_title,
        followup_title=followup_title,
    )


@router.get("", response_model=PaginatedCommunicationsOut)
def list_communications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    organization_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    opportunity_id: Optional[int] = None,
    channel: Optional[str] = None,
    direction: Optional[str] = None,
    status: Optional[str] = None,
    date_range: Optional[str] = None,  # today, this_week, this_month
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: str = Query("communication_date"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    query = db.query(Communication).filter(Communication.is_deleted.is_(False))

    if organization_id:
        query = query.filter(Communication.organization_id == organization_id)
    if contact_id:
        query = query.filter(Communication.contact_id == contact_id)
    if opportunity_id:
        query = query.filter(Communication.opportunity_id == opportunity_id)
    if channel and channel != "All":
        query = query.filter(Communication.channel == channel)
    if direction and direction != "All":
        query = query.filter(Communication.direction == direction)
    if status and status != "All":
        query = query.filter(Communication.status == status)

    now = datetime.now(timezone.utc)
    if date_range == "today":
        start_of_day = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
        query = query.filter(Communication.communication_date >= start_of_day)
    elif date_range == "this_week":
        start_of_week = now - timedelta(days=now.weekday())
        start_of_week = datetime(start_of_week.year, start_of_week.month, start_of_week.day, 0, 0, 0, tzinfo=timezone.utc)
        query = query.filter(Communication.communication_date >= start_of_week)
    elif date_range == "this_month":
        start_of_month = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)
        query = query.filter(Communication.communication_date >= start_of_month)

    if start_date:
        try:
            sd = datetime.fromisoformat(start_date)
            query = query.filter(Communication.communication_date >= sd)
        except Exception:
            pass

    if end_date:
        try:
            ed = datetime.fromisoformat(end_date)
            query = query.filter(Communication.communication_date <= ed)
        except Exception:
            pass

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = (
            query.outerjoin(Organization, Communication.organization_id == Organization.id)
            .outerjoin(Contact, Communication.contact_id == Contact.id)
            .filter(
                or_(
                    Communication.subject.ilike(term),
                    Communication.summary.ilike(term),
                    Communication.content.ilike(term),
                    Communication.channel.ilike(term),
                    Organization.name.ilike(term),
                    Contact.first_name.ilike(term),
                    Contact.last_name.ilike(term),
                )
            )
        )

    # Sort
    sort_col = getattr(Communication, sort_by, Communication.communication_date)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))

    total = query.count()
    total_pages = max(1, math.ceil(total / page_size))
    items_raw = query.offset((page - 1) * page_size).limit(page_size).all()

    # Aggregate counts for quick UI filters
    all_active = db.query(Communication).filter(Communication.is_deleted.is_(False))
    if organization_id:
        all_active = all_active.filter(Communication.organization_id == organization_id)

    channel_counts: Dict[str, int] = {}
    for c in CommunicationChannel:
        cnt = all_active.filter(Communication.channel == c.value).count()
        if cnt > 0:
            channel_counts[c.value] = cnt

    direction_counts: Dict[str, int] = {
        "Outgoing": all_active.filter(Communication.direction == "Outgoing").count(),
        "Incoming": all_active.filter(Communication.direction == "Incoming").count(),
    }

    return PaginatedCommunicationsOut(
        items=[_enrich_communication_out(c, db) for c in items_raw],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        channel_counts=channel_counts,
        direction_counts=direction_counts,
    )


@router.get("/timeline", response_model=RelationshipTimelineOut)
def get_relationship_timeline(
    organization_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    opportunity_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    if not organization_id and not contact_id and not opportunity_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide at least organization_id, contact_id, or opportunity_id for timeline.",
        )

    org_name = None
    if organization_id:
        org = db.query(Organization).filter(Organization.id == organization_id).first()
        org_name = org.name if org else None

    contact_name = None
    if contact_id:
        c = db.query(Contact).filter(Contact.id == contact_id).first()
        contact_name = c.full_name if c else None

    opp_name = None
    if opportunity_id:
        opp = db.query(Opportunity).filter(Opportunity.id == opportunity_id).first()
        opp_name = opp.name if opp else None

    events: List[TimelineItemOut] = []

    # 1. Communications
    comm_query = db.query(Communication).filter(Communication.is_deleted.is_(False))
    if organization_id:
        comm_query = comm_query.filter(Communication.organization_id == organization_id)
    if contact_id:
        comm_query = comm_query.filter(Communication.contact_id == contact_id)
    if opportunity_id:
        comm_query = comm_query.filter(Communication.opportunity_id == opportunity_id)

    for comm in comm_query.order_by(Communication.communication_date.desc()).limit(limit).all():
        events.append(
            TimelineItemOut(
                id=f"comm-{comm.id}",
                event_type="communication",
                timestamp=comm.communication_date,
                title=f"{comm.channel} ({comm.direction}): {comm.subject}",
                subtitle=comm.summary or f"Recorded by {comm.created_by or 'BD Team'}",
                description=comm.content,
                channel=comm.channel,
                direction=comm.direction,
                status=comm.status,
                performed_by=comm.created_by,
                organization_id=comm.organization_id,
                contact_id=comm.contact_id,
                opportunity_id=comm.opportunity_id,
                reference_id=comm.id,
            )
        )

    # 2. Meetings
    meeting_query = db.query(Meeting).filter(Meeting.is_deleted.is_(False))
    if organization_id:
        meeting_query = meeting_query.filter(Meeting.organization_id == organization_id)
    if contact_id:
        meeting_query = meeting_query.filter(
            or_(
                Meeting.primary_contact_id == contact_id,
                Meeting.contact_ids.contains([contact_id]),
            )
        )
    if opportunity_id:
        meeting_query = meeting_query.filter(Meeting.opportunity_id == opportunity_id)

    for mtg in meeting_query.order_by(Meeting.scheduled_at.desc()).limit(limit).all():
        events.append(
            TimelineItemOut(
                id=f"mtg-{mtg.id}",
                event_type="meeting",
                timestamp=mtg.scheduled_at,
                title=f"Meeting: {mtg.title}",
                subtitle=f"{mtg.meeting_type} · Status: {mtg.status}",
                description=mtg.notes or mtg.agenda or mtg.description,
                channel="Meeting",
                direction="Outgoing",
                status=mtg.status,
                performed_by=mtg.created_by,
                organization_id=mtg.organization_id,
                contact_id=mtg.primary_contact_id,
                opportunity_id=mtg.opportunity_id,
                reference_id=mtg.id,
            )
        )

    # 3. Follow-ups
    fol_query = db.query(FollowUp).filter(FollowUp.is_deleted.is_(False))
    if organization_id:
        fol_query = fol_query.filter(FollowUp.organization_id == organization_id)
    if contact_id:
        fol_query = fol_query.filter(FollowUp.contact_id == contact_id)
    if opportunity_id:
        fol_query = fol_query.filter(FollowUp.opportunity_id == opportunity_id)

    for fol in fol_query.order_by(FollowUp.due_at.desc()).limit(limit).all():
        events.append(
            TimelineItemOut(
                id=f"fol-{fol.id}",
                event_type="followup",
                timestamp=fol.due_at,
                title=f"Follow-up: {fol.title}",
                subtitle=f"Priority: {fol.priority} · Status: {fol.status}",
                description=fol.description,
                channel="Task",
                direction="Outgoing",
                status=fol.status,
                performed_by=fol.created_by,
                organization_id=fol.organization_id,
                contact_id=fol.contact_id,
                opportunity_id=fol.opportunity_id,
                reference_id=fol.id,
            )
        )

    # Sort all events chronologically descending
    events.sort(key=lambda x: x.timestamp, reverse=True)
    events = events[:limit]

    return RelationshipTimelineOut(
        events=events,
        total_events=len(events),
        organization_name=org_name,
        contact_name=contact_name,
        opportunity_name=opp_name,
    )


@router.post("", response_model=CommunicationOut, status_code=status.HTTP_201_CREATED)
def create_communication(
    payload: CommunicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    # 1. Validate Organization exists
    org = db.query(Organization).filter(
        Organization.id == payload.organization_id,
        Organization.is_deleted.is_(False),
    ).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specified organization not found.",
        )

    # 2. Validate Contact belongs to Organization
    contact = None
    if payload.contact_id:
        contact = db.query(Contact).filter(
            Contact.id == payload.contact_id,
            Contact.is_deleted.is_(False),
        ).first()
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified contact not found.",
            )
        if contact.organization_id != payload.organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected contact does not belong to the specified organization.",
            )

    # 3. Validate Opportunity belongs to Organization
    if payload.opportunity_id:
        opp = db.query(Opportunity).filter(
            Opportunity.id == payload.opportunity_id,
            Opportunity.is_deleted.is_(False),
        ).first()
        if not opp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified opportunity not found.",
            )
        if opp.organization_id != payload.organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected opportunity does not belong to the specified organization.",
            )

    # 4. Validate Meeting if provided
    if payload.meeting_id:
        mtg = db.query(Meeting).filter(
            Meeting.id == payload.meeting_id,
            Meeting.is_deleted.is_(False),
        ).first()
        if not mtg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified meeting not found.",
            )
        if mtg.organization_id != payload.organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected meeting does not belong to the specified organization.",
            )

    # 5. Validate Follow-up if provided
    if payload.followup_id:
        fol = db.query(FollowUp).filter(
            FollowUp.id == payload.followup_id,
            FollowUp.is_deleted.is_(False),
        ).first()
        if not fol:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified follow-up not found.",
            )
        if fol.organization_id != payload.organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected follow-up does not belong to the specified organization.",
            )

    comm_date = payload.communication_date or datetime.now(timezone.utc)

    comm = Communication(
        organization_id=payload.organization_id,
        contact_id=payload.contact_id,
        opportunity_id=payload.opportunity_id,
        meeting_id=payload.meeting_id,
        followup_id=payload.followup_id,
        channel=payload.channel.value if hasattr(payload.channel, "value") else str(payload.channel),
        direction=payload.direction.value if hasattr(payload.direction, "value") else str(payload.direction),
        subject=payload.subject.strip(),
        content=payload.content.strip() if payload.content else None,
        summary=payload.summary.strip() if payload.summary else None,
        communication_date=comm_date,
        status=payload.status.value if hasattr(payload.status, "value") else str(payload.status),
        source=payload.source or "manual",
        duration_minutes=payload.duration_minutes,
        call_outcome=payload.call_outcome,
        external_message_id=payload.external_message_id,
        created_by=current_user.name or current_user.email,
        owner_id=current_user.id,
        is_deleted=False,
    )

    db.add(comm)
    db.flush()

    # Update Contact last_contacted_at if applicable
    if contact:
        if not contact.first_contacted_at:
            contact.first_contacted_at = comm_date
        contact.last_contacted_at = comm_date
        db.add(contact)

    # Record ContactActivity
    activity_desc = f"{comm.channel} ({comm.direction}) recorded: {comm.subject}"
    activity = ContactActivity(
        activity_type="communication_recorded",
        description=activity_desc,
        contact_id=payload.contact_id,
        organization_id=payload.organization_id,
        opportunity_id=payload.opportunity_id,
        performed_by=current_user.name or current_user.email,
        created_at=datetime.now(timezone.utc),
    )
    db.add(activity)
    db.commit()
    db.refresh(comm)

    return _enrich_communication_out(comm, db)


@router.get("/{id}", response_model=CommunicationDetailOut)
def get_communication(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    comm = db.query(Communication).filter(
        Communication.id == id,
        Communication.is_deleted.is_(False),
    ).first()
    if not comm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Communication record not found.",
        )
    return _enrich_communication_out(comm, db)


@router.patch("/{id}", response_model=CommunicationOut)
def update_communication(
    id: int,
    payload: CommunicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    comm = db.query(Communication).filter(
        Communication.id == id,
        Communication.is_deleted.is_(False),
    ).first()
    if not comm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Communication record not found.",
        )

    if payload.contact_id is not None:
        if payload.contact_id:
            c = db.query(Contact).filter(
                Contact.id == payload.contact_id,
                Contact.is_deleted.is_(False),
            ).first()
            if not c or c.organization_id != comm.organization_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Selected contact does not belong to the organization.",
                )
            comm.contact_id = payload.contact_id
        else:
            comm.contact_id = None

    if payload.opportunity_id is not None:
        if payload.opportunity_id:
            opp = db.query(Opportunity).filter(
                Opportunity.id == payload.opportunity_id,
                Opportunity.is_deleted.is_(False),
            ).first()
            if not opp or opp.organization_id != comm.organization_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Selected opportunity does not belong to the organization.",
                )
            comm.opportunity_id = payload.opportunity_id
        else:
            comm.opportunity_id = None

    if payload.channel:
        comm.channel = payload.channel.value if hasattr(payload.channel, "value") else str(payload.channel)
    if payload.direction:
        comm.direction = payload.direction.value if hasattr(payload.direction, "value") else str(payload.direction)
    if payload.subject is not None:
        comm.subject = payload.subject.strip()
    if payload.content is not None:
        comm.content = payload.content.strip() if payload.content else None
    if payload.summary is not None:
        comm.summary = payload.summary.strip() if payload.summary else None
    if payload.communication_date is not None:
        comm.communication_date = payload.communication_date
    if payload.status:
        comm.status = payload.status.value if hasattr(payload.status, "value") else str(payload.status)

    comm.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(comm)

    return _enrich_communication_out(comm, db)


@router.delete("/{id}")
def delete_communication(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    comm = db.query(Communication).filter(
        Communication.id == id,
        Communication.is_deleted.is_(False),
    ).first()
    if not comm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Communication record not found.",
        )

    comm.is_deleted = True
    comm.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"status": "success", "message": "Communication record deleted."}


# ─────────────────────────────────────────────────────────────
# QUICK-LOG ENDPOINTS (Tier 1.2 — multi-channel)
# ─────────────────────────────────────────────────────────────

from pydantic import BaseModel as PydanticBaseModel


class PhoneCallLogRequest(PydanticBaseModel):
    organization_id: int
    contact_id: Optional[int] = None
    direction: str = "Outgoing"  # Outgoing | Incoming
    subject: str = "Phone call"
    content: Optional[str] = None
    summary: Optional[str] = None
    duration_minutes: Optional[int] = None
    call_outcome: str = "connected"  # connected | voicemail | no_answer | busy


class WhatsAppLogRequest(PydanticBaseModel):
    organization_id: int
    contact_id: Optional[int] = None
    direction: str = "Outgoing"
    subject: str = "WhatsApp message"
    content: Optional[str] = None
    summary: Optional[str] = None
    external_message_id: Optional[str] = None


class LinkedInLogRequest(PydanticBaseModel):
    organization_id: int
    contact_id: Optional[int] = None
    direction: str = "Outgoing"
    subject: str = "LinkedIn message"
    content: Optional[str] = None
    summary: Optional[str] = None
    external_message_id: Optional[str] = None


@router.post("/quick-log/phone")
def quick_log_phone_call(
    payload: PhoneCallLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Quick-log a phone call. Creates communication + updates contact timestamps."""
    comm = Communication(
        organization_id=payload.organization_id,
        contact_id=payload.contact_id,
        channel=CommunicationChannel.PHONE.value,
        direction=payload.direction,
        subject=payload.subject,
        content=payload.content,
        summary=payload.summary,
        communication_date=datetime.now(timezone.utc),
        status=CommunicationStatus.COMPLETED.value,
        source="manual",
        duration_minutes=payload.duration_minutes,
        call_outcome=payload.call_outcome,
        created_by=current_user.name or current_user.email,
        owner_id=current_user.id,
    )
    db.add(comm)
    db.flush()

    if payload.contact_id:
        contact = db.query(Contact).filter(Contact.id == payload.contact_id).first()
        if contact:
            if not contact.first_contacted_at:
                contact.first_contacted_at = comm.communication_date
            contact.last_contacted_at = comm.communication_date
            db.add(contact)

    db.commit()
    db.refresh(comm)
    return _enrich_communication_out(comm, db)


@router.post("/quick-log/whatsapp")
def quick_log_whatsapp(
    payload: WhatsAppLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Quick-log a WhatsApp message."""
    comm = Communication(
        organization_id=payload.organization_id,
        contact_id=payload.contact_id,
        channel=CommunicationChannel.WHATSAPP.value,
        direction=payload.direction,
        subject=payload.subject,
        content=payload.content,
        summary=payload.summary,
        communication_date=datetime.now(timezone.utc),
        status=CommunicationStatus.COMPLETED.value,
        source="manual",
        external_message_id=payload.external_message_id,
        created_by=current_user.name or current_user.email,
        owner_id=current_user.id,
    )
    db.add(comm)
    db.flush()

    if payload.contact_id:
        contact = db.query(Contact).filter(Contact.id == payload.contact_id).first()
        if contact:
            if not contact.first_contacted_at:
                contact.first_contacted_at = comm.communication_date
            contact.last_contacted_at = comm.communication_date
            db.add(contact)

    db.commit()
    db.refresh(comm)
    return _enrich_communication_out(comm, db)


@router.post("/quick-log/linkedin")
def quick_log_linkedin(
    payload: LinkedInLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Quick-log a LinkedIn message."""
    comm = Communication(
        organization_id=payload.organization_id,
        contact_id=payload.contact_id,
        channel=CommunicationChannel.LINKEDIN.value,
        direction=payload.direction,
        subject=payload.subject,
        content=payload.content,
        summary=payload.summary,
        communication_date=datetime.now(timezone.utc),
        status=CommunicationStatus.COMPLETED.value,
        source="manual",
        external_message_id=payload.external_message_id,
        created_by=current_user.name or current_user.email,
        owner_id=current_user.id,
    )
    db.add(comm)
    db.flush()

    if payload.contact_id:
        contact = db.query(Contact).filter(Contact.id == payload.contact_id).first()
        if contact:
            if not contact.first_contacted_at:
                contact.first_contacted_at = comm.communication_date
            contact.last_contacted_at = comm.communication_date
            db.add(contact)

    db.commit()
    db.refresh(comm)
    return _enrich_communication_out(comm, db)
