from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.opportunity import Opportunity, OpportunityStage
from app.models.project import Project
from app.models.partnership import (
    Partnership,
    PartnershipType,
    PartnershipStatus,
    PartnershipPriority,
)
from app.models.activity import ContactActivity
from app.models.audit import AuditLog
from app.models.meeting import Meeting
from app.models.followup import FollowUp
from app.models.communication import Communication
from app.schemas.partnership import (
    PartnershipCreate,
    PartnershipUpdate,
    PartnershipStatusUpdate,
    PartnershipOwnerUpdate,
    ConvertToPartnershipIn,
    PartnershipOut,
    PaginatedPartnershipsOut,
    PartnershipStatsOut,
)

router = APIRouter(prefix="/api/business-development/partnerships", tags=["Partnerships"])


def _partnership_to_out(p: Partnership) -> PartnershipOut:
    now = datetime.now(timezone.utc)
    # Check ending soon (within 30 days)
    is_ending_soon = False
    if p.end_date and p.status == PartnershipStatus.ACTIVE.value:
        end_dt = p.end_date if p.end_date.tzinfo else p.end_date.replace(tzinfo=timezone.utc)
        diff_days = (end_dt - now).days
        if 0 <= diff_days <= 30:
            is_ending_soon = True

    # Check needs attention
    needs_attention = False
    if p.status == PartnershipStatus.ACTIVE.value:
        if not p.next_action or not p.next_action.strip():
            needs_attention = True
        elif p.next_action_date:
            na_dt = p.next_action_date if p.next_action_date.tzinfo else p.next_action_date.replace(tzinfo=timezone.utc)
            if na_dt < now:
                needs_attention = True

    contact_name = None
    if p.primary_contact:
        contact_name = f"{p.primary_contact.first_name} {p.primary_contact.last_name or ''}".strip()

    return PartnershipOut(
        id=p.id,
        name=p.name,
        organization_id=p.organization_id,
        organization_name=p.organization.name if p.organization else None,
        opportunity_id=p.opportunity_id,
        opportunity_name=p.opportunity.name if p.opportunity else None,
        primary_contact_id=p.primary_contact_id,
        primary_contact_name=contact_name,
        primary_contact_email=p.primary_contact.email if p.primary_contact else None,
        primary_contact_phone=p.primary_contact.phone if p.primary_contact else None,
        primary_contact_designation=p.primary_contact.designation if p.primary_contact else None,
        project_id=p.project_id,
        project_name=p.project.name if p.project else None,
        owner_id=p.owner_id,
        owner_name=p.owner.name if p.owner else None,
        owner_email=p.owner.email if p.owner else None,
        partnership_type=p.partnership_type,
        status=p.status,
        priority=p.priority,
        start_date=p.start_date,
        end_date=p.end_date,
        objectives=p.objectives,
        description=p.description,
        notes=p.notes,
        next_action=p.next_action,
        next_action_date=p.next_action_date,
        is_deleted=p.is_deleted,
        created_by=p.created_by,
        created_at=p.created_at,
        updated_at=p.updated_at,
        is_ending_soon=is_ending_soon,
        needs_attention=needs_attention,
    )


