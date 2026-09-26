from datetime import datetime, timezone
import math
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.contact import Contact, ContactRelationshipStatus
from app.models.activity import ContactActivity
from app.schemas.contact import (
    ContactCreate,
    ContactUpdate,
    ContactStatusUpdate,
    ContactNoteAdd,
    ContactOut,
    ContactDetailOut,
    PaginatedContactsOut,
    DuplicateContactCheckResponse,
    ContactActivityOut,
)

router = APIRouter(prefix="/api/business-development", tags=["Contacts"])


def _format_contact_out(contact: Contact) -> ContactOut:
    return ContactOut(
        id=contact.id,
        organization_id=contact.organization_id,
        organization_name=contact.organization.name if contact.organization else None,
        first_name=contact.first_name,
        last_name=contact.last_name,
        full_name=contact.full_name,
        designation=contact.designation,
        department=contact.department,
        email=contact.email,
        phone=contact.phone,
        linkedin_url=contact.linkedin_url,
        location=contact.location,
        is_decision_maker=contact.is_decision_maker,
        is_primary_contact=contact.is_primary_contact,
        connection_status=contact.connection_status,
        first_contacted_at=contact.first_contacted_at,
        last_contacted_at=contact.last_contacted_at,
        next_followup_at=contact.next_followup_at,
        created_at=contact.created_at,
        updated_at=contact.updated_at,
    )


def _format_contact_detail_out(contact: Contact) -> ContactDetailOut:
    activities_out = [
        ContactActivityOut.model_validate(act)
        for act in contact.activities
    ]
    return ContactDetailOut(
        id=contact.id,
        organization_id=contact.organization_id,
        organization_name=contact.organization.name if contact.organization else None,
        first_name=contact.first_name,
        last_name=contact.last_name,
        full_name=contact.full_name,
        designation=contact.designation,
        department=contact.department,
        email=contact.email,
        phone=contact.phone,
        linkedin_url=contact.linkedin_url,
        location=contact.location,
        is_decision_maker=contact.is_decision_maker,
        is_primary_contact=contact.is_primary_contact,
        connection_status=contact.connection_status,
        notes=contact.notes,
        is_deleted=contact.is_deleted,
        first_contacted_at=contact.first_contacted_at,
        last_contacted_at=contact.last_contacted_at,
        next_followup_at=contact.next_followup_at,
        created_at=contact.created_at,
        updated_at=contact.updated_at,
        activities=activities_out,
    )


