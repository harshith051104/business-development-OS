from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ── Outreach Draft Schemas ──
class OutreachDraftBase(BaseModel):
    organization_id: int
    contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    project_id: Optional[int] = None
    channel: str = Field(default="Email")
    subject: Optional[str] = None
    message: Optional[str] = None
    call_purpose: Optional[str] = None
    status: str = Field(default="Draft")


class OutreachDraftCreate(OutreachDraftBase):
    pass


class OutreachDraftUpdate(BaseModel):
    contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    project_id: Optional[int] = None
    channel: Optional[str] = None
    subject: Optional[str] = None
    message: Optional[str] = None
    call_purpose: Optional[str] = None
    status: Optional[str] = None


class OutreachDraftOut(BaseModel):
    id: int
    organization_id: int
    organization_name: Optional[str] = None
    contact_id: Optional[int] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_linkedin: Optional[str] = None
    opportunity_id: Optional[int] = None
    opportunity_title: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    channel: str
    subject: Optional[str] = None
    message: Optional[str] = None
    call_purpose: Optional[str] = None
    status: str
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedOutreachDraftsOut(BaseModel):
    items: List[OutreachDraftOut]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Outreach Template Schemas ──
class OutreachTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(default="Introduction")
    channel: str = Field(default="Email")
    subject: Optional[str] = None
    body: str = Field(..., min_length=1)
    is_active: bool = True


class OutreachTemplateCreate(OutreachTemplateBase):
    pass


class OutreachTemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    channel: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    is_active: Optional[bool] = None


class OutreachTemplateOut(BaseModel):
    id: int
    name: str
    category: str
    channel: str
    subject: Optional[str] = None
    body: str
    is_active: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Outreach Execution & Action Recording ──
class OutreachRecordActionIn(BaseModel):
    draft_id: Optional[int] = None
    organization_id: int
    contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    channel: str = Field(default="Email")
    direction: str = Field(default="Outgoing")
    subject: Optional[str] = None
    summary: str = Field(..., min_length=1)
    notes: Optional[str] = None
    communication_date: Optional[datetime] = None

    # Status update option
    update_organization_status: bool = False
    new_organization_status: Optional[str] = "Contacted"

    # Follow-up option
    create_followup: bool = False
    followup_title: Optional[str] = None
    followup_due_at: Optional[datetime] = None
    followup_priority: Optional[str] = "Medium"
    followup_notes: Optional[str] = None


class OutreachRecordActionOut(BaseModel):
    communication_id: int
    draft_id: Optional[int] = None
    organization_id: int
    organization_status_updated: bool
    new_organization_status: Optional[str] = None
    followup_id: Optional[int] = None
    message: str
