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
from app.models.meeting import Meeting, MeetingStatus
from app.models.communication import Communication
from app.models.campaign import CampaignContact
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

STAGE_RANKS: Dict[str, int] = {
    "Potential": 0,
    "Contacted": 1,
    "Connected": 2,
    "Interested": 3,
    "Meeting": 4,
    "Discussion": 5,
    "Partnership": 6,
}


def compute_target_stage(db: Session, org_id: int) -> str:
    """
    Evaluates real-time activity across campaigns, communications, meetings,
    and commercial opportunities to compute the ideal Kanban pipeline stage.
    """
    # 1. Partnership: closed-won opportunity or active agreement
    has_partnership = db.query(Opportunity).filter(
        Opportunity.organization_id == org_id,
        Opportunity.is_deleted.is_(False),
        Opportunity.stage.in_(["Closed Won", "Contract", "Partnership Won"]),
    ).first()
    if has_partnership:
        return "Partnership"

    # 2. Discussion: active opportunity in negotiation, proposal, or presentation stage
    has_discussion = db.query(Opportunity).filter(
        Opportunity.organization_id == org_id,
        Opportunity.is_deleted.is_(False),
        Opportunity.stage.in_(["Negotiation", "Proposal/Pricing", "Technical Review", "Demo / Pitch", "Business Discussion"]),
    ).first()
    if has_discussion:
        return "Discussion"

    # 3. Meeting: has a scheduled, completed, or upcoming meeting
    has_meeting = db.query(Meeting).filter(
        Meeting.organization_id == org_id,
        Meeting.is_deleted.is_(False),
        Meeting.status.in_([MeetingStatus.SCHEDULED.value, MeetingStatus.COMPLETED.value]),
    ).first()
    if has_meeting:
        return "Meeting"

    # 4. Interested: replied to campaign email, inbound communication, or opened opportunity
    has_reply = db.query(CampaignContact).filter(
        CampaignContact.organization_id == org_id,
        CampaignContact.status.in_(["Replied", "replied"]),
    ).first()
    if not has_reply:
        has_reply = db.query(Communication).filter(
            Communication.organization_id == org_id,
            Communication.direction.in_(["Incoming", "INCOMING"]),
        ).first()
    has_active_opp = db.query(Opportunity).filter(
        Opportunity.organization_id == org_id,
        Opportunity.is_deleted.is_(False),
    ).first()
    if has_reply or has_active_opp:
        return "Interested"

    # 5. Connected: engagement detected (opened/clicked) or multiple communications
    has_opened = db.query(CampaignContact).filter(
        CampaignContact.organization_id == org_id,
        CampaignContact.status.in_(["Opened", "Clicked", "opened", "clicked"]),
    ).first()
    if has_opened:
        return "Connected"

    # 6. Contacted: campaign email sent, queued, or outbound communication logged
    has_contacted = db.query(CampaignContact).filter(
        CampaignContact.organization_id == org_id,
        CampaignContact.status.in_(["Sent", "Queued", "sent", "queued"]),
    ).first()
    if not has_contacted:
        has_contacted = db.query(Communication).filter(
            Communication.organization_id == org_id,
        ).first()
    if has_contacted:
        return "Contacted"

    return "Potential"


def auto_sync_pipeline(db: Session, user_name: str = "System Auto-Sync") -> int:
    """
    Scans all active organizations and automatically advances their pipeline stages
    based on live dashboard activity. Returns count of moved organizations.
    """
    orgs = db.query(Organization).filter(Organization.is_deleted.is_(False)).all()
    updated_count = 0

    for org in orgs:
        current_stage = org.status if org.status in STAGE_RANKS else "Potential"
        target_stage = compute_target_stage(db, org.id)

        current_rank = STAGE_RANKS.get(current_stage, 0)
        target_rank = STAGE_RANKS.get(target_stage, 0)

        # Advance if new stage has higher progression
        if target_rank > current_rank:
            old_stage = org.status
            org.status = target_stage
            org.updated_at = datetime.now(timezone.utc)
            updated_count += 1

            activity = ContactActivity(
                activity_type="pipeline_auto_advanced",
                description=f"Auto-progressed pipeline stage from {old_stage} to {target_stage} based on live activity.",
                organization_id=org.id,
                performed_by=user_name,
            )
            db.add(activity)

    if updated_count > 0:
        db.commit()

    return updated_count


@router.get("/pipeline", response_model=KanbanBoardOut)
def get_connections_pipeline(
    search: str = Query(None),
    priority: str = Query(None),
    auto_sync: bool = Query(True, description="Automatically progress stages based on live activity"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    if auto_sync:
        auto_sync_pipeline(db, user_name="Auto-Pipeline Monitor")

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


@router.post("/auto-sync")
def trigger_pipeline_auto_sync(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    Scans all dashboard signals (outreach emails sent, replies detected, meetings scheduled,
    and opportunity progress) and automatically moves organizations forward across the Kanban pipeline.
    """
    updated_count = auto_sync_pipeline(db, user_name=current_user.name or "ELLY Pipeline Agent")
    return {
        "status": "success",
        "updated_count": updated_count,
        "message": f"Successfully evaluated pipeline. {updated_count} organization(s) automatically progressed.",
    }