@router.get("/contacts", response_model=PaginatedContactsOut)
def list_contacts(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by contact name, email, phone, designation, org"),
    organization_id: Optional[int] = Query(None, description="Filter by organization ID"),
    is_decision_maker: Optional[bool] = Query(None, description="Filter by decision maker flag"),
    is_primary_contact: Optional[bool] = Query(None, description="Filter by primary contact flag"),
    connection_status: Optional[str] = Query(None, description="Filter by connection status"),
    department: Optional[str] = Query(None, description="Filter by department"),
    owner_scope: str = Query("mine", description="Scope: 'mine' (owner_id=current user), 'all' (admin/manager view)"),
    sort_by: str = Query("created_at", description="Sort field: name, created_at, updated_at, designation, connection_status"),
    sort_order: str = Query("desc", description="Sort direction: asc, desc"),
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """List business contacts with multi-criteria filtering, search, and pagination."""
    query = (
        db.query(Contact)
        .join(Organization, Contact.organization_id == Organization.id)
        .filter(Contact.is_deleted.is_(False))
    )

    # Ownership scoping: BD users see own records by default, admins see all
    if owner_scope == "mine" and current_user.role != "ADMIN":
        query = query.filter(Contact.owner_id == current_user.id)

    # Search filter
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Contact.first_name).like(term),
                func.lower(Contact.last_name).like(term),
                func.lower(Contact.email).like(term),
                func.lower(Contact.phone).like(term),
                func.lower(Contact.designation).like(term),
                func.lower(Contact.department).like(term),
                func.lower(Organization.name).like(term),
            )
        )

    # Specific filters
    if organization_id is not None:
        query = query.filter(Contact.organization_id == organization_id)
    if is_decision_maker is not None:
        query = query.filter(Contact.is_decision_maker == is_decision_maker)
    if is_primary_contact is not None:
        query = query.filter(Contact.is_primary_contact == is_primary_contact)
    if connection_status and connection_status.strip():
        query = query.filter(Contact.connection_status == connection_status.strip())
    if department and department.strip():
        query = query.filter(func.lower(Contact.department) == department.strip().lower())

    total = query.count()

    # Sorting
    if sort_by == "name":
        sort_col = Contact.first_name
    elif sort_by == "designation":
        sort_col = Contact.designation
    elif sort_by == "connection_status":
        sort_col = Contact.connection_status
    elif sort_by == "updated_at":
        sort_col = Contact.updated_at
    else:
        sort_col = Contact.created_at

    if sort_order.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    offset = (page - 1) * page_size
    items = query.options(joinedload(Contact.organization)).offset(offset).limit(page_size).all()
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedContactsOut(
        items=[_format_contact_out(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/contacts/check-duplicate", response_model=DuplicateContactCheckResponse)
def check_duplicate_contact(
    email: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    organization_id: Optional[int] = Query(None),
    first_name: Optional[str] = Query(None),
    last_name: Optional[str] = Query(None),
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Check for duplicate contacts by email, phone, or name within same organization."""
    if email and email.strip():
        existing = (
            db.query(Contact)
            .filter(Contact.is_deleted.is_(False), func.lower(Contact.email) == email.strip().lower())
            .first()
        )
        if existing:
            return DuplicateContactCheckResponse(
                is_duplicate=True,
                existing_id=existing.id,
                existing_name=existing.full_name,
                reason="email",
                message=f"A contact with email '{email.strip()}' already exists ({existing.full_name}).",
            )

    if phone and phone.strip():
        existing = (
            db.query(Contact)
            .filter(Contact.is_deleted.is_(False), Contact.phone == phone.strip())
            .first()
        )
        if existing:
            return DuplicateContactCheckResponse(
                is_duplicate=True,
                existing_id=existing.id,
                existing_name=existing.full_name,
                reason="phone",
                message=f"A contact with phone '{phone.strip()}' already exists ({existing.full_name}).",
            )

    if organization_id and first_name and first_name.strip():
        clean_fn = first_name.strip().lower()
        clean_ln = last_name.strip().lower() if last_name else ""
        existing = (
            db.query(Contact)
            .filter(
                Contact.is_deleted.is_(False),
                Contact.organization_id == organization_id,
                func.lower(Contact.first_name) == clean_fn,
            )
            .all()
        )
        for c in existing:
            c_ln = (c.last_name or "").strip().lower()
            if c_ln == clean_ln:
                return DuplicateContactCheckResponse(
                    is_duplicate=True,
                    existing_id=c.id,
                    existing_name=c.full_name,
                    reason="name_in_org",
                    message=f"A contact named '{c.full_name}' already exists in this organization.",
                )

    return DuplicateContactCheckResponse(
        is_duplicate=False,
        message="No duplicate contact found.",
    )


@router.post("/contacts", response_model=ContactDetailOut, status_code=status.HTTP_201_CREATED)
def create_contact(
    payload: ContactCreate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Create a new business contact linked to an organization."""
    # 1. Verify parent organization exists
    org = (
        db.query(Organization)
        .filter(Organization.id == payload.organization_id, Organization.is_deleted.is_(False))
        .first()
    )
    if not org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target organization with ID {payload.organization_id} does not exist.",
        )

    # 2. Check duplicate email or phone if allow_duplicate is False
    if not payload.allow_duplicate:
        if payload.email and payload.email.strip():
            existing_email = (
                db.query(Contact)
                .filter(
                    Contact.is_deleted.is_(False),
                    func.lower(Contact.email) == payload.email.strip().lower(),
                )
                .first()
            )
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A contact with email '{payload.email.strip()}' already exists (ID: {existing_email.id}).",
                )

        if payload.phone and payload.phone.strip():
            existing_phone = (
                db.query(Contact)
                .filter(
                    Contact.is_deleted.is_(False),
                    Contact.phone == payload.phone.strip(),
                )
                .first()
            )
            if existing_phone:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A contact with phone '{payload.phone.strip()}' already exists (ID: {existing_phone.id}).",
                )

    now = datetime.now(timezone.utc)

    # 3. If new contact is primary, unmark any previous primary contact in this organization
    if payload.is_primary_contact:
        db.query(Contact).filter(
            Contact.organization_id == payload.organization_id,
            Contact.is_deleted.is_(False),
            Contact.is_primary_contact.is_(True),
        ).update({"is_primary_contact": False, "updated_at": now})

    new_contact = Contact(
        organization_id=payload.organization_id,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip() if payload.last_name else None,
        designation=payload.designation.strip() if payload.designation else None,
        department=payload.department.strip() if payload.department else None,
        email=payload.email.strip().lower() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        linkedin_url=payload.linkedin_url.strip() if payload.linkedin_url else None,
        location=payload.location.strip() if payload.location else None,
        is_decision_maker=payload.is_decision_maker,
        is_primary_contact=payload.is_primary_contact,
        connection_status=payload.connection_status.strip() if payload.connection_status else ContactRelationshipStatus.NOT_CONTACTED.value,
        notes=payload.notes.strip() if payload.notes else None,
        is_deleted=False,
        created_by=current_user.id,
        owner_id=current_user.id,
        created_at=now,
        updated_at=now,
    )

    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)

    # 4. Log initial creation activity
    initial_activity = ContactActivity(
        activity_type="contact_created",
        description=f"Contact {new_contact.full_name} added to {org.name} as {new_contact.designation or 'Contact'}.",
        contact_id=new_contact.id,
        organization_id=org.id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(initial_activity)
    db.commit()
    db.refresh(new_contact)

    return _format_contact_detail_out(new_contact)


@router.get("/contacts/{id}", response_model=ContactDetailOut)
def get_contact(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve full contact profile and activity timeline."""
    contact = (
        db.query(Contact)
        .options(joinedload(Contact.organization), joinedload(Contact.activities))
        .filter(Contact.id == id, Contact.is_deleted.is_(False))
        .first()
    )
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID {id} not found.",
        )
    return _format_contact_detail_out(contact)


@router.put("/contacts/{id}", response_model=ContactDetailOut)
def update_contact(
    id: int,
    payload: ContactUpdate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Update contact profile details."""
    contact = (
        db.query(Contact)
        .options(joinedload(Contact.organization), joinedload(Contact.activities))
        .filter(Contact.id == id, Contact.is_deleted.is_(False))
        .first()
    )
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    update_data = payload.model_dump(exclude_unset=True)

    # If updating primary status to True, unset others in org
    if update_data.get("is_primary_contact") is True:
        db.query(Contact).filter(
            Contact.organization_id == contact.organization_id,
            Contact.id != contact.id,
            Contact.is_deleted.is_(False),
            Contact.is_primary_contact.is_(True),
        ).update({"is_primary_contact": False, "updated_at": now})

    for field, value in update_data.items():
        if value is not None and isinstance(value, str):
            setattr(contact, field, value.strip())
        else:
            setattr(contact, field, value)

    contact.updated_at = now
    db.commit()
    db.refresh(contact)

    # Activity log
    act = ContactActivity(
        activity_type="contact_updated",
        description=f"Contact profile updated by {current_user.name}.",
        contact_id=contact.id,
        organization_id=contact.organization_id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(contact)

    return _format_contact_detail_out(contact)


@router.patch("/contacts/{id}/status", response_model=ContactDetailOut)
def update_contact_status(
    id: int,
    payload: ContactStatusUpdate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Quickly update contact relationship status with transition activity note."""
    contact = (
        db.query(Contact)
        .options(joinedload(Contact.organization), joinedload(Contact.activities))
        .filter(Contact.id == id, Contact.is_deleted.is_(False))
        .first()
    )
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    old_status = contact.connection_status
    new_status = payload.connection_status.strip()
    contact.connection_status = new_status
    contact.last_contacted_at = now
    if not contact.first_contacted_at and new_status != ContactRelationshipStatus.NOT_CONTACTED.value:
        contact.first_contacted_at = now

    transition_desc = f"Relationship status changed: {old_status} -> {new_status}"
    if payload.note and payload.note.strip():
        transition_desc += f": {payload.note.strip()}"
        now_str = now.strftime("%Y-%m-%d %H:%M UTC")
        note_entry = f"[{now_str}] {transition_desc}"
        contact.notes = f"{contact.notes}\n\n{note_entry}" if contact.notes else note_entry

    contact.updated_at = now
    db.commit()

    # Log activity
    act = ContactActivity(
        activity_type="status_updated",
        description=transition_desc,
        contact_id=contact.id,
        organization_id=contact.organization_id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(contact)

    return _format_contact_detail_out(contact)


@router.patch("/contacts/{id}/primary", response_model=ContactDetailOut)
def set_primary_contact(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Set contact as the primary contact for its organization."""
    contact = (
        db.query(Contact)
        .options(joinedload(Contact.organization), joinedload(Contact.activities))
        .filter(Contact.id == id, Contact.is_deleted.is_(False))
        .first()
    )
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    # Unset other primary contacts in org
    db.query(Contact).filter(
        Contact.organization_id == contact.organization_id,
        Contact.id != contact.id,
        Contact.is_deleted.is_(False),
        Contact.is_primary_contact.is_(True),
    ).update({"is_primary_contact": False, "updated_at": now})

    contact.is_primary_contact = True
    contact.updated_at = now
    db.commit()

    act = ContactActivity(
        activity_type="primary_contact_updated",
        description=f"{contact.full_name} designated as primary contact for {contact.organization.name if contact.organization else 'organization'}.",
        contact_id=contact.id,
        organization_id=contact.organization_id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(contact)

    return _format_contact_detail_out(contact)


@router.patch("/contacts/{id}/decision-maker", response_model=ContactDetailOut)
def toggle_decision_maker(
    id: int,
    is_decision_maker: bool = Query(..., description="Decision maker boolean state"),
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Toggle decision maker flag for contact."""
    contact = (
        db.query(Contact)
        .options(joinedload(Contact.organization), joinedload(Contact.activities))
        .filter(Contact.id == id, Contact.is_deleted.is_(False))
        .first()
    )
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    contact.is_decision_maker = is_decision_maker
    contact.updated_at = now
    db.commit()

    act = ContactActivity(
        activity_type="decision_maker_updated",
        description=f"{contact.full_name} marked as {'Decision Maker' if is_decision_maker else 'Non Decision Maker'} by {current_user.name}.",
        contact_id=contact.id,
        organization_id=contact.organization_id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(contact)

    return _format_contact_detail_out(contact)


@router.post("/contacts/{id}/notes", response_model=ContactDetailOut)
def add_contact_note(
    id: int,
    payload: ContactNoteAdd,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Append a confidential internal BD note to the contact."""
    contact = (
        db.query(Contact)
        .options(joinedload(Contact.organization), joinedload(Contact.activities))
        .filter(Contact.id == id, Contact.is_deleted.is_(False))
        .first()
    )
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    now_str = now.strftime("%Y-%m-%d %H:%M UTC")
    new_note_entry = f"[{now_str} - {current_user.name}]\n{payload.note.strip()}"

    if contact.notes:
        contact.notes = f"{contact.notes}\n\n{new_note_entry}"
    else:
        contact.notes = new_note_entry

    contact.updated_at = now
    db.commit()

    act = ContactActivity(
        activity_type="note_added",
        description=f"Internal BD note recorded by {current_user.name}.",
        contact_id=contact.id,
        organization_id=contact.organization_id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(contact)

    return _format_contact_detail_out(contact)


@router.delete("/contacts/{id}")
def delete_contact(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Soft delete a contact."""
    contact = db.query(Contact).filter(Contact.id == id, Contact.is_deleted.is_(False)).first()
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    contact.is_deleted = True
    contact.is_primary_contact = False
    contact.updated_at = now
    db.commit()

    return {"status": "success", "message": f"Contact '{contact.full_name}' deleted successfully."}


@router.get("/organizations/{organization_id}/contacts", response_model=List[ContactOut])
def get_organization_contacts(
    organization_id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """List all active contacts associated with an organization."""
    org = db.query(Organization).filter(Organization.id == organization_id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization with ID {organization_id} not found.",
        )

    contacts = (
        db.query(Contact)
        .filter(Contact.organization_id == organization_id, Contact.is_deleted.is_(False))
        .order_by(Contact.is_primary_contact.desc(), Contact.is_decision_maker.desc(), Contact.first_name.asc())
        .all()
    )

    return [_format_contact_out(c) for c in contacts]


# ─────────────────────────────────────────────────────────────
# TIER 2: CONTACT INTELLIGENCE — AI FOLLOW-UP SUGGESTIONS
# ─────────────────────────────────────────────────────────────

from app.models.communication import Communication, CommunicationChannel
from app.models.meeting import Meeting
from app.models.followup import FollowUp, FollowUpStatus
from app.models.campaign import CampaignContact, CampaignContactStatus
from datetime import timedelta


@router.get("/{id}/suggest-next-action")
def suggest_next_action(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    Analyze a contact's history and suggest the next best action.
    Returns suggestions with rationale, priority, and recommended channel.
    """
    contact = db.query(Contact).filter(Contact.id == id, Contact.is_deleted.is_(False)).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    now = datetime.now(timezone.utc)
    suggestions = []

    # Gather history
    comms = (
        db.query(Communication)
        .filter(Communication.contact_id == id, Communication.is_deleted.is_(False))
        .order_by(Communication.communication_date.desc())
        .all()
    )
    meetings = (
        db.query(Meeting)
        .filter(Meeting.contact_id == id, Meeting.is_deleted.is_(False))
        .order_by(Meeting.scheduled_at.desc())
        .all()
    )
    followups = (
        db.query(FollowUp)
        .filter(FollowUp.contact_id == id, FollowUp.is_deleted.is_(False))
        .order_by(FollowUp.due_at.desc())
        .all()
    )
    campaign_contacts = (
        db.query(CampaignContact)
        .filter(CampaignContact.contact_id == id)
        .order_by(CampaignContact.created_at.desc())
        .all()
    )

    last_comm = comms[0] if comms else None
    last_meeting = meetings[0] if meetings else None
    last_followup = followups[0] if followups else None

    # 1. No communications yet → suggest initial outreach
    if not comms:
        suggestions.append({
            "action": "Send initial outreach email",
            "rationale": f"No communications logged with {contact.full_name}. Start the relationship.",
            "priority": "HIGH",
            "channel": contact.preferred_channel or "Email",
            "category": "initial_outreach",
        })

    # 2. Last comm was outgoing with no reply → suggest follow-up
    elif last_comm and last_comm.direction == "Outgoing":
        days_since = (now - last_comm.communication_date).days if last_comm.communication_date else 0
        if days_since >= 3:
            suggestions.append({
                "action": f"Follow up (last outreach {days_since}d ago)",
                "rationale": f"Last {last_comm.channel} was {days_since} days ago with no reply. Try a different channel or angle.",
                "priority": "HIGH" if days_since >= 7 else "MEDIUM",
                "channel": "Phone" if last_comm.channel == "Email" else "Email",
                "category": "follow_up",
            })

    # 3. Last comm was incoming (reply) → suggest response
    elif last_comm and last_comm.direction == "Incoming":
        suggestions.append({
            "action": "Respond to prospect's message",
            "rationale": f"{contact.full_name} sent a message — respond promptly to maintain momentum.",
            "priority": "HIGH",
            "channel": last_comm.channel,
            "category": "respond",
        })

    # 4. Meeting completed but no follow-up → suggest follow-up creation
    if last_meeting and last_meeting.scheduled_at:
        meeting_passed = last_meeting.scheduled_at < now
        has_followup_for_meeting = any(
            f.meeting_id == last_meeting.id and f.status == FollowUpStatus.PENDING.value
            for f in followups
        )
        if meeting_passed and not has_followup_for_meeting:
            suggestions.append({
                "action": f"Create follow-up for meeting: {last_meeting.title}",
                "rationale": "Meeting has passed but no follow-up action is tracked. Capture next steps.",
                "priority": "HIGH",
                "channel": contact.preferred_channel or "Email",
                "category": "meeting_followup",
            })

    # 5. Overdue follow-up → flag
    overdue = [f for f in followups if f.status == FollowUpStatus.PENDING.value and f.due_at and f.due_at < now]
    if overdue:
        suggestions.append({
            "action": f"Complete overdue follow-up: {overdue[0].title}",
            "rationale": f"Follow-up was due {overdue[0].due_at.strftime('%b %d')}. This is blocking the deal.",
            "priority": "HIGH",
            "channel": contact.preferred_channel or "Email",
            "category": "overdue_followup",
        })

    # 6. In campaign but paused → suggest re-engagement
    paused_campaigns = [
        cc for cc in campaign_contacts
        if cc.status in [CampaignContactStatus.PAUSED.value, CampaignContactStatus.SENT.value]
    ]
    if paused_campaigns and not overdue:
        suggestions.append({
            "action": "Check campaign engagement metrics",
            "rationale": f"Contact is in {len(paused_campaigns)} campaign(s). Review opens/replies to decide next step.",
            "priority": "LOW",
            "channel": "Email",
            "category": "campaign_review",
        })

    # 7. No preferred channel set → suggest setting
    if not contact.preferred_channel and comms:
        channel_counts = {}
        for c in comms:
            channel_counts[c.channel] = channel_counts.get(c.channel, 0) + 1
        if channel_counts:
            best_channel = max(channel_counts, key=channel_counts.get)
            suggestions.append({
                "action": f"Set preferred channel to {best_channel}",
                "rationale": f"Most communications ({channel_counts[best_channel]}) used {best_channel}. Mark as preferred.",
                "priority": "LOW",
                "channel": best_channel,
                "category": "prefer_channel",
            })

    return {
        "contact_id": contact.id,
        "contact_name": contact.full_name,
        "organization_id": contact.organization_id,
        "connection_status": contact.connection_status,
        "last_communication": {
            "channel": last_comm.channel if last_comm else None,
            "direction": last_comm.direction if last_comm else None,
            "date": last_comm.communication_date.isoformat() if last_comm and last_comm.communication_date else None,
        } if last_comm else None,
        "total_communications": len(comms),
        "total_meetings": len(meetings),
        "total_followups": len(followups),
        "suggestions": suggestions,
    }
