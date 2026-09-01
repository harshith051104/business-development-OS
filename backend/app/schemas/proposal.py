from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.proposal import ProposalStatus


class ProposalBase(BaseModel):
    organization_id: int
    opportunity_id: Optional[int] = None
    primary_contact_id: Optional[int] = None
    project_id: Optional[int] = None
    owner_id: Optional[int] = None
    title: str
    version: Optional[str] = "v1.0"
    value: Optional[float] = 0.0
    currency: Optional[str] = None
    status: Optional[ProposalStatus] = ProposalStatus.DRAFT
    content_summary: Optional[str] = None
    scope_of_work: Optional[str] = None
    commercial_terms: Optional[str] = None
    notes: Optional[str] = None
    date_sent: Optional[datetime] = None
    valid_until: Optional[datetime] = None


class ProposalCreate(ProposalBase):
    pass


class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    version: Optional[str] = None
    value: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[ProposalStatus] = None
    content_summary: Optional[str] = None
    scope_of_work: Optional[str] = None
    commercial_terms: Optional[str] = None
    notes: Optional[str] = None
    date_sent: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    primary_contact_id: Optional[int] = None
    project_id: Optional[int] = None


class ProposalOut(ProposalBase):
    id: int
    organization_name: Optional[str] = None
    primary_contact_name: Optional[str] = None
    project_name: Optional[str] = None
    owner_name: Optional[str] = None
    date_created: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
