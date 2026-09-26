import math
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.meeting import Meeting
from app.models.followup import FollowUp, FollowUpPriority, FollowUpStatus
from app.models.activity import ContactActivity
from app.schemas.followup import (
    FollowUpCreate,
    FollowUpUpdate,
    FollowUpCancel,
    FollowUpOut,
    PaginatedFollowUpsOut,
    GroupedFollowUpsOut,
)

router = APIRouter(prefix="/api/business-development", tags=["Follow-ups"])


def _calculate_timing_label(due_at: datetime, status: str) -> tuple[bool, str]:
    now = datetime.now(timezone.utc)
    if status == FollowUpStatus.COMPLETED.value:
        return False, "Completed"
    if status == FollowUpStatus.CANCELLED.value:
        return False, "Cancelled"

    # Make due_at timezone-aware if needed
    if due_at.tzinfo is None:
        due_at_aware = due_at.replace(tzinfo=timezone.utc)
    else:
        due_at_aware = due_at

    now_date = now.date()
    due_date = due_at_aware.date()

    if due_at_aware < now and due_date < now_date:
        days_overdue = (now_date - due_date).days
        return True, f"{days_overdue} day{'s' if days_overdue > 1 else ''} overdue"
    elif due_date == now_date:
        return False, f"Today, {due_at_aware.strftime('%I:%M %p')}"
    elif (due_date - now_date).days == 1:
        return False, "Tomorrow"
    else:
        days_ahead = (due_date - now_date).days
        return False, f"In {days_ahead} days"


def _format_followup_out(f: FollowUp) -> FollowUpOut:
    is_overdue, timing_label = _calculate_timing_label(f.due_at, f.status)
    return FollowUpOut(
        id=f.id,
        organization_id=f.organization_id,
        organization_name=f.organization.name if f.organization else None,
        contact_id=f.contact_id,
        contact_name=f.contact.full_name if f.contact else None,
        meeting_id=f.meeting_id,
        title=f.title,
        description=f.description,
        due_at=f.due_at,
        priority=f.priority,
        status=f.status,
        assigned_to=f.assigned_to,
        completed_at=f.completed_at,
        cancellation_reason=f.cancellation_reason,
        is_overdue=is_overdue,
        timing_label=timing_label,
        created_at=f.created_at,
        updated_at=f.updated_at,
    )


