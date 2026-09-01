import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON
from app.core.database import Base


class ProjectCategory(str, enum.Enum):
    HEALTHCARE = "Healthcare"
    ARTIFICIAL_INTELLIGENCE = "Artificial Intelligence"
    DATA_SCIENCE = "Data Science"
    AUTOMATION = "Automation"
    COMMUNICATION = "Communication"
    BUSINESS = "Business"
    WEB_PLATFORM = "Web Platform"
    MOBILE_APP = "Mobile Application"
    OTHER = "Other"


class ProjectStatus(str, enum.Enum):
    DRAFT = "Draft"
    REVIEW = "Review"
    PUBLISHED = "Published"
    ACTIVE = "Active"
    COMING_SOON = "Coming Soon"
    ARCHIVED = "Archived"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(255), nullable=False, unique=True, index=True)
    short_description = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=False, default=ProjectCategory.HEALTHCARE.value, index=True)
    status = Column(String(50), nullable=False, default=ProjectStatus.ACTIVE.value, index=True)

    thumbnail_url = Column(String(500), nullable=True)
    images = Column(JSON, nullable=True, default=list)  # list of {"url": str, "caption": str}
    video_url = Column(String(500), nullable=True)

    demo_url = Column(String(500), nullable=True)
    website_url = Column(String(500), nullable=True)
    repository_url = Column(String(500), nullable=True)
    presentation_url = Column(String(500), nullable=True)

    key_features = Column(JSON, nullable=True, default=list)  # list of str
    business_value = Column(JSON, nullable=True, default=dict)  # {"problem_solved": str, "target_audience": str, "value_proposition": str, "target_organizations": str}
    business_use_cases = Column(JSON, nullable=True, default=list)  # list of {"title": str, "description": str}
    tags = Column(JSON, nullable=True, default=list)  # list of str

    sort_order = Column(Integer, default=0, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self):
        return f"<Project id={self.id} name='{self.name}' category='{self.category}' status='{self.status}'>"
