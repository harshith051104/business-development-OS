from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.customer import CustomerStatus, AccountHealth


class CustomerBase(BaseModel):
    organization_id: int
    primary_contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    project_id: Optional[int] = None
    owner_id: Optional[int] = None
    contract_value: Optional[float] = 0.0
    currency: Optional[str] = None
    status: Optional[CustomerStatus] = CustomerStatus.ACTIVE
    account_health: Optional[AccountHealth] = AccountHealth.GOOD
    start_date: Optional[datetime] = None
    renewal_date: Optional[datetime] = None
    next_review_date: Optional[datetime] = None
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    primary_contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    project_id: Optional[int] = None
    owner_id: Optional[int] = None
    contract_value: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[CustomerStatus] = None
    account_health: Optional[AccountHealth] = None
    start_date: Optional[datetime] = None
    renewal_date: Optional[datetime] = None
    next_review_date: Optional[datetime] = None
    notes: Optional[str] = None


class CustomerConvertRequest(BaseModel):
    organization_id: int
    opportunity_id: Optional[int] = None
    primary_contact_id: Optional[int] = None
    project_id: Optional[int] = None
    contract_value: Optional[float] = 0.0
    currency: Optional[str] = None
    start_date: Optional[datetime] = None
    renewal_date: Optional[datetime] = None
    notes: Optional[str] = None


class CustomerOut(CustomerBase):
    id: int
    organization_name: Optional[str] = None
    primary_contact_name: Optional[str] = None
    project_name: Optional[str] = None
    owner_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
