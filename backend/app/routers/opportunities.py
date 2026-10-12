from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.project import Project
from app.models.opportunity import Opportunity, OpportunityStage, OpportunityPriority
from app.models.activity import ContactActivity
from app.models.meeting import Meeting
from app.models.followup import FollowUp
from app.models.task import BDTask, TaskPriority, TaskStatus
from app.schemas.opportunity import (
    OpportunityCreate,
    OpportunityUpdate,
    OpportunityStageUpdate,
    OpportunityOwnerUpdate,
    OpportunityNoteCreate,
    OpportunityOut,
    OpportunityDetailOut,
    PaginatedOpportunitiesOut,
    OpportunityActivityOut,
    OpportunityMeetingSummary,
    OpportunityFollowUpSummary,
)

router = APIRouter(
    prefix="/api/business-development/opportunities",
    tags=["Opportunities"],
    dependencies=[Depends(require_business_development)],
)


def _enrich_opportunity_out(opp: Opportunity, db: Session) -> OpportunityOut:
    org_name = None
    if opp.organization_id:
        org = db.query(Organization).filter(Organization.id == opp.organization_id).first()
        org_name = org.name if org else None

    primary_contact_name = None
    primary_contact_designation = None
    if opp.primary_contact_id:
        contact = db.query(Contact).filter(Contact.id == opp.primary_contact_id).first()
        if contact:
            primary_contact_name = contact.full_name
            primary_contact_designation = contact.designation

    project_title = None
    if opp.project_id:
        proj = db.query(Project).filter(Project.id == opp.project_id).first()
        project_title = proj.name if proj else None

    owner_name = None
    if opp.owner_id:
        owner = db.query(User).filter(User.id == opp.owner_id).first()
        owner_name = owner.name if owner else None

    has_next_action = bool(opp.next_action and opp.next_action.strip())

    return OpportunityOut(
        id=opp.id,
        organization_id=opp.organization_id,
        primary_contact_id=opp.primary_contact_id,
        project_id=opp.project_id,
        owner_id=opp.owner_id,
        name=opp.name,
        description=opp.description,
        stage=opp.stage,
        priority=opp.priority,
        estimated_value=opp.estimated_value,
        currency=opp.currency or "USD",
        probability=opp.probability,
        expected_close_date=opp.expected_close_date,
        next_action=opp.next_action,
        next_action_date=opp.next_action_date,
        notes=opp.notes,
        created_by=opp.created_by,
        created_at=opp.created_at,
        updated_at=opp.updated_at,
        organization_name=org_name,
        primary_contact_name=primary_contact_name,
        primary_contact_designation=primary_contact_designation,
        project_title=project_title,
        owner_name=owner_name,
        has_next_action=has_next_action,
    )


@router.get("", response_model=PaginatedOpportunitiesOut)
def list_opportunities(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    search: Optional[str] = None,
    organization_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    project_id: Optional[int] = None,
    owner_id: Optional[int] = None,
    stage: Optional[str] = None,
    priority: Optional[str] = None,
    no_next_action: Optional[bool] = None,
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    query = db.query(Opportunity).filter(Opportunity.is_deleted.is_(False))

    if organization_id:
        query = query.filter(Opportunity.organization_id == organization_id)
    if contact_id:
        query = query.filter(Opportunity.primary_contact_id == contact_id)
    if project_id:
        query = query.filter(Opportunity.project_id == project_id)
    if owner_id:
        query = query.filter(Opportunity.owner_id == owner_id)
    if stage and stage != "All":
        query = query.filter(Opportunity.stage == stage)
    if priority and priority != "All":
        query = query.filter(Opportunity.priority == priority)

    if no_next_action is True:
        query = query.filter(
            or_(
                Opportunity.next_action.is_(None),
                Opportunity.next_action == "",
            )
        )

    if search and search.strip():
        term = f"%{search.strip()}%"
        # Search opportunity name, description, next_action, and join organization/contact
        query = (
            query.outerjoin(Organization, Opportunity.organization_id == Organization.id)
            .outerjoin(Contact, Opportunity.primary_contact_id == Contact.id)
            .outerjoin(Project, Opportunity.project_id == Project.id)
            .outerjoin(User, Opportunity.owner_id == User.id)
            .filter(
                or_(
                    Opportunity.name.ilike(term),
                    Opportunity.description.ilike(term),
                    Opportunity.next_action.ilike(term),
                    Organization.name.ilike(term),
                    Contact.first_name.ilike(term),
                    Contact.last_name.ilike(term),
                    Project.name.ilike(term),
                    User.name.ilike(term),
                )
            )
        )

    # Sort
    sort_col = getattr(Opportunity, sort_by, Opportunity.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))

    total = query.count()
    offset = (page - 1) * page_size
    opps = query.offset(offset).limit(page_size).all()

    # Calculate statistics across all active opportunities
    base_all = db.query(Opportunity).filter(Opportunity.is_deleted.is_(False))
    if organization_id:
        base_all = base_all.filter(Opportunity.organization_id == organization_id)
    no_next_action_count = base_all.filter(
        or_(Opportunity.next_action.is_(None), Opportunity.next_action == "")
    ).count()
    active_count = base_all.filter(Opportunity.stage != OpportunityStage.PARTNERSHIP.value).count()
    high_priority_count = base_all.filter(Opportunity.priority == OpportunityPriority.HIGH.value).count()

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1

    return PaginatedOpportunitiesOut(
        items=[_enrich_opportunity_out(opp, db) for opp in opps],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        no_next_action_count=no_next_action_count,
        active_count=active_count,
        high_priority_count=high_priority_count,
    )


