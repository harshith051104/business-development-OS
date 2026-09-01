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
from app.models.proposal import Proposal, ProposalStatus
from app.core.audit import log_audit_event
from app.schemas.proposal import ProposalCreate, ProposalUpdate, ProposalOut

router = APIRouter(prefix="/api/business-development/proposals", tags=["Proposals"])


def _proposal_to_out(p: Proposal) -> ProposalOut:
    return ProposalOut(
        id=p.id,
        organization_id=p.organization_id,
        opportunity_id=p.opportunity_id,
        primary_contact_id=p.primary_contact_id,
        project_id=p.project_id,
        owner_id=p.owner_id,
        title=p.title,
        version=p.version,
        value=p.value or 0.0,
        currency=p.currency or "USD",
        status=p.status,
        content_summary=p.content_summary,
        scope_of_work=p.scope_of_work,
        commercial_terms=p.commercial_terms,
        notes=p.notes,
        date_created=p.date_created,
        date_sent=p.date_sent,
        valid_until=p.valid_until,
        organization_name=p.organization.name if p.organization else None,
        primary_contact_name=f"{p.primary_contact.first_name} {p.primary_contact.last_name}" if p.primary_contact else None,
        project_name=p.project.name if p.project else None,
        owner_name=p.owner.name if p.owner else None,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


@router.get("", response_model=List[ProposalOut])
def list_proposals(
    status: Optional[str] = None,
    organization_id: Optional[int] = None,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Proposal).filter(Proposal.is_deleted == False)
    if status:
        q = q.filter(Proposal.status == status)
    if organization_id:
        q = q.filter(Proposal.organization_id == organization_id)

    proposals = q.order_by(desc(Proposal.date_created)).limit(limit).all()
    return [_proposal_to_out(p) for p in proposals]


@router.get("/{proposal_id}", response_model=ProposalOut)
def get_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Proposal).filter(Proposal.id == proposal_id, Proposal.is_deleted == False).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return _proposal_to_out(p)


@router.post("", response_model=ProposalOut, status_code=status.HTTP_201_CREATED)
def create_proposal(
    payload: ProposalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_deleted == False).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    proposal = Proposal(
        organization_id=payload.organization_id,
        opportunity_id=payload.opportunity_id,
        primary_contact_id=payload.primary_contact_id,
        project_id=payload.project_id,
        owner_id=payload.owner_id or current_user.id,
        title=payload.title,
        version=payload.version or "v1.0",
        value=payload.value or 0.0,
        currency=payload.currency or "USD",
        status=payload.status.value if isinstance(payload.status, ProposalStatus) else (payload.status or ProposalStatus.DRAFT.value),
        content_summary=payload.content_summary,
        scope_of_work=payload.scope_of_work,
        commercial_terms=payload.commercial_terms,
        notes=payload.notes,
        date_created=datetime.now(timezone.utc),
        date_sent=payload.date_sent,
        valid_until=payload.valid_until,
        created_by=current_user.name,
    )
    db.add(proposal)

    # Advance organization status to Proposal
    if org.status not in [ConnectionStatus.NEGOTIATION.value, ConnectionStatus.PARTNERSHIP.value, ConnectionStatus.CUSTOMER.value]:
        org.status = ConnectionStatus.PROPOSAL.value

    # If linked to an opportunity, update value and stage
    if payload.opportunity_id:
        opp = db.query(Opportunity).filter(Opportunity.id == payload.opportunity_id, Opportunity.is_deleted == False).first()
        if opp:
            opp.stage = OpportunityStage.PROPOSAL.value
            if payload.value:
                opp.estimated_value = payload.value

    log_audit_event(
        db,
        action="CREATE_PROPOSAL",
        resource_type="PROPOSAL",
        resource_id=org.id,
        user=current_user,
        metadata={"title": proposal.title, "value": proposal.value, "organization_name": org.name},
    )
    db.commit()
    db.refresh(proposal)
    return _proposal_to_out(proposal)


@router.put("/{proposal_id}", response_model=ProposalOut)
def update_proposal(
    proposal_id: int,
    payload: ProposalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Proposal).filter(Proposal.id == proposal_id, Proposal.is_deleted == False).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if val is not None:
            if field == "status" and hasattr(val, "value"):
                setattr(p, field, val.value)
            else:
                setattr(p, field, val)

    p.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(p)
    return _proposal_to_out(p)


@router.delete("/{proposal_id}")
def delete_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    p = db.query(Proposal).filter(Proposal.id == proposal_id, Proposal.is_deleted == False).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    p.is_deleted = True
    db.commit()
    return {"message": "Proposal deleted successfully"}
