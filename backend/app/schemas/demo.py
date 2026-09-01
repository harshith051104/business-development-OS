from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.demo import DemoStatus, DemoOutcome


class DemoBase(BaseModel):
    organization_id: int
    opportunity_id: Optional[int] = None
    meeting_id: Optional[int] = None
    primary_contact_id: Optional[int] = None
    project_id: Optional[int] = None
    owner_id: Optional[int] = None
    title: str
    status: Optional[DemoStatus] = DemoStatus.SCHEDULED
    outcome: Optional[DemoOutcome] = DemoOutcome.PENDING
    scheduled_at: datetime
    completed_at: Optional[datetime] = None
    participants: Optional[str] = None
    customer_requirements: Optional[str] = None
    demo_notes: Optional[str] = None
    next_action: Optional[str] = None


class DemoCreate(DemoBase):
    pass


class DemoUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[DemoStatus] = None
    outcome: Optional[DemoOutcome] = None
    scheduled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    participants: Optional[str] = None
    customer_requirements: Optional[str] = None
    demo_notes: Optional[str] = None
    next_action: Optional[str] = None
    project_id: Optional[int] = None
    primary_contact_id: Optional[int] = None


class DemoOut(DemoBase):
    id: int
    organization_name: Optional[str] = None
    primary_contact_name: Optional[str] = None
    project_name: Optional[str] = None
    owner_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