@router.post("", response_model=OpportunityOut, status_code=status.HTTP_201_CREATED)
def create_opportunity(
    payload: OpportunityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    # 1. Validate Organization exists
    org = db.query(Organization).filter(
        Organization.id == payload.organization_id,
        Organization.is_deleted.is_(False),
    ).first()
    if not org:
        raise HTTPException(status_code=400, detail="Target organization does not exist.")

    # 2. Validate Contact if supplied belongs to Organization
    if payload.primary_contact_id:
        contact = db.query(Contact).filter(
            Contact.id == payload.primary_contact_id,
            Contact.is_deleted.is_(False),
        ).first()
        if not contact:
            raise HTTPException(status_code=400, detail="Specified primary contact does not exist.")
        if contact.organization_id != payload.organization_id:
            raise HTTPException(
                status_code=400,
                detail="Selected contact does not belong to the specified organization.",
            )

    # 3. Validate Project if supplied
    if payload.project_id:
        proj = db.query(Project).filter(
            Project.id == payload.project_id,
            Project.is_deleted.is_(False),
        ).first()
        if not proj:
            raise HTTPException(status_code=400, detail="Associated showcase project does not exist.")

    # 4. Validate Owner if supplied
    if payload.owner_id:
        owner = db.query(User).filter(User.id == payload.owner_id).first()
        if not owner:
            raise HTTPException(status_code=400, detail="Assigned owner does not exist.")

    # 5. Check Duplicate Opportunity Warning / Prevention
    existing_dup = db.query(Opportunity).filter(
        Opportunity.organization_id == payload.organization_id,
        Opportunity.name.ilike(payload.name.strip()),
        Opportunity.is_deleted.is_(False),
    ).first()
    if existing_dup:
        raise HTTPException(
            status_code=400,
            detail=f"An active opportunity '{payload.name}' already exists for {org.name}.",
        )

    # Create Opportunity
    opp = Opportunity(
        organization_id=payload.organization_id,
        primary_contact_id=payload.primary_contact_id,
        project_id=payload.project_id,
        owner_id=payload.owner_id or current_user.id,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        stage=payload.stage or OpportunityStage.POTENTIAL.value,
        priority=payload.priority or OpportunityPriority.MEDIUM.value,
        estimated_value=payload.estimated_value,
        currency=payload.currency or "USD",
        probability=payload.probability,
        expected_close_date=payload.expected_close_date,
        next_action=payload.next_action.strip() if payload.next_action else None,
        next_action_date=payload.next_action_date,
        notes=payload.notes.strip() if payload.notes else None,
        created_by=current_user.name,
    )
    db.add(opp)
    db.commit()
    db.refresh(opp)

    # Record Activity
    activity = ContactActivity(
        activity_type="opportunity_created",
        description=f"Created opportunity '{opp.name}' at stage '{opp.stage}' (Priority: {opp.priority})",
        organization_id=opp.organization_id,
        contact_id=opp.primary_contact_id,
        opportunity_id=opp.id,
        performed_by=current_user.name,
    )
    db.add(activity)
    db.commit()

    return _enrich_opportunity_out(opp, db)


@router.get("/{id}", response_model=OpportunityDetailOut)
def get_opportunity(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    opp = db.query(Opportunity).filter(
        Opportunity.id == id,
        Opportunity.is_deleted.is_(False),
    ).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    base_out = _enrich_opportunity_out(opp, db)

    # Linked Activities
    activities = (
        db.query(ContactActivity)
        .filter(ContactActivity.opportunity_id == opp.id)
        .order_by(desc(ContactActivity.created_at))
        .limit(50)
        .all()
    )
    act_out = [
        OpportunityActivityOut(
            id=a.id,
            activity_type=a.activity_type,
            description=a.description,
            performed_by=a.performed_by,
            created_at=a.created_at,
        )
        for a in activities
    ]

    # Linked Meetings
    meetings = (
        db.query(Meeting)
        .filter(Meeting.opportunity_id == opp.id, Meeting.is_deleted.is_(False))
        .order_by(desc(Meeting.scheduled_at))
        .all()
    )
    meet_out = [
        OpportunityMeetingSummary(
            id=m.id,
            title=m.title,
            meeting_type=m.meeting_type,
            scheduled_at=m.scheduled_at,
            status=m.status,
        )
        for m in meetings
    ]

    # Linked Follow-ups
    followups = (
        db.query(FollowUp)
        .filter(FollowUp.opportunity_id == opp.id, FollowUp.is_deleted.is_(False))
        .order_by(asc(FollowUp.due_at))
        .all()
    )
    fol_out = [
        OpportunityFollowUpSummary(
            id=f.id,
            title=f.title,
            due_at=f.due_at,
            priority=f.priority,
            status=f.status,
        )
        for f in followups
    ]

    return OpportunityDetailOut(
        **base_out.model_dump(),
        activities=act_out,
        meetings=meet_out,
        followups=fol_out,
    )


def _create_next_step_task(db: Session, opp: Opportunity, old_stage: str, new_stage: str, created_by_name: str) -> None:
    """Auto-task on stage change: gives the owner a concrete next step instead of a bare notification."""
    if not opp.owner_id:
        return
    task = BDTask(
        title=f"Next step: {opp.name} -> {new_stage}",
        description=f"Opportunity moved from '{old_stage}' to '{new_stage}'. Define and execute the next action.",
        priority=TaskPriority.HIGH.value if new_stage in (OpportunityStage.NEGOTIATION.value, OpportunityStage.PROPOSAL.value) else TaskPriority.MEDIUM.value,
        status=TaskStatus.TODO.value,
        due_date=datetime.now(timezone.utc) + timedelta(days=2),
        entity_type="opportunity",
        entity_id=opp.id,
        owner_id=opp.owner_id,
        created_by=created_by_name,
    )
    db.add(task)
    db.commit()


@router.patch("/{id}", response_model=OpportunityOut)
def update_opportunity(
    id: int,
    payload: OpportunityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    opp = db.query(Opportunity).filter(
        Opportunity.id == id,
        Opportunity.is_deleted.is_(False),
    ).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    changes = []

    if payload.name is not None and payload.name.strip() != opp.name:
        changes.append(f"Renamed to '{payload.name.strip()}'")
        opp.name = payload.name.strip()

    if payload.primary_contact_id is not None and payload.primary_contact_id != opp.primary_contact_id:
        contact = db.query(Contact).filter(
            Contact.id == payload.primary_contact_id,
            Contact.is_deleted.is_(False),
        ).first()
        if not contact or contact.organization_id != opp.organization_id:
            raise HTTPException(
                status_code=400,
                detail="Selected contact does not exist or does not belong to this organization.",
            )
        opp.primary_contact_id = payload.primary_contact_id
        changes.append(f"Primary contact updated to {contact.full_name}")

    if payload.project_id is not None and payload.project_id != opp.project_id:
        proj = db.query(Project).filter(
            Project.id == payload.project_id,
            Project.is_deleted.is_(False),
        ).first()
        if not proj:
            raise HTTPException(status_code=400, detail="Showcase project does not exist.")
        opp.project_id = payload.project_id
        changes.append(f"Associated project set to '{proj.title}'")

    if payload.owner_id is not None and payload.owner_id != opp.owner_id:
        owner = db.query(User).filter(User.id == payload.owner_id).first()
        if not owner:
            raise HTTPException(status_code=400, detail="Owner not found.")
        opp.owner_id = payload.owner_id
        changes.append(f"Owner assigned to {owner.name}")

    stage_changed_from: Optional[str] = None
    if payload.stage is not None and payload.stage != opp.stage:
        stage_changed_from = opp.stage
        opp.stage = payload.stage
        changes.append(f"Stage changed from '{stage_changed_from}' to '{payload.stage}'")

    if payload.priority is not None and payload.priority != opp.priority:
        opp.priority = payload.priority
        changes.append(f"Priority set to {payload.priority}")

    if payload.estimated_value is not None:
        opp.estimated_value = payload.estimated_value
    if payload.currency is not None:
        opp.currency = payload.currency
    if payload.probability is not None:
        opp.probability = payload.probability
    if payload.expected_close_date is not None:
        opp.expected_close_date = payload.expected_close_date
    if payload.next_action is not None:
        opp.next_action = payload.next_action.strip() if payload.next_action else None
    if payload.next_action_date is not None:
        opp.next_action_date = payload.next_action_date
    if payload.description is not None:
        opp.description = payload.description.strip() if payload.description else None
    if payload.notes is not None:
        opp.notes = payload.notes.strip() if payload.notes else None

    opp.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(opp)

    if changes:
        activity = ContactActivity(
            activity_type="opportunity_updated",
            description=f"Opportunity '{opp.name}' updated: {', '.join(changes)}",
            organization_id=opp.organization_id,
            contact_id=opp.primary_contact_id,
            opportunity_id=opp.id,
            performed_by=current_user.name,
        )
        db.add(activity)
        db.commit()

    if stage_changed_from is not None:
        _create_next_step_task(db, opp, stage_changed_from, opp.stage, current_user.name)

    return _enrich_opportunity_out(opp, db)


@router.patch("/{id}/stage", response_model=OpportunityOut)
def update_opportunity_stage(
    id: int,
    payload: OpportunityStageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    opp = db.query(Opportunity).filter(
        Opportunity.id == id,
        Opportunity.is_deleted.is_(False),
    ).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    old_stage = opp.stage
    opp.stage = payload.stage
    opp.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(opp)

    desc_text = f"Opportunity stage changed from '{old_stage}' to '{payload.stage}'."
    if payload.note and payload.note.strip():
        desc_text += f" Note: {payload.note.strip()}"

    activity = ContactActivity(
        activity_type="opportunity_stage_changed",
        description=desc_text,
        organization_id=opp.organization_id,
        contact_id=opp.primary_contact_id,
        opportunity_id=opp.id,
        performed_by=current_user.name,
    )
    db.add(activity)
    db.commit()

    _create_next_step_task(db, opp, old_stage, opp.stage, current_user.name)

    return _enrich_opportunity_out(opp, db)


@router.patch("/{id}/owner", response_model=OpportunityOut)
def update_opportunity_owner(
    id: int,
    payload: OpportunityOwnerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    opp = db.query(Opportunity).filter(
        Opportunity.id == id,
        Opportunity.is_deleted.is_(False),
    ).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    owner = db.query(User).filter(User.id == payload.owner_id).first()
    if not owner:
        raise HTTPException(status_code=400, detail="Owner user not found.")

    opp.owner_id = owner.id
    opp.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(opp)

    desc_text = f"Opportunity owner changed to {owner.name}."
    if payload.note and payload.note.strip():
        desc_text += f" Note: {payload.note.strip()}"

    activity = ContactActivity(
        activity_type="opportunity_owner_changed",
        description=desc_text,
        organization_id=opp.organization_id,
        contact_id=opp.primary_contact_id,
        opportunity_id=opp.id,
        performed_by=current_user.name,
    )
    db.add(activity)
    db.commit()

    return _enrich_opportunity_out(opp, db)


@router.post("/{id}/notes", response_model=OpportunityOut)
def add_opportunity_note(
    id: int,
    payload: OpportunityNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    opp = db.query(Opportunity).filter(
        Opportunity.id == id,
        Opportunity.is_deleted.is_(False),
    ).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    timestamp_header = f"[{datetime.now(timezone.utc).strftime('%d %b %Y, %H:%M')} - {current_user.name}]"
    new_note_entry = f"{timestamp_header}\n{payload.note.strip()}"

    if opp.notes:
        opp.notes = f"{opp.notes}\n\n{new_note_entry}"
    else:
        opp.notes = new_note_entry

    opp.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(opp)

    activity = ContactActivity(
        activity_type="opportunity_note_added",
        description=f"Added internal note to opportunity '{opp.name}'.",
        organization_id=opp.organization_id,
        contact_id=opp.primary_contact_id,
        opportunity_id=opp.id,
        performed_by=current_user.name,
    )
    db.add(activity)
    db.commit()

    return _enrich_opportunity_out(opp, db)


@router.delete("/{id}")
def delete_opportunity(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    opp = db.query(Opportunity).filter(
        Opportunity.id == id,
        Opportunity.is_deleted.is_(False),
    ).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    opp.is_deleted = True
    opp.updated_at = datetime.now(timezone.utc)
    db.commit()

    activity = ContactActivity(
        activity_type="opportunity_deleted",
        description=f"Deleted opportunity '{opp.name}'.",
        organization_id=opp.organization_id,
        contact_id=opp.primary_contact_id,
        opportunity_id=opp.id,
        performed_by=current_user.name,
    )
    db.add(activity)
    db.commit()

    return {"status": "success", "message": f"Opportunity '{opp.name}' has been deleted."}


@router.post("/{id}/convert-to-partnership", status_code=status.HTTP_201_CREATED)
def convert_opportunity_to_partnership_endpoint(
    id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    from app.models.partnership import Partnership, PartnershipStatus
    from app.models.audit import AuditLog
    from app.schemas.partnership import ConvertToPartnershipIn
    from app.routers.partnerships import _partnership_to_out

    converted_payload = ConvertToPartnershipIn(**payload) if payload else ConvertToPartnershipIn()

    opp = db.query(Opportunity).filter(Opportunity.id == id, Opportunity.is_deleted.is_(False)).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found.")

    org = db.query(Organization).filter(Organization.id == opp.organization_id, Organization.is_deleted.is_(False)).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization associated with opportunity not found.")

    partner_name = (converted_payload.name or f"{opp.name} Partnership").strip()

    # Create partnership
    partnership = Partnership(
        organization_id=org.id,
        opportunity_id=opp.id,
        primary_contact_id=opp.primary_contact_id,
        project_id=opp.project_id,
        owner_id=converted_payload.owner_id or opp.owner_id or current_user.id,
        name=partner_name,
        partnership_type=converted_payload.partnership_type,
        status=PartnershipStatus.ACTIVE.value,
        priority=converted_payload.priority or opp.priority,
        start_date=converted_payload.start_date or datetime.now(timezone.utc),
        end_date=converted_payload.end_date,
        objectives=converted_payload.objectives or opp.description,
        description=converted_payload.description or opp.description,
        notes=converted_payload.notes or opp.notes,
        next_action=converted_payload.next_action or opp.next_action,
        next_action_date=converted_payload.next_action_date or opp.next_action_date,
        created_by=current_user.name,
    )
    db.add(partnership)
    db.flush()

    opp.stage = OpportunityStage.PARTNERSHIP.value
    opp.updated_at = datetime.now(timezone.utc)

    if converted_payload.update_organization_status:
        org.status = "Partnership"
        org.updated_at = datetime.now(timezone.utc)

    if opp.primary_contact_id:
        activity = ContactActivity(
            contact_id=opp.primary_contact_id,
            organization_id=org.id,
            opportunity_id=opp.id,
            performed_by=current_user.name,
            activity_type="opportunity_converted_to_partnership",
            description=f"Opportunity '{opp.name}' converted into Partnership '{partnership.name}'",
        )
        db.add(activity)

    audit = AuditLog(
        user_id=current_user.id,
        user_email=current_user.email,
        action="OPPORTUNITY_CONVERTED_TO_PARTNERSHIP",
        resource_type="partnership",
        resource_id=partnership.id,
        metadata_json=f"Converted Opportunity ID {opp.id} into Partnership '{partnership.name}'",
    )
    db.add(audit)
    db.commit()
    db.refresh(partnership)

    return _partnership_to_out(partnership)
