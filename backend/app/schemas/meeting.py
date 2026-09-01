from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator


class MeetingContactInfo(BaseModel):
    id: int
    full_name: str
    designation: Optional[str] = None
    email: Optional[str] = None
    is_decision_maker: bool = False
    is_primary_contact: bool = False

    model_config = ConfigDict(from_attributes=True)


class MeetingBase(BaseModel):
    organization_id: int = Field(..., description="Target healthcare organization ID")
    primary_contact_id: Optional[int] = Field(None, description="Primary contact ID")
    opportunity_id: Optional[int] = Field(None, description="Linked opportunity ID")
    contact_ids: Optional[List[int]] = Field(default=[], description="List of attending contact IDs")
    title: str = Field(..., min_length=1, max_length=255, description="Meeting title / subject")
    meeting_type: str = Field(default="Business Discussion", max_length=100, description="Type of meeting")
    description: Optional[str] = None
    scheduled_at: datetime = Field(..., description="Scheduled meeting timestamp")
    duration_minutes: int = Field(default=45, ge=5, le=480, description="Duration in minutes")
    location: Optional[str] = Field(None, max_length=255, description="Physical location or conference room")
    meeting_url: Optional[str] = Field(None, max_length=500, description="Video conference URL")
    status: str = Field(default="Scheduled", max_length=50, description="Status: Scheduled, Completed, Cancelled, Rescheduled")
    agenda: Optional[str] = None
    notes: Optional[str] = None
    decisions: Optional[str] = None
    next_actions: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Meeting title cannot be empty")
        return trimmed


class MeetingCreate(MeetingBase):
    pass


class MeetingUpdate(BaseModel):
    organization_id: Optional[int] = None
    primary_contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    contact_ids: Optional[List[int]] = None
    title: Optional[str] = None
    meeting_type: Optional[str] = None
    description: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    status: Optional[str] = None
    agenda: Optional[str] = None
    notes: Optional[str] = None
    decisions: Optional[str] = None
    next_actions: Optional[str] = None


class MeetingComplete(BaseModel):
    notes: Optional[str] = Field(None, description="Discussion notes recorded during or after meeting")
    decisions: Optional[str] = Field(None, description="Agreed decisions")
    next_actions: Optional[str] = Field(None, description="Next action items")
    followup_title: Optional[str] = Field(None, description="Optional follow-up action title")
    followup_due_at: Optional[datetime] = Field(None, description="Optional follow-up due date")
    followup_priority: Optional[str] = Field(default="High", description="Optional follow-up priority")
    advance_org_status: Optional[str] = Field(None, description="Optional target organization pipeline status (e.g. 'Discussion')")


class MeetingCancel(BaseModel):
    reason: Optional[str] = Field(None, description="Reason for cancellation")


class MeetingReschedule(BaseModel):
    scheduled_at: datetime = Field(..., description="New meeting timestamp")
    duration_minutes: Optional[int] = None
    note: Optional[str] = None


class MeetingOut(BaseModel):
    id: int
    organization_id: int
    organization_name: Optional[str] = None
    primary_contact_id: Optional[int] = None
    primary_contact_name: Optional[str] = None
    opportunity_id: Optional[int] = None
    opportunity_name: Optional[str] = None
    contact_ids: List[int] = []
    title: str
    meeting_type: str
    scheduled_at: datetime
    duration_minutes: int
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MeetingDetailOut(MeetingOut):
    description: Optional[str] = None
    agenda: Optional[str] = None
    notes: Optional[str] = None
    decisions: Optional[str] = None
    next_actions: Optional[str] = None
    cancellation_reason: Optional[str] = None
    attendees: List[MeetingContactInfo] = []

    model_config = ConfigDict(from_attributes=True)


class PaginatedMeetingsOut(BaseModel):
    items: List[MeetingOut]
    total: int
    page: int
    page_size: int
    total_pages: int