@router.get("", response_model=PaginatedPartnershipsOut)
def list_partnerships(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    partnership_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    organization_id: Optional[int] = Query(None),
    owner_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    needs_attention: Optional[bool] = Query(None),
    ending_soon: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """List business partnerships with comprehensive filtering, search, and pagination."""
    query = db.query(Partnership).filter(Partnership.is_deleted.is_(False))

    if organization_id:
        query = query.filter(Partnership.organization_id == organization_id)
    if owner_id:
        query = query.filter(Partnership.owner_id == owner_id)
    if project_id:
        query = query.filter(Partnership.project_id == project_id)
    if status and status != "All":
        query = query.filter(Partnership.status == status)
    if partnership_type and partnership_type != "All":
        query = query.filter(Partnership.partnership_type == partnership_type)
    if priority and priority != "All":
        query = query.filter(Partnership.priority == priority)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.join(Partnership.organization, isouter=True).join(Partnership.primary_contact, isouter=True).join(Partnership.project, isouter=True).join(Partnership.owner, isouter=True).filter(
            or_(
                Partnership.name.ilike(term),
                Partnership.description.ilike(term),
                Partnership.objectives.ilike(term),
                Partnership.next_action.ilike(term),
                Organization.name.ilike(term),
                Contact.first_name.ilike(term),
                Contact.last_name.ilike(term),
                Project.name.ilike(term),
                User.name.ilike(term),
            )
        )

    now = datetime.now(timezone.utc)
    if ending_soon is True:
        thirty_days = now + timedelta(days=30)
        query = query.filter(
            Partnership.status == PartnershipStatus.ACTIVE.value,
            Partnership.end_date.isnot(None),
            Partnership.end_date >= now,
            Partnership.end_date <= thirty_days,
        )

    if needs_attention is True:
        query = query.filter(
            Partnership.status == PartnershipStatus.ACTIVE.value,
            or_(
                Partnership.next_action.is_(None),
                Partnership.next_action == "",
                and_(
                    Partnership.next_action_date.isnot(None),
                    Partnership.next_action_date < now,
                ),
            ),
        )

    total = query.count()
    items = query.order_by(desc(Partnership.created_at)).offset((page - 1) * page_size).limit(page_size).all()
    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedPartnershipsOut(
        items=[_partnership_to_out(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/stats", response_model=PartnershipStatsOut)
def get_partnership_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Retrieve aggregated partnership analytics and indicators."""
    partnerships = db.query(Partnership).filter(Partnership.is_deleted.is_(False)).all()

    now = datetime.now(timezone.utc)
    total_partnerships = len(partnerships)
    active_partnerships = 0
    on_hold_partnerships = 0
    completed_partnerships = 0
    ended_partnerships = 0
    ending_soon_count = 0
    needs_attention_count = 0
    new_this_month = 0

    by_type: Dict[str, int] = {}
    by_owner: Dict[str, int] = {}
    by_project: Dict[str, int] = {}

    first_day_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    for p in partnerships:
        # Status counts
        if p.status == PartnershipStatus.ACTIVE.value:
            active_partnerships += 1
        elif p.status == PartnershipStatus.ON_HOLD.value:
            on_hold_partnerships += 1
        elif p.status == PartnershipStatus.COMPLETED.value:
            completed_partnerships += 1
        elif p.status == PartnershipStatus.ENDED.value:
            ended_partnerships += 1

        # Type breakdown
        by_type[p.partnership_type] = by_type.get(p.partnership_type, 0) + 1

        # Owner breakdown
        owner_label = p.owner.name if p.owner else "Unassigned"
        by_owner[owner_label] = by_owner.get(owner_label, 0) + 1

        # Project breakdown
        if p.project:
            by_project[p.project.name] = by_project.get(p.project.name, 0) + 1

        # Ending soon
        if p.end_date and p.status == PartnershipStatus.ACTIVE.value:
            end_dt = p.end_date if p.end_date.tzinfo else p.end_date.replace(tzinfo=timezone.utc)
            if 0 <= (end_dt - now).days <= 30:
                ending_soon_count += 1

        # Needs attention
        if p.status == PartnershipStatus.ACTIVE.value:
            if not p.next_action or not p.next_action.strip():
                needs_attention_count += 1
            elif p.next_action_date:
                na_dt = p.next_action_date if p.next_action_date.tzinfo else p.next_action_date.replace(tzinfo=timezone.utc)
                if na_dt < now:
                    needs_attention_count += 1

        # New this month
        created_dt = p.created_at if p.created_at.tzinfo else p.created_at.replace(tzinfo=timezone.utc)
        if created_dt >= first_day_of_month:
            new_this_month += 1

    return PartnershipStatsOut(
        total_partnerships=total_partnerships,
        active_partnerships=active_partnerships,
        on_hold_partnerships=on_hold_partnerships,
        completed_partnerships=completed_partnerships,
        ended_partnerships=ended_partnerships,
        ending_soon_count=ending_soon_count,
        needs_attention_count=needs_attention_count,
        new_this_month=new_this_month,
        by_type=by_type,
        by_owner=by_owner,
        by_project=by_project,
    )


@router.get("/{id}", response_model=PartnershipOut)
def get_partnership(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Retrieve detailed information for a single partnership."""
    p = db.query(Partnership).filter(Partnership.id == id, Partnership.is_deleted.is_(False)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Partnership not found")
    return _partnership_to_out(p)


@router.post("", response_model=PartnershipOut, status_code=status.HTTP_201_CREATED)
def create_partnership(
    payload: PartnershipCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Create a new formal business partnership record."""
    # 1. Validate Organization
    org = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # 2. Validate Contact belongs to Organization
    if payload.primary_contact_id:
        contact = db.query(Contact).filter(Contact.id == payload.primary_contact_id, Contact.is_deleted.is_(False)).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Primary contact not found")
        if contact.organization_id != org.id:
            raise HTTPException(status_code=400, detail="Primary contact does not belong to the selected organization")

    # 3. Validate Opportunity belongs to Organization
    if payload.opportunity_id:
        opp = db.query(Opportunity).filter(Opportunity.id == payload.opportunity_id, Opportunity.is_deleted.is_(False)).first()
        if not opp:
            raise HTTPException(status_code=404, detail="Opportunity not found")
        if opp.organization_id != org.id:
            raise HTTPException(status_code=400, detail="Opportunity does not belong to the selected organization")

    # 4. Validate Project if provided
    if payload.project_id:
        proj = db.query(Project).filter(Project.id == payload.project_id).first()
        if not proj:
            raise HTTPException(status_code=404, detail="Showcase project not found")

    # 5. Validate Owner if provided
    if payload.owner_id:
        owner = db.query(User).filter(User.id == payload.owner_id).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Assigned owner user not found")

    # 6. Validate Dates
    start = payload.start_date or datetime.now(timezone.utc)
    if payload.end_date and payload.end_date < start:
        raise HTTPException(status_code=400, detail="End date cannot be before start date")

    # 7. Duplicate Check
    if not payload.allow_duplicate:
        existing = db.query(Partnership).filter(
            Partnership.organization_id == org.id,
            func.lower(Partnership.name) == payload.name.strip().lower(),
            Partnership.is_deleted.is_(False),
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"A partnership named '{payload.name}' already exists for {org.name}. Set allow_duplicate=true to override.",
            )

    # 8. Create Partnership
    partnership = Partnership(
        organization_id=org.id,
        opportunity_id=payload.opportunity_id,
        primary_contact_id=payload.primary_contact_id,
        project_id=payload.project_id,
        owner_id=payload.owner_id or current_user.id,
        name=payload.name.strip(),
        partnership_type=payload.partnership_type,
        status=payload.status,
        priority=payload.priority,
        start_date=start,
        end_date=payload.end_date,
        objectives=payload.objectives.strip() if payload.objectives else None,
        description=payload.description.strip() if payload.description else None,
        notes=payload.notes.strip() if payload.notes else None,
        next_action=payload.next_action.strip() if payload.next_action else None,
        next_action_date=payload.next_action_date,
        created_by=current_user.name,
    )
    db.add(partnership)
    db.flush()

    # 9. Record Contact Activity if contact linked
    if payload.primary_contact_id:
        activity = ContactActivity(
            contact_id=payload.primary_contact_id,
            organization_id=org.id,
            opportunity_id=payload.opportunity_id,
            performed_by=current_user.name,
            activity_type="partnership_created",
            description=f"Partnership established: {partnership.name} ({partnership.partnership_type})",
        )
        db.add(activity)

    # 10. Record Security Audit
    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="PARTNERSHIP_CREATED",
        resource_type="partnership",
        resource_id=partnership.id,
        metadata_json=f"Created {partnership.partnership_type} '{partnership.name}' for Organization ID {org.id}",
    )
    db.add(audit)
    db.commit()
    db.refresh(partnership)

    return _partnership_to_out(partnership)


@router.patch("/{id}", response_model=PartnershipOut)
def update_partnership(
    id: int,
    payload: PartnershipUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Update fields on an existing partnership."""
    p = db.query(Partnership).filter(Partnership.id == id, Partnership.is_deleted.is_(False)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Partnership not found")

    # Validate contact if changed
    if payload.primary_contact_id is not None:
        if payload.primary_contact_id > 0:
            contact = db.query(Contact).filter(Contact.id == payload.primary_contact_id, Contact.is_deleted.is_(False)).first()
            if not contact or contact.organization_id != p.organization_id:
                raise HTTPException(status_code=400, detail="Primary contact does not belong to partnership organization")
            p.primary_contact_id = payload.primary_contact_id
        else:
            p.primary_contact_id = None

    # Validate project if changed
    if payload.project_id is not None:
        if payload.project_id > 0:
            proj = db.query(Project).filter(Project.id == payload.project_id).first()
            if not proj:
                raise HTTPException(status_code=404, detail="Project not found")
            p.project_id = payload.project_id
        else:
            p.project_id = None

    # Validate owner if changed
    if payload.owner_id is not None:
        if payload.owner_id > 0:
            owner = db.query(User).filter(User.id == payload.owner_id).first()
            if not owner:
                raise HTTPException(status_code=404, detail="Owner user not found")
            p.owner_id = payload.owner_id
        else:
            p.owner_id = None

    if payload.name is not None:
        p.name = payload.name.strip()
    if payload.partnership_type is not None:
        p.partnership_type = payload.partnership_type
    if payload.status is not None:
        p.status = payload.status
    if payload.priority is not None:
        p.priority = payload.priority
    if payload.start_date is not None:
        p.start_date = payload.start_date
    if payload.end_date is not None:
        if p.start_date and payload.end_date < p.start_date:
            raise HTTPException(status_code=400, detail="End date cannot be before start date")
        p.end_date = payload.end_date
    if payload.objectives is not None:
        p.objectives = payload.objectives.strip() or None
    if payload.description is not None:
        p.description = payload.description.strip() or None
    if payload.notes is not None:
        p.notes = payload.notes.strip() or None
    if payload.next_action is not None:
        p.next_action = payload.next_action.strip() or None
    if payload.next_action_date is not None:
        p.next_action_date = payload.next_action_date

    p.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)
    return _partnership_to_out(p)


@router.patch("/{id}/status", response_model=PartnershipOut)
def update_partnership_status(
    id: int,
    payload: PartnershipStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Explicitly transition partnership status (Active, On Hold, Completed, Ended)."""
    p = db.query(Partnership).filter(Partnership.id == id, Partnership.is_deleted.is_(False)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Partnership not found")

    old_status = p.status
    p.status = payload.status
    if payload.notes:
        append_note = f"\n[{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}] Status changed from {old_status} to {payload.status}: {payload.notes}"
        p.notes = (p.notes or "") + append_note

    p.updated_at = datetime.now(timezone.utc)

    # Record Contact Activity
    if p.primary_contact_id:
        activity = ContactActivity(
            contact_id=p.primary_contact_id,
            organization_id=p.organization_id,
            opportunity_id=p.opportunity_id,
            performed_by=current_user.name,
            activity_type="partnership_status_updated",
            description=f"Partnership '{p.name}' status moved from {old_status} to {p.status}",
        )
        db.add(activity)

    db.commit()
    db.refresh(p)
    return _partnership_to_out(p)


@router.patch("/{id}/owner", response_model=PartnershipOut)
def update_partnership_owner(
    id: int,
    payload: PartnershipOwnerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Assign or reassign internal BD owner for a partnership."""
    p = db.query(Partnership).filter(Partnership.id == id, Partnership.is_deleted.is_(False)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Partnership not found")

    if payload.owner_id:
        owner = db.query(User).filter(User.id == payload.owner_id).first()
        if not owner:
            raise HTTPException(status_code=404, detail="Owner user not found")
        p.owner_id = payload.owner_id
    else:
        p.owner_id = None

    p.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)
    return _partnership_to_out(p)


@router.delete("/{id}")
def delete_partnership(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Soft delete / archive a partnership without deleting historical meetings or opportunities."""
    p = db.query(Partnership).filter(Partnership.id == id, Partnership.is_deleted.is_(False)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Partnership not found")

    p.is_deleted = True
    p.updated_at = datetime.now(timezone.utc)

    # Log audit
    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="PARTNERSHIP_DELETED",
        resource_type="partnership",
        resource_id=p.id,
        metadata_json=f"Archived partnership '{p.name}' (ID {p.id})",
    )
    db.add(audit)
    db.commit()
    return {"message": "Partnership deleted successfully", "id": id}


@router.post("/convert-from-opportunity/{opportunity_id}", response_model=PartnershipOut, status_code=status.HTTP_201_CREATED)
def convert_opportunity_to_partnership(
    opportunity_id: int,
    payload: ConvertToPartnershipIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """Convert an existing Opportunity into a formal Partnership relationship."""
    opp = db.query(Opportunity).filter(Opportunity.id == opportunity_id, Opportunity.is_deleted.is_(False)).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")

    org = db.query(Organization).filter(Organization.id == opp.organization_id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization associated with opportunity not found")

    partner_name = (payload.name or f"{opp.name} Partnership").strip()

    # Check duplicate
    if not payload.allow_duplicate:
        existing = db.query(Partnership).filter(
            Partnership.organization_id == org.id,
            func.lower(Partnership.name) == partner_name.lower(),
            Partnership.is_deleted.is_(False),
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"A partnership named '{partner_name}' already exists for {org.name}.",
            )

    start = payload.start_date or datetime.now(timezone.utc)
    if payload.end_date and payload.end_date < start:
        raise HTTPException(status_code=400, detail="End date cannot be before start date")

    # 1. Create Partnership
    partnership = Partnership(
        organization_id=org.id,
        opportunity_id=opp.id,
        primary_contact_id=opp.primary_contact_id,
        project_id=opp.project_id,
        owner_id=payload.owner_id or opp.owner_id or current_user.id,
        name=partner_name,
        partnership_type=payload.partnership_type,
        status=PartnershipStatus.ACTIVE.value,
        priority=payload.priority or opp.priority,
        start_date=start,
        end_date=payload.end_date,
        objectives=payload.objectives.strip() if payload.objectives else (opp.description or None),
        description=payload.description.strip() if payload.description else (opp.description or None),
        notes=payload.notes.strip() if payload.notes else (opp.notes or None),
        next_action=payload.next_action.strip() if payload.next_action else opp.next_action,
        next_action_date=payload.next_action_date or opp.next_action_date,
        created_by=current_user.name,
    )
    db.add(partnership)
    db.flush()

    # 2. Update Opportunity stage to Partnership (retaining historical record)
    opp.stage = OpportunityStage.PARTNERSHIP.value
    opp.updated_at = datetime.now(timezone.utc)

    # 3. Update Organization status to Partnership if requested
    if payload.update_organization_status:
        org.status = "Partnership"
        org.updated_at = datetime.now(timezone.utc)

    # 4. Record Activity
    if opp.primary_contact_id:
        activity = ContactActivity(
            contact_id=opp.primary_contact_id,
            organization_id=org.id,
            opportunity_id=opp.id,
            performed_by=current_user.name,
            activity_type="opportunity_converted_to_partnership",
            description=f"Opportunity '{opp.name}' successfully converted into Partnership '{partnership.name}'",
        )
        db.add(activity)

    # 5. Record Audit Log
    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="OPPORTUNITY_CONVERTED_TO_PARTNERSHIP",
        resource_type="partnership",
        resource_id=partnership.id,
        metadata_json=f"Converted Opportunity ID {opp.id} into Partnership '{partnership.name}' for Org ID {org.id}",
    )
    db.add(audit)
    db.commit()
    db.refresh(partnership)

    return _partnership_to_out(partnership)