@router.get("/followups", response_model=PaginatedFollowUpsOut)
def list_followups(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search title, description, org, contact"),
    organization_id: Optional[int] = Query(None, description="Filter by organization ID"),
    contact_id: Optional[int] = Query(None, description="Filter by contact ID"),
    meeting_id: Optional[int] = Query(None, description="Filter by meeting ID"),
    status: Optional[str] = Query(None, description="Filter by status: Pending, Completed, Cancelled"),
    priority: Optional[str] = Query(None, description="Filter by priority: High, Medium, Low"),
    due_category: Optional[str] = Query(None, description="Filter by queue: overdue, today, upcoming, completed"),
    owner_scope: str = Query("mine", description="Scope: 'mine' or 'all'"),
    sort_by: str = Query("due_at", description="Sort by: due_at, created_at, priority"),
    sort_order: str = Query("asc", description="Sort direction: asc, desc"),
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve paginated follow-ups with multi-criteria filtering and queue categorizations."""
    query = (
        db.query(FollowUp)
        .join(Organization, FollowUp.organization_id == Organization.id)
        .outerjoin(Contact, FollowUp.contact_id == Contact.id)
        .filter(FollowUp.is_deleted.is_(False))
    )

    # Ownership scoping
    if owner_scope == "mine" and current_user.role != "ADMIN":
        query = query.filter(FollowUp.owner_id == current_user.id)

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(FollowUp.title).like(term),
                func.lower(FollowUp.description).like(term),
                func.lower(Organization.name).like(term),
                func.lower(Contact.first_name).like(term),
                func.lower(Contact.last_name).like(term),
            )
        )

    if organization_id is not None:
        query = query.filter(FollowUp.organization_id == organization_id)

    if contact_id is not None:
        query = query.filter(FollowUp.contact_id == contact_id)

    if meeting_id is not None:
        query = query.filter(FollowUp.meeting_id == meeting_id)

    if status and status.strip() and status.strip().lower() != "all":
        query = query.filter(func.lower(FollowUp.status) == status.strip().lower())

    if priority and priority.strip() and priority.strip().lower() != "all":
        query = query.filter(func.lower(FollowUp.priority) == priority.strip().lower())

    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59, tzinfo=timezone.utc)

    if due_category:
        cat = due_category.strip().lower()
        if cat == "overdue":
            query = query.filter(FollowUp.status == FollowUpStatus.PENDING.value, FollowUp.due_at < today_start)
        elif cat == "today":
            query = query.filter(
                FollowUp.status == FollowUpStatus.PENDING.value,
                FollowUp.due_at >= today_start,
                FollowUp.due_at <= today_end,
            )
        elif cat == "upcoming":
            query = query.filter(FollowUp.status == FollowUpStatus.PENDING.value, FollowUp.due_at > today_end)
        elif cat == "completed":
            query = query.filter(FollowUp.status == FollowUpStatus.COMPLETED.value)

    total = query.count()

    # Sorting
    if sort_by == "created_at":
        sort_col = FollowUp.created_at
    elif sort_by == "priority":
        sort_col = FollowUp.priority
    else:
        sort_col = FollowUp.due_at

    if sort_order.lower() == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    offset = (page - 1) * page_size
    items = (
        query.options(joinedload(FollowUp.organization), joinedload(FollowUp.contact))
        .offset(offset)
        .limit(page_size)
        .all()
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return PaginatedFollowUpsOut(
        items=[_format_followup_out(f) for f in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/followups/grouped", response_model=GroupedFollowUpsOut)
def get_grouped_followups(
    organization_id: Optional[int] = Query(None, description="Optional organization scope"),
    contact_id: Optional[int] = Query(None, description="Optional contact scope"),
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve follow-ups categorized into Overdue, Today, Upcoming, and Completed queues."""
    query = (
        db.query(FollowUp)
        .options(joinedload(FollowUp.organization), joinedload(FollowUp.contact))
        .filter(FollowUp.is_deleted.is_(False))
    )

    if organization_id is not None:
        query = query.filter(FollowUp.organization_id == organization_id)
    if contact_id is not None:
        query = query.filter(FollowUp.contact_id == contact_id)

    all_followups = query.order_by(FollowUp.due_at.asc()).all()

    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59, tzinfo=timezone.utc)

    overdue_list = []
    today_list = []
    upcoming_list = []
    completed_list = []

    for f in all_followups:
        due_at = f.due_at if f.due_at.tzinfo else f.due_at.replace(tzinfo=timezone.utc)
        if f.status == FollowUpStatus.COMPLETED.value:
            completed_list.append(_format_followup_out(f))
        elif f.status == FollowUpStatus.PENDING.value:
            if due_at < today_start:
                overdue_list.append(_format_followup_out(f))
            elif today_start <= due_at <= today_end:
                today_list.append(_format_followup_out(f))
            else:
                upcoming_list.append(_format_followup_out(f))

    return GroupedFollowUpsOut(
        overdue=overdue_list,
        today=today_list,
        upcoming=upcoming_list,
        completed=completed_list,
    )


