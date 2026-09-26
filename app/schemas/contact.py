from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator
import re


class ContactBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100, description="Contact first name")
    last_name: Optional[str] = Field(None, max_length=100, description="Contact last name")
    designation: Optional[str] = Field(None, max_length=150, description="Role e.g. VP of Sales, CTO, CIO")
    department: Optional[str] = Field(None, max_length=150, description="Department e.g. Management, IT, Operations")
    email: Optional[str] = Field(None, max_length=255, description="Professional email address")
    phone: Optional[str] = Field(None, max_length=100, description="Contact phone number")
    linkedin_url: Optional[str] = Field(None, max_length=255, description="LinkedIn profile URL")
    location: Optional[str] = Field(None, max_length=150, description="City / Office location")
    is_decision_maker: bool = Field(default=False, description="Flag indicating executive decision-maker status")
    is_primary_contact: bool = Field(default=False, description="Primary contact flag for this organization")
    connection_status: str = Field(
        default="Not Contacted",
        description="Relationship status: Not Contacted, Contacted, Connected, Interested, Inactive",
    )
    notes: Optional[str] = None

    @field_validator("first_name")
    @classmethod
    def validate_first_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("First name cannot be empty")
        return trimmed

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        email = v.strip().lower()
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
            raise ValueError("Invalid email format")
        return email

    @field_validator("linkedin_url")
    @classmethod
    def validate_linkedin_url(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        url = v.strip()
        if not re.match(r'^(https?://)?(www\.)?linkedin\.com/(in|company)/', url):
            raise ValueError("LinkedIn URL must be a valid linkedin.com/in/ or linkedin.com/company/ URL")
        return url


class ContactCreate(ContactBase):
    organization_id: int = Field(..., description="ID of the parent organization")
    allow_duplicate: bool = Field(default=False, description="Allow creation even if duplicate warning triggered")


class ContactUpdate(BaseModel):
    organization_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    location: Optional[str] = None
    is_decision_maker: Optional[bool] = None
    is_primary_contact: Optional[bool] = None
    connection_status: Optional[str] = None
    notes: Optional[str] = None
    first_contacted_at: Optional[datetime] = None
    last_contacted_at: Optional[datetime] = None
    next_followup_at: Optional[datetime] = None


class ContactStatusUpdate(BaseModel):
    connection_status: str = Field(..., description="Target relationship status")
    note: Optional[str] = Field(None, description="Optional transition note or meeting notes")


class ContactNoteAdd(BaseModel):
    note: str = Field(..., min_length=1, description="Internal BD note content")


class ContactActivityOut(BaseModel):
    id: int
    activity_type: str
    description: str
    contact_id: Optional[int] = None
    organization_id: Optional[int] = None
    performed_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContactOut(BaseModel):
    id: int
    organization_id: int
    organization_name: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    full_name: str
    designation: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    location: Optional[str] = None
    is_decision_maker: bool
    is_primary_contact: bool
    connection_status: str
    first_contacted_at: Optional[datetime] = None
    last_contacted_at: Optional[datetime] = None
    next_followup_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContactDetailOut(ContactOut):
    notes: Optional[str] = None
    is_deleted: bool
    activities: List[ContactActivityOut] = []

    model_config = ConfigDict(from_attributes=True)


class PaginatedContactsOut(BaseModel):
    items: List[ContactOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class DuplicateContactCheckResponse(BaseModel):
    is_duplicate: bool
    existing_id: Optional[int] = None
    existing_name: Optional[str] = None
    reason: Optional[str] = None
    message: str
