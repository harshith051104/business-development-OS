from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator


class ProjectImage(BaseModel):
    url: str
    caption: Optional[str] = None


class BusinessValue(BaseModel):
    problem_solved: Optional[str] = None
    target_audience: Optional[str] = None
    value_proposition: Optional[str] = None
    target_organizations: Optional[str] = None


class BusinessUseCase(BaseModel):
    title: str
    description: str
    target_outcome: Optional[str] = None


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    slug: Optional[str] = Field(None, max_length=255, description="URL-friendly slug")
    short_description: str = Field(..., min_length=1, max_length=500, description="Elevator pitch / summary")
    description: str = Field(..., min_length=1, description="Comprehensive business description")
    category: str = Field(default="Healthcare", max_length=100, description="Project category")
    status: str = Field(default="Active", max_length=50, description="Project status: Active, Coming Soon, Archived")
    thumbnail_url: Optional[str] = Field(None, description="Card cover image URL")
    images: Optional[List[ProjectImage]] = Field(default=[], description="Gallery screenshots")
    video_url: Optional[str] = Field(None, description="Walkthrough video URL")
    demo_url: Optional[str] = Field(None, description="Live demo URL")
    website_url: Optional[str] = Field(None, description="Public website URL")
    repository_url: Optional[str] = Field(None, description="Public repository URL (optional)")
    presentation_url: Optional[str] = Field(None, description="Presentation deck URL")
    key_features: Optional[List[str]] = Field(default=[], description="Bullet list of features")
    business_value: Optional[BusinessValue] = Field(default=None, description="Business value proposition")
    business_use_cases: Optional[List[BusinessUseCase]] = Field(default=[], description="Realistic use case scenarios")
    tags: Optional[List[str]] = Field(default=[], description="Tags/keywords")
    sort_order: int = Field(default=0, description="Sort order for presentation")
    is_featured: bool = Field(default=False, description="Featured highlight flag")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Project name cannot be empty")
        return trimmed


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    thumbnail_url: Optional[str] = None
    images: Optional[List[ProjectImage]] = None
    video_url: Optional[str] = None
    demo_url: Optional[str] = None
    website_url: Optional[str] = None
    repository_url: Optional[str] = None
    presentation_url: Optional[str] = None
    key_features: Optional[List[str]] = None
    business_value: Optional[BusinessValue] = None
    business_use_cases: Optional[List[BusinessUseCase]] = None
    tags: Optional[List[str]] = None
    sort_order: Optional[int] = None
    is_featured: Optional[bool] = None


class ProjectOut(BaseModel):
    id: int
    name: str
    slug: str
    short_description: str
    category: str
    status: str
    thumbnail_url: Optional[str] = None
    demo_url: Optional[str] = None
    website_url: Optional[str] = None
    presentation_url: Optional[str] = None
    tags: List[str] = []
    sort_order: int
    is_featured: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectDetailOut(ProjectOut):
    description: str
    images: List[Dict[str, Any]] = []
    video_url: Optional[str] = None
    repository_url: Optional[str] = None
    key_features: List[str] = []
    business_value: Optional[Dict[str, Any]] = None
    business_use_cases: List[Dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True)


class PaginatedProjectsOut(BaseModel):
    items: List[ProjectOut]
    total: int
    page: int
    page_size: int
    total_pages: int