@router.get("/followups/{id}", response_model=FollowUpOut)
def get_followup(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Retrieve single follow-up details."""
    followup = (
        db.query(FollowUp)
        .options(joinedload(FollowUp.organization), joinedload(FollowUp.contact))
        .filter(FollowUp.id == id, FollowUp.is_deleted.is_(False))
        .first()
    )
    if not followup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Follow-up with ID {id} not found.",
        )
    return _format_followup_out(followup)


@router.post("/followups", response_model=FollowUpOut, status_code=status.HTTP_201_CREATED)
def create_followup(
    payload: FollowUpCreate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Create a new action follow-up linked to an organization, contact, or meeting."""
    org = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Target organization with ID {payload.organization_id} does not exist.",
        )

    if payload.contact_id:
        contact = db.query(Contact).filter(Contact.id == payload.contact_id, Contact.organization_id == payload.organization_id).first()
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected contact does not belong to the target organization.",
            )

    now = datetime.now(timezone.utc)
    new_followup = FollowUp(
        organization_id=payload.organization_id,
        contact_id=payload.contact_id,
        meeting_id=payload.meeting_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        due_at=payload.due_at,
        priority=payload.priority.strip() if payload.priority else FollowUpPriority.MEDIUM.value,
        status=FollowUpStatus.PENDING.value,
        assigned_to=payload.assigned_to.strip() if payload.assigned_to else current_user.name,
        is_deleted=False,
        created_by=current_user.id,
        owner_id=current_user.id,
        created_at=now,
        updated_at=now,
    )

    db.add(new_followup)
    db.commit()
    db.refresh(new_followup)

    # Activity log
    act = ContactActivity(
        activity_type="followup_created",
        description=f"Follow-up task '{new_followup.title}' created (Due: {new_followup.due_at.strftime('%Y-%m-%d')}).",
        contact_id=payload.contact_id,
        organization_id=org.id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(new_followup)

    return _format_followup_out(new_followup)


@router.patch("/followups/{id}", response_model=FollowUpOut)
def update_followup(
    id: int,
    payload: FollowUpUpdate,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Update follow-up task details."""
    followup = db.query(FollowUp).filter(FollowUp.id == id, FollowUp.is_deleted.is_(False)).first()
    if not followup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Follow-up with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        if value is not None and isinstance(value, str):
            setattr(followup, field, value.strip())
        else:
            setattr(followup, field, value)

    followup.updated_at = now
    db.commit()
    db.refresh(followup)

    return _format_followup_out(followup)


@router.post("/followups/{id}/complete", response_model=FollowUpOut)
def complete_followup(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Mark a follow-up as completed and timestamp the resolution."""
    followup = db.query(FollowUp).filter(FollowUp.id == id, FollowUp.is_deleted.is_(False)).first()
    if not followup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Follow-up with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    followup.status = FollowUpStatus.COMPLETED.value
    followup.completed_at = now
    followup.updated_at = now
    db.commit()

    # Activity log
    act = ContactActivity(
        activity_type="followup_completed",
        description=f"Follow-up task '{followup.title}' completed by {current_user.name}.",
        contact_id=followup.contact_id,
        organization_id=followup.organization_id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(followup)

    return _format_followup_out(followup)


@router.post("/followups/{id}/cancel", response_model=FollowUpOut)
def cancel_followup(
    id: int,
    payload: FollowUpCancel,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Cancel a follow-up task with cancellation reason."""
    followup = db.query(FollowUp).filter(FollowUp.id == id, FollowUp.is_deleted.is_(False)).first()
    if not followup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Follow-up with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    followup.status = FollowUpStatus.CANCELLED.value
    followup.cancellation_reason = payload.reason.strip() if payload.reason else "Cancelled by BD team"
    followup.updated_at = now
    db.commit()

    act = ContactActivity(
        activity_type="followup_cancelled",
        description=f"Follow-up task '{followup.title}' cancelled: {followup.cancellation_reason}",
        contact_id=followup.contact_id,
        organization_id=followup.organization_id,
        performed_by=current_user.name,
        created_at=now,
    )
    db.add(act)
    db.commit()
    db.refresh(followup)

    return _format_followup_out(followup)


@router.delete("/followups/{id}")
def delete_followup(
    id: int,
    current_user: User = Depends(require_business_development),
    db: Session = Depends(get_db),
):
    """Soft delete a follow-up."""
    followup = db.query(FollowUp).filter(FollowUp.id == id, FollowUp.is_deleted.is_(False)).first()
    if not followup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Follow-up with ID {id} not found.",
        )

    now = datetime.now(timezone.utc)
    followup.is_deleted = True
    followup.updated_at = now
    db.commit()

    return {"status": "success", "message": f"Follow-up '{followup.title}' deleted successfully."}
