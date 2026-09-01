from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field
from app.models.communication import (
    CommunicationChannel,
    CommunicationDirection,
    CommunicationStatus,
)


class CommunicationCreate(BaseModel):
    organization_id: int
    contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    meeting_id: Optional[int] = None
    followup_id: Optional[int] = None

    channel: CommunicationChannel = CommunicationChannel.EMAIL
    direction: CommunicationDirection = CommunicationDirection.OUTGOING
    subject: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = None
    summary: Optional[str] = None
    communication_date: Optional[datetime] = None
    status: CommunicationStatus = CommunicationStatus.COMPLETED
    source: Optional[str] = "manual"  # manual | campaign | meeting | system

    # Phone-specific
    duration_minutes: Optional[int] = None
    call_outcome: Optional[str] = None  # connected | voicemail | no_answer | busy

    # WhatsApp/LinkedIn-specific
    external_message_id: Optional[str] = None


class CommunicationUpdate(BaseModel):
    contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    meeting_id: Optional[int] = None
    followup_id: Optional[int] = None

    channel: Optional[CommunicationChannel] = None
    direction: Optional[CommunicationDirection] = None
    subject: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = None
    summary: Optional[str] = None
    communication_date: Optional[datetime] = None
    status: Optional[CommunicationStatus] = None


class CommunicationOut(BaseModel):
    id: int
    organization_id: int
    contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    meeting_id: Optional[int] = None
    followup_id: Optional[int] = None

    channel: str
    direction: str
    subject: str
    content: Optional[str] = None
    summary: Optional[str] = None
    communication_date: datetime
    status: str
    source: Optional[str] = None

    # Phone
    duration_minutes: Optional[int] = None
    call_outcome: Optional[str] = None

    # WhatsApp/LinkedIn
    external_message_id: Optional[str] = None

    created_by: Optional[str] = None
    owner_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    # Display / Denormalized Info
    organization_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_designation: Optional[str] = None
    opportunity_name: Optional[str] = None
    meeting_title: Optional[str] = None
    followup_title: Optional[str] = None

    class Config:
        from_attributes = True


class CommunicationDetailOut(CommunicationOut):
    pass


class PaginatedCommunicationsOut(BaseModel):
    items: List[CommunicationOut]
    total: int
    page: int
    page_size: int
    total_pages: int
    channel_counts: Dict[str, int] = {}
    direction_counts: Dict[str, int] = {}


class TimelineItemOut(BaseModel):
    id: str
    event_type: str  # "communication", "meeting", "followup", "activity"
    timestamp: datetime
    title: str
    subtitle: Optional[str] = None
    description: Optional[str] = None
    channel: Optional[str] = None
    direction: Optional[str] = None
    status: Optional[str] = None
    performed_by: Optional[str] = None
    organization_id: Optional[int] = None
    contact_id: Optional[int] = None
    opportunity_id: Optional[int] = None
    reference_id: Optional[int] = None


class RelationshipTimelineOut(BaseModel):
    events: List[TimelineItemOut]
    total_events: int
    organization_name: Optional[str] = None
    contact_name: Optional[str] = None
    opportunity_name: Optional[str] = None
