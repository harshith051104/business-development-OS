from datetime import datetime, timezone
from typing import List, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.organization import Organization, ConnectionStatus
from app.models.contact import Contact
from app.models.activity import ContactActivity
from app.models.followup import FollowUp, FollowUpStatus
from app.models.opportunity import Opportunity
from app.schemas.opportunity import KanbanBoardOut, KanbanColumnOut, KanbanCardOut, MoveStageInput
from app.schemas.organization import OrganizationOut

router = APIRouter(
    prefix="/api/business-development/connections",
    tags=["Connections Pipeline"],
    dependencies=[Depends(require_business_development)],
)

PIPELINE_STAGES = [
    "Potential",
    "Contacted",
    "Connected",
    "Interested",
    "Meeting",
    "Discussion",
    "Partnership",
]


@router.get("/pipeline", response_model=KanbanBoardOut)
def get_connections_pipeline(
    search: str = Query(None),
    priority: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    query = db.query(Organization).filter(Organization.is_deleted.is_(False))

    if priority and priority != "All":
        query = query.filter(Organization.priority == priority)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            Organization.name.ilike(term)
            | Organization.city.ilike(term)
            | Organization.organization_type.ilike(term)
        )

    all_orgs = query.order_by(Organization.priority.desc(), Organization.name.asc()).all()

    # Pre-fetch primary contacts
    all_contacts = (
        db.query(Contact)
        .filter(Contact.is_deleted.is_(False), Contact.is_primary_contact.is_(True))
        .all()
    )
    primary_contacts_by_org: Dict[int, Contact] = {c.organization_id: c for c in all_contacts}

    # Pre-fetch pending follow-ups
    pending_followups = (
        db.query(FollowUp)
        .filter(
            FollowUp.is_deleted.is_(False),
            FollowUp.status == FollowUpStatus.PENDING.value,
        )
        .order_by(asc(FollowUp.due_at))
        .all()
    )
    next_followup_by_org: Dict[int, FollowUp] = {}
    for f in pending_followups:
        if f.organization_id not in next_followup_by_org:
            next_followup_by_org[f.organization_id] = f

    # Pre-fetch latest activities
    activities = (
        db.query(ContactActivity)
        .order_by(desc(ContactActivity.created_at))
        .limit(300)
        .all()
    )
    last_act_by_org: Dict[int, ContactActivity] = {}
    for a in activities:
        if a.organization_id and a.organization_id not in last_act_by_org:
            last_act_by_org[a.organization_id] = a

    # Pre-fetch active opportunities count
    opps = db.query(Opportunity).filter(Opportunity.is_deleted.is_(False)).all()
    opp_count_by_org: Dict[int, int] = {}
    for o in opps:
        opp_count_by_org[o.organization_id] = opp_count_by_org.get(o.organization_id, 0) + 1

    # Group into the 7 pipeline columns
    columns_map: Dict[str, List[KanbanCardOut]] = {stage: [] for stage in PIPELINE_STAGES}

    for org in all_orgs:
        stage_key = org.status if org.status in columns_map else "Potential"
        prim_contact = primary_contacts_by_org.get(org.id)
        last_act = last_act_by_org.get(org.id)
        next_fol = next_followup_by_org.get(org.id)

        card = KanbanCardOut(
            organization_id=org.id,
            organization_name=org.name,
            organization_type=org.organization_type,
            priority=org.priority,
            status=org.status,
            city=org.city,
            primary_contact_name=prim_contact.full_name if prim_contact else None,
            primary_contact_designation=prim_contact.designation if prim_contact else None,
            last_activity_text=last_act.description if last_act else None,
            last_activity_date=last_act.created_at if last_act else None,
            next_followup_date=next_fol.due_at if next_fol else None,
            next_followup_title=next_fol.title if next_fol else None,
            active_opportunities_count=opp_count_by_org.get(org.id, 0),
        )
        columns_map[stage_key].append(card)

    columns_out = [
        KanbanColumnOut(
            stage=stage,
            count=len(columns_map[stage]),
            organizations=columns_map[stage],
        )
        for stage in PIPELINE_STAGES
    ]

    summary_by_stage = {stage: len(columns_map[stage]) for stage in PIPELINE_STAGES}

    return KanbanBoardOut(
        columns=columns_out,
        total_organizations=len(all_orgs),
        summary_by_stage=summary_by_stage,
    )


@router.post("/move-stage")
def move_organization_stage(
    payload: MoveStageInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    org = db.query(Organization).filter(
        Organization.id == payload.organization_id,
        Organization.is_deleted.is_(False),
    ).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    old_stage = org.status
    org.status = payload.new_stage
    org.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org)

    desc_text = f"Organization moved from {old_stage} to {payload.new_stage}."
    if payload.note and payload.note.strip():
        desc_text += f" Reason: {payload.note.strip()}"

    activity = ContactActivity(
        activity_type="pipeline_stage_moved",
        description=desc_text,
        organization_id=org.id,
        performed_by=current_user.name,
    )
    db.add(activity)
    db.commit()

    return {
        "status": "success",
        "message": desc_text,
        "organization_id": org.id,
        "new_stage": org.status,
    }
