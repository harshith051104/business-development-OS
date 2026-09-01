from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator
from app.models.opportunity import OpportunityStage, OpportunityPriority


class OpportunityBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    organization_id: int
    primary_contact_id: Optional[int] = None
    project_id: Optional[int] = None
    description: Optional[str] = None
    stage: str = Field(default=OpportunityStage.POTENTIAL.value)
    priority: str = Field(default=OpportunityPriority.MEDIUM.value)
    estimated_value: Optional[float] = Field(default=None, ge=0)
    currency: str = Field(default="USD", max_length=10)
    probability: Optional[int] = Field(default=None, ge=0, le=100)
    expected_close_date: Optional[datetime] = None
    next_action: Optional[str] = Field(default=None, max_length=255)
    next_action_date: Optional[datetime] = None
    notes: Optional[str] = None
    owner_id: Optional[int] = None

    @field_validator("stage")
    @classmethod
    def validate_stage(cls, v: str) -> str:
        valid_stages = [s.value for s in OpportunityStage]
        if v not in valid_stages:
            raise ValueError(f"Invalid opportunity stage. Must be one of: {valid_stages}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        valid_priorities = [p.value for p in OpportunityPriority]
        if v not in valid_priorities:
            raise ValueError(f"Invalid priority. Must be one of: {valid_priorities}")
        return v

    @field_validator("estimated_value")
    @classmethod
    def validate_value(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Estimated value must be a non-negative number.")
        return v

    @field_validator("probability")
    @classmethod
    def validate_prob(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Probability must be between 0 and 100.")
        return v


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    primary_contact_id: Optional[int] = None
    project_id: Optional[int] = None
    description: Optional[str] = None
    stage: Optional[str] = None
    priority: Optional[str] = None
    estimated_value: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = None
    probability: Optional[int] = Field(default=None, ge=0, le=100)
    expected_close_date: Optional[datetime] = None
    next_action: Optional[str] = None
    next_action_date: Optional[datetime] = None
    notes: Optional[str] = None
    owner_id: Optional[int] = None

    @field_validator("stage")
    @classmethod
    def validate_stage(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_stages = [s.value for s in OpportunityStage]
            if v not in valid_stages:
                raise ValueError(f"Invalid opportunity stage. Must be one of: {valid_stages}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_priorities = [p.value for p in OpportunityPriority]
            if v not in valid_priorities:
                raise ValueError(f"Invalid priority. Must be one of: {valid_priorities}")
        return v


class OpportunityStageUpdate(BaseModel):
    stage: str
    note: Optional[str] = None

    @field_validator("stage")
    @classmethod
    def validate_stage(cls, v: str) -> str:
        valid_stages = [s.value for s in OpportunityStage]
        if v not in valid_stages:
            raise ValueError(f"Invalid opportunity stage. Must be one of: {valid_stages}")
        return v


class OpportunityOwnerUpdate(BaseModel):
    owner_id: int
    note: Optional[str] = None


class OpportunityNoteCreate(BaseModel):
    note: str = Field(..., min_length=1)


class OpportunityActivityOut(BaseModel):
    id: int
    activity_type: str
    description: str
    performed_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OpportunityMeetingSummary(BaseModel):
    id: int
    title: str
    meeting_type: str
    scheduled_at: datetime
    status: str

    class Config:
        from_attributes = True


class OpportunityFollowUpSummary(BaseModel):
    id: int
    title: str
    due_at: datetime
    priority: str
    status: str

    class Config:
        from_attributes = True


class OpportunityOut(BaseModel):
    id: int
    organization_id: int
    primary_contact_id: Optional[int] = None
    project_id: Optional[int] = None
    owner_id: Optional[int] = None

    name: str
    description: Optional[str] = None
    stage: str
    priority: str
    estimated_value: Optional[float] = None
    currency: str
    probability: Optional[int] = None
    expected_close_date: Optional[datetime] = None

    next_action: Optional[str] = None
    next_action_date: Optional[datetime] = None
    notes: Optional[str] = None

    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Display Helpers
    organization_name: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_designation: Optional[str] = None
    project_title: Optional[str] = None
    owner_name: Optional[str] = None
    has_next_action: bool = True

    class Config:
        from_attributes = True


class OpportunityDetailOut(OpportunityOut):
    activities: List[OpportunityActivityOut] = []
    meetings: List[OpportunityMeetingSummary] = []
    followups: List[OpportunityFollowUpSummary] = []


class PaginatedOpportunitiesOut(BaseModel):
    items: List[OpportunityOut]
    total: int
    page: int
    page_size: int
    total_pages: int
    no_next_action_count: int = 0
    active_count: int = 0
    high_priority_count: int = 0


# Kanban Connection Board Schemas
class KanbanCardOut(BaseModel):
    organization_id: int
    organization_name: str
    organization_type: str
    priority: str
    status: str
    city: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_designation: Optional[str] = None
    last_activity_text: Optional[str] = None
    last_activity_date: Optional[datetime] = None
    next_followup_date: Optional[datetime] = None
    next_followup_title: Optional[str] = None
    active_opportunities_count: int = 0


class KanbanColumnOut(BaseModel):
    stage: str
    count: int
    organizations: List[KanbanCardOut]


class KanbanBoardOut(BaseModel):
    columns: List[KanbanColumnOut]
    total_organizations: int
    summary_by_stage: dict[str, int]


class MoveStageInput(BaseModel):
    organization_id: int
    new_stage: str
    note: Optional[str] = None

    @field_validator("new_stage")
    @classmethod
    def validate_stage(cls, v: str) -> str:
        valid_stages = [
            "Potential",
            "Contacted",
            "Connected",
            "Interested",
            "Meeting",
            "Discussion",
            "Partnership",
        ]
        if v not in valid_stages:
            raise ValueError(f"Invalid pipeline stage '{v}'. Must be one of: {valid_stages}")
        return v
