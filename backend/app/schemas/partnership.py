from datetime import datetime, timezone
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, field_validator, ConfigDict
from app.models.partnership import PartnershipType, PartnershipStatus, PartnershipPriority


class PartnershipBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    organization_id: int
    opportunity_id: Optional[int] = None
    primary_contact_id: Optional[int] = None
    project_id: Optional[int] = None
    partnership_type: str = Field(default=PartnershipType.BUSINESS_PARTNERSHIP.value)
    status: str = Field(default=PartnershipStatus.ACTIVE.value)
    priority: str = Field(default=PartnershipPriority.MEDIUM.value)
    owner_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    objectives: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    next_action: Optional[str] = Field(default=None, max_length=255)
    next_action_date: Optional[datetime] = None

    @field_validator("partnership_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        valid_types = [t.value for t in PartnershipType]
        if v not in valid_types:
            raise ValueError(f"Invalid partnership type. Must be one of: {valid_types}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = [s.value for s in PartnershipStatus]
        if v not in valid_statuses:
            raise ValueError(f"Invalid partnership status. Must be one of: {valid_statuses}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        valid_priorities = [p.value for p in PartnershipPriority]
        if v not in valid_priorities:
            raise ValueError(f"Invalid partnership priority. Must be one of: {valid_priorities}")
        return v


class PartnershipCreate(PartnershipBase):
    allow_duplicate: bool = False

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v: Optional[datetime], info) -> Optional[datetime]:
        start = info.data.get("start_date")
        if v is not None and start is not None and v < start:
            raise ValueError("End date cannot be before start date.")
        return v


class PartnershipUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    partnership_type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    primary_contact_id: Optional[int] = None
    project_id: Optional[int] = None
    owner_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    objectives: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    next_action: Optional[str] = None
    next_action_date: Optional[datetime] = None

    @field_validator("partnership_type")
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_types = [t.value for t in PartnershipType]
            if v not in valid_types:
                raise ValueError(f"Invalid partnership type. Must be one of: {valid_types}")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_statuses = [s.value for s in PartnershipStatus]
            if v not in valid_statuses:
                raise ValueError(f"Invalid partnership status. Must be one of: {valid_statuses}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            valid_priorities = [p.value for p in PartnershipPriority]
            if v not in valid_priorities:
                raise ValueError(f"Invalid priority. Must be one of: {valid_priorities}")
        return v


class PartnershipStatusUpdate(BaseModel):
    status: str = Field(..., description="Target status: Active, On Hold, Completed, Ended")
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = [s.value for s in PartnershipStatus]
        if v not in valid_statuses:
            raise ValueError(f"Invalid partnership status. Must be one of: {valid_statuses}")
        return v


class PartnershipOwnerUpdate(BaseModel):
    owner_id: Optional[int] = Field(None, description="Internal User ID of the owner")


class ConvertToPartnershipIn(BaseModel):
    name: Optional[str] = None
    partnership_type: str = Field(default=PartnershipType.BUSINESS_PARTNERSHIP.value)
    priority: str = Field(default=PartnershipPriority.MEDIUM.value)
    owner_id: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    objectives: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    next_action: Optional[str] = None
    next_action_date: Optional[datetime] = None
    update_organization_status: bool = True
    allow_duplicate: bool = False


class PartnershipOut(BaseModel):
    id: int
    name: str
    organization_id: int
    organization_name: Optional[str] = None
    opportunity_id: Optional[int] = None
    opportunity_name: Optional[str] = None
    primary_contact_id: Optional[int] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    primary_contact_designation: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    partnership_type: str
    status: str
    priority: str
    start_date: datetime
    end_date: Optional[datetime] = None
    objectives: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    next_action: Optional[str] = None
    next_action_date: Optional[datetime] = None
    is_deleted: bool
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Calculated indicators
    is_ending_soon: bool = False
    needs_attention: bool = False

    model_config = ConfigDict(from_attributes=True)


class PaginatedPartnershipsOut(BaseModel):
    items: List[PartnershipOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class PartnershipStatsOut(BaseModel):
    total_partnerships: int = 0
    active_partnerships: int = 0
    on_hold_partnerships: int = 0
    completed_partnerships: int = 0
    ended_partnerships: int = 0
    ending_soon_count: int = 0
    needs_attention_count: int = 0
    new_this_month: int = 0
    by_type: Dict[str, int] = Field(default_factory=dict)
    by_owner: Dict[str, int] = Field(default_factory=dict)
    by_project: Dict[str, int] = Field(default_factory=dict)
