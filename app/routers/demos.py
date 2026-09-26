from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.auth.deps import get_current_user
from app.models.user import User
from app.models.organization import Organization, ConnectionStatus
from app.models.opportunity import Opportunity, OpportunityStage
from app.models.contact import Contact
from app.models.project import Project
from app.models.demo import Demo, DemoStatus, DemoOutcome
from app.core.audit import log_audit_event
from app.schemas.demo import DemoCreate, DemoUpdate, DemoOut

router = APIRouter(prefix="/api/business-development/demos", tags=["Demos"])


def _demo_to_out(d: Demo) -> DemoOut:
    return DemoOut(
        id=d.id,
        organization_id=d.organization_id,
        opportunity_id=d.opportunity_id,
        meeting_id=d.meeting_id,
        primary_contact_id=d.primary_contact_id,
        project_id=d.project_id,
        owner_id=d.owner_id,
        title=d.title,
        status=d.status,
        outcome=d.outcome,
        scheduled_at=d.scheduled_at,
        completed_at=d.completed_at,
        participants=d.participants,
        customer_requirements=d.customer_requirements,
        demo_notes=d.demo_notes,
        next_action=d.next_action,
        organization_name=d.organization.name if d.organization else None,
        primary_contact_name=f"{d.primary_contact.first_name} {d.primary_contact.last_name}" if d.primary_contact else None,
        project_name=d.project.name if d.project else None,
        owner_name=d.owner.name if d.owner else None,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


@router.get("", response_model=List[DemoOut])
def list_demos(
    status: Optional[str] = None,
    outcome: Optional[str] = None,
    organization_id: Optional[int] = None,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Demo).filter(Demo.is_deleted == False)
    if status:
        q = q.filter(Demo.status == status)
    if outcome:
        q = q.filter(Demo.outcome == outcome)
    if organization_id:
        q = q.filter(Demo.organization_id == organization_id)

    demos = q.order_by(desc(Demo.scheduled_at)).limit(limit).all()
    return [_demo_to_out(d) for d in demos]


@router.get("/{demo_id}", response_model=DemoOut)
def get_demo(
    demo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = db.query(Demo).filter(Demo.id == demo_id, Demo.is_deleted == False).first()
    if not d:
        raise HTTPException(status_code=404, detail="Demo not found")
    return _demo_to_out(d)


@router.post("", response_model=DemoOut, status_code=status.HTTP_201_CREATED)
def create_demo(
    payload: DemoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_deleted == False).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    demo = Demo(
        organization_id=payload.organization_id,
        opportunity_id=payload.opportunity_id,
        meeting_id=payload.meeting_id,
        primary_contact_id=payload.primary_contact_id,
        project_id=payload.project_id,
        owner_id=payload.owner_id or current_user.id,
        title=payload.title,
        status=payload.status.value if isinstance(payload.status, DemoStatus) else (payload.status or DemoStatus.SCHEDULED.value),
        outcome=payload.outcome.value if isinstance(payload.outcome, DemoOutcome) else (payload.outcome or DemoOutcome.PENDING.value),
        scheduled_at=payload.scheduled_at,
        completed_at=payload.completed_at,
        participants=payload.participants,
        customer_requirements=payload.customer_requirements,
        demo_notes=payload.demo_notes,
        next_action=payload.next_action,
        created_by=current_user.name,
    )
    db.add(demo)

    # Move organization stage to Demo if currently in New/Contacted/Meeting
    if org.status in [ConnectionStatus.NEW.value, ConnectionStatus.POTENTIAL.value, ConnectionStatus.CONTACTED.value, ConnectionStatus.RESPONDED.value, ConnectionStatus.MEETING.value]:
        org.status = ConnectionStatus.DEMO.value

    # If linked to an opportunity, advance stage to Demo
    if payload.opportunity_id:
        opp = db.query(Opportunity).filter(Opportunity.id == payload.opportunity_id, Opportunity.is_deleted == False).first()
        if opp:
            opp.stage = OpportunityStage.DEMO.value

    log_audit_event(
        db,
        action="CREATE_DEMO",
        resource_type="DEMO",
        resource_id=org.id,
        user=current_user,
        metadata={"title": demo.title, "organization_name": org.name},
    )
    db.commit()
    db.refresh(demo)
    return _demo_to_out(demo)


@router.put("/{demo_id}", response_model=DemoOut)
def update_demo(
    demo_id: int,
    payload: DemoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = db.query(Demo).filter(Demo.id == demo_id, Demo.is_deleted == False).first()
    if not d:
        raise HTTPException(status_code=404, detail="Demo not found")

    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if val is not None:
            if field in ["status", "outcome"] and hasattr(val, "value"):
                setattr(d, field, val.value)
            else:
                setattr(d, field, val)

    # If completed outcome is Proposal Requested, advance org to Proposal
    if d.outcome == DemoOutcome.PROPOSAL_REQUESTED.value and d.organization:
        d.organization.status = ConnectionStatus.PROPOSAL.value

    d.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(d)
    return _demo_to_out(d)


@router.delete("/{demo_id}")
def delete_demo(
    demo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = db.query(Demo).filter(Demo.id == demo_id, Demo.is_deleted == False).first()
    if not d:
        raise HTTPException(status_code=404, detail="Demo not found")
    d.is_deleted = True
    db.commit()
    return {"message": "Demo deleted successfully"}
