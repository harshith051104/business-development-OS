from datetime import datetime
import re
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator


# ── User Management Schemas ──

class AdminUserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=100)
    role: str = Field(default="BUSINESS_DEVELOPMENT")
    is_active: bool = Field(default=True)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Name cannot be empty.")
        return trimmed

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        trimmed = v.strip().lower()
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", trimmed):
            raise ValueError("Invalid email format.")
        return trimmed

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        upper = v.strip().upper()
        if upper not in ["ADMIN", "BUSINESS_DEVELOPMENT"]:
            raise ValueError("Role must be either ADMIN or BUSINESS_DEVELOPMENT.")
        return upper


class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        upper = v.strip().upper()
        if upper not in ["ADMIN", "BUSINESS_DEVELOPMENT"]:
            raise ValueError("Role must be either ADMIN or BUSINESS_DEVELOPMENT.")
        return upper


class AdminUserStatusUpdate(BaseModel):
    is_active: bool = Field(..., description="Target active status (True/False)")


class AdminUserRoleUpdate(BaseModel):
    role: str = Field(..., description="Target role: ADMIN or BUSINESS_DEVELOPMENT")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        upper = v.strip().upper()
        if upper not in ["ADMIN", "BUSINESS_DEVELOPMENT"]:
            raise ValueError("Role must be either ADMIN or BUSINESS_DEVELOPMENT.")
        return upper


class AdminUserActivitySummary(BaseModel):
    organizations_count: int = 0
    contacts_count: int = 0
    meetings_count: int = 0
    opportunities_count: int = 0
    partnerships_count: int = 0


class AdminUserDetailOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    activity: AdminUserActivitySummary
    recent_actions: List[Dict[str, Any]] = []
    owned_organizations: List[Dict[str, Any]] = []
    owned_opportunities: List[Dict[str, Any]] = []
    owned_partnerships: List[Dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True)


class PaginatedAdminUsersOut(BaseModel):
    items: List[AdminUserOut]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── BD Team Schemas ──

class AdminTeamMemberOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    organizations_count: int = 0
    opportunities_count: int = 0
    partnerships_count: int = 0
    last_activity_date: Optional[datetime] = None


class AdminTeamListOut(BaseModel):
    items: List[AdminTeamMemberOut]
    total: int


# ── Dashboard Schemas ──

class AdminDashboardStatsOut(BaseModel):
    total_users: int = 0
    active_bd_users: int = 0
    active_organizations: int = 0
    active_opportunities: int = 0
    active_partnerships: int = 0
    recent_system_activity: List[Dict[str, Any]] = []


# ── Ownership & Assignment Schemas ──

class AdminBulkAssignmentPayload(BaseModel):
    organization_ids: List[int] = []
    opportunity_ids: List[int] = []
    partnership_ids: List[int] = []
    owner_id: Optional[int] = Field(None, description="BD user ID to assign, or None to clear")


class AdminAssignmentResult(BaseModel):
    success: bool
    message: str
    updated_organizations: int
    updated_opportunities: int
    updated_partnerships: int


# ── Showcase Governance Schemas ──

class AdminProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = None
    short_description: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=1)
    category: str = Field(default="Healthcare")
    status: str = Field(default="Draft", description="Draft, Review, Published, Archived")
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    demo_url: Optional[str] = None
    website_url: Optional[str] = None
    presentation_url: Optional[str] = None
    key_features: List[str] = []
    business_value: Dict[str, Any] = {}
    business_use_cases: List[Dict[str, Any]] = []
    tags: List[str] = []
    is_featured: bool = False


class AdminProjectUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    demo_url: Optional[str] = None
    website_url: Optional[str] = None
    presentation_url: Optional[str] = None
    key_features: Optional[List[str]] = None
    business_value: Optional[Dict[str, Any]] = None
    business_use_cases: Optional[List[Dict[str, Any]]] = None
    tags: Optional[List[str]] = None
    is_featured: Optional[bool] = None


class AdminProjectStatusUpdate(BaseModel):
    status: str = Field(..., description="Target status: Draft, Review, Published, Archived")


# ── System Settings Schemas ──

class SystemSettingsOut(BaseModel):
    organization_types: List[str]
    connection_statuses: List[str]
    partnership_types: List[str]
    meeting_types: List[str]
    priority_levels: List[str]
    project_categories: List[str]


class SystemSettingsUpdate(BaseModel):
    organization_types: Optional[List[str]] = None
    partnership_types: Optional[List[str]] = None
    meeting_types: Optional[List[str]] = None
    project_categories: Optional[List[str]] = None
