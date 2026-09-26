from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator


class FollowUpBase(BaseModel):
    organization_id: int = Field(..., description="Target organization ID")
    contact_id: Optional[int] = Field(None, description="Associated contact ID")
    meeting_id: Optional[int] = Field(None, description="Linked meeting ID")
    title: str = Field(..., min_length=1, max_length=255, description="Follow-up action title")
    description: Optional[str] = None
    due_at: datetime = Field(..., description="Due date and time")
    priority: str = Field(default="Medium", max_length=20, description="Priority: High, Medium, Low")
    status: str = Field(default="Pending", max_length=50, description="Status: Pending, Completed, Cancelled")
    assigned_to: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Follow-up title cannot be empty")
        return trimmed


class FollowUpCreate(FollowUpBase):
    pass


class FollowUpUpdate(BaseModel):
    organization_id: Optional[int] = None
    contact_id: Optional[int] = None
    meeting_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    due_at: Optional[datetime] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None


class FollowUpCancel(BaseModel):
    reason: Optional[str] = Field(None, description="Reason for cancellation")


class FollowUpOut(BaseModel):
    id: int
    organization_id: int
    organization_name: Optional[str] = None
    contact_id: Optional[int] = None
    contact_name: Optional[str] = None
    meeting_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    due_at: datetime
    priority: str
    status: str
    assigned_to: Optional[str] = None
    completed_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    is_overdue: bool = False
    timing_label: str = ""
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedFollowUpsOut(BaseModel):
    items: List[FollowUpOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class GroupedFollowUpsOut(BaseModel):
    overdue: List[FollowUpOut]
    today: List[FollowUpOut]
    upcoming: List[FollowUpOut]
    completed: List[FollowUpOut]
