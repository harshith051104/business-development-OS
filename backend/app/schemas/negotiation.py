from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.negotiation import NegotiationStatus


class NegotiationBase(BaseModel):
    organization_id: int
    opportunity_id: Optional[int] = None
    proposal_id: Optional[int] = None
    primary_contact_id: Optional[int] = None
    owner_id: Optional[int] = None
    title: str
    commercial_value: Optional[float] = 0.0
    currency: Optional[str] = None
    status: Optional[NegotiationStatus] = NegotiationStatus.ACTIVE
    expected_close_date: Optional[datetime] = None
    key_requirements: Optional[str] = None
    open_issues: Optional[str] = None
    risks: Optional[str] = None
    next_action: Optional[str] = None
    notes: Optional[str] = None


class NegotiationCreate(NegotiationBase):
    pass


class NegotiationUpdate(BaseModel):
    title: Optional[str] = None
    commercial_value: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[NegotiationStatus] = None
    expected_close_date: Optional[datetime] = None
    key_requirements: Optional[str] = None
    open_issues: Optional[str] = None
    risks: Optional[str] = None
    next_action: Optional[str] = None
    notes: Optional[str] = None
    proposal_id: Optional[int] = None
    primary_contact_id: Optional[int] = None


class NegotiationOut(NegotiationBase):
    id: int
    organization_name: Optional[str] = None
    primary_contact_name: Optional[str] = None
    proposal_title: Optional[str] = None
    owner_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
