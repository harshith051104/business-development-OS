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
from app.models.proposal import Proposal
from app.models.negotiation import Negotiation, NegotiationStatus
from app.core.audit import log_audit_event
from app.schemas.negotiation import NegotiationCreate, NegotiationUpdate, NegotiationOut

router = APIRouter(prefix="/api/business-development/negotiations", tags=["Negotiations"])


def _negotiation_to_out(n: Negotiation) -> NegotiationOut:
    return NegotiationOut(
        id=n.id,
        organization_id=n.organization_id,
        opportunity_id=n.opportunity_id,
        proposal_id=n.proposal_id,
        primary_contact_id=n.primary_contact_id,
        owner_id=n.owner_id,
        title=n.title,
        commercial_value=n.commercial_value or 0.0,
        currency=n.currency or "USD",
        status=n.status,
        expected_close_date=n.expected_close_date,
        key_requirements=n.key_requirements,
        open_issues=n.open_issues,
        risks=n.risks,
        next_action=n.next_action,
        notes=n.notes,
        organization_name=n.organization.name if n.organization else None,
        primary_contact_name=f"{n.primary_contact.first_name} {n.primary_contact.last_name}" if n.primary_contact else None,
        proposal_title=n.proposal.title if n.proposal else None,
        owner_name=n.owner.name if n.owner else None,
        created_at=n.created_at,
        updated_at=n.updated_at,
    )


@router.get("", response_model=List[NegotiationOut])
def list_negotiations(
    status: Optional[str] = None,
    organization_id: Optional[int] = None,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Negotiation).filter(Negotiation.is_deleted == False)
    if status:
        q = q.filter(Negotiation.status == status)
    if organization_id:
        q = q.filter(Negotiation.organization_id == organization_id)

    negs = q.order_by(desc(Negotiation.updated_at)).limit(limit).all()
    return [_negotiation_to_out(n) for n in negs]


@router.get("/{negotiation_id}", response_model=NegotiationOut)
def get_negotiation(
    negotiation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Negotiation).filter(Negotiation.id == negotiation_id, Negotiation.is_deleted == False).first()
    if not n:
        raise HTTPException(status_code=404, detail="Negotiation not found")
    return _negotiation_to_out(n)


@router.post("", response_model=NegotiationOut, status_code=status.HTTP_201_CREATED)
def create_negotiation(
    payload: NegotiationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org = db.query(Organization).filter(Organization.id == payload.organization_id, Organization.is_deleted == False).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    neg = Negotiation(
        organization_id=payload.organization_id,
        opportunity_id=payload.opportunity_id,
        proposal_id=payload.proposal_id,
        primary_contact_id=payload.primary_contact_id,
        owner_id=payload.owner_id or current_user.id,
        title=payload.title,
        commercial_value=payload.commercial_value or 0.0,
        currency=payload.currency or "USD",
        status=payload.status.value if isinstance(payload.status, NegotiationStatus) else (payload.status or NegotiationStatus.ACTIVE.value),
        expected_close_date=payload.expected_close_date,
        key_requirements=payload.key_requirements,
        open_issues=payload.open_issues,
        risks=payload.risks,
        next_action=payload.next_action,
        notes=payload.notes,
        created_by=current_user.name,
    )
    db.add(neg)

    # Advance organization status to Negotiation
    if org.status not in [ConnectionStatus.PARTNERSHIP.value, ConnectionStatus.CUSTOMER.value]:
        org.status = ConnectionStatus.NEGOTIATION.value

    # If linked to opportunity, update stage
    if payload.opportunity_id:
        opp = db.query(Opportunity).filter(Opportunity.id == payload.opportunity_id, Opportunity.is_deleted == False).first()
        if opp:
            opp.stage = OpportunityStage.NEGOTIATION.value
            if payload.commercial_value:
                opp.estimated_value = payload.commercial_value

    log_audit_event(
        db,
        action="CREATE_NEGOTIATION",
        resource_type="NEGOTIATION",
        resource_id=org.id,
        user=current_user,
        metadata={"title": neg.title, "value": neg.commercial_value, "organization_name": org.name},
    )
    db.commit()
    db.refresh(neg)
    return _negotiation_to_out(neg)


@router.put("/{negotiation_id}", response_model=NegotiationOut)
def update_negotiation(
    negotiation_id: int,
    payload: NegotiationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Negotiation).filter(Negotiation.id == negotiation_id, Negotiation.is_deleted == False).first()
    if not n:
        raise HTTPException(status_code=404, detail="Negotiation not found")

    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        if val is not None:
            if field == "status" and hasattr(val, "value"):
                setattr(n, field, val.value)
            else:
                setattr(n, field, val)

    n.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(n)
    return _negotiation_to_out(n)


@router.delete("/{negotiation_id}")
def delete_negotiation(
    negotiation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Negotiation).filter(Negotiation.id == negotiation_id, Negotiation.is_deleted == False).first()
    if not n:
        raise HTTPException(status_code=404, detail="Negotiation not found")
    n.is_deleted = True
    db.commit()
    return {"message": "Negotiation deleted successfully"}
