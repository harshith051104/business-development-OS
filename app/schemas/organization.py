from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator


class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Organization legal or business name")
    organization_type: str = Field(default="Technology Company", description="Category of organization")
    owner_id: Optional[int] = None
    description: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    industry: Optional[str] = "Unknown"
    size: Optional[str] = "200-1000"
    status: str = Field(default="Potential", description="Connection pipeline stage")
    priority: str = Field(default="Medium", description="Internal BD priority: High, Medium, Low")
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Organization name cannot be empty")
        return trimmed


class OrganizationCreate(OrganizationBase):
    allow_duplicate: bool = Field(default=False, description="Confirm creation even if similar name exists")


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    organization_type: Optional[str] = None
    owner_id: Optional[int] = None
    description: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    notes: Optional[str] = None


class OrganizationStatusUpdate(BaseModel):
    status: str = Field(..., description="Target connection pipeline stage")
    note: Optional[str] = Field(None, description="Optional internal note describing reason for transition")


class OrganizationPriorityUpdate(BaseModel):
    priority: str = Field(..., description="High, Medium, or Low")


class OrganizationOwnerUpdate(BaseModel):
    owner_id: Optional[int] = Field(None, description="BD user ID to assign as owner, or None to unassign")


class OrganizationNoteAdd(BaseModel):
    note: str = Field(..., min_length=1, description="Internal BD note content")


class OrganizationOut(BaseModel):
    id: int
    name: str
    organization_type: str
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    priority: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrganizationDetailOut(BaseModel):
    id: int
    name: str
    organization_type: str
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    status: str
    priority: str
    notes: Optional[str] = None
    is_deleted: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedOrganizationsOut(BaseModel):
    items: List[OrganizationOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class DuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    existing_id: Optional[int] = None
    existing_name: Optional[str] = None
    message: str
