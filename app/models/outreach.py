from datetime import datetime, timezone
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class OutreachChannel(str, enum.Enum):
    EMAIL = "Email"
    PHONE = "Phone"
    LINKEDIN = "LinkedIn"
    WHATSAPP = "WhatsApp"
    OTHER = "Other"


class DraftStatus(str, enum.Enum):
    DRAFT = "Draft"
    READY = "Ready"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


class TemplateCategory(str, enum.Enum):
    INTRODUCTION = "Introduction"
    PROJECT_SHOWCASE = "Project Showcase"
    MEETING_REQUEST = "Meeting Request"
    FOLLOW_UP = "Follow-up"
    PARTNERSHIP_DISCUSSION = "Partnership Discussion"


class OutreachDraft(Base):
    __tablename__ = "outreach_drafts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)

    channel = Column(String(50), default=OutreachChannel.EMAIL.value, nullable=False, index=True)
    subject = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)
    call_purpose = Column(String(255), nullable=True)
    status = Column(String(50), default=DraftStatus.DRAFT.value, nullable=False, index=True)

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    organization = relationship("Organization", foreign_keys=[organization_id], backref="outreach_drafts")
    contact = relationship("Contact", foreign_keys=[contact_id])
    opportunity = relationship("Opportunity", foreign_keys=[opportunity_id])
    project = relationship("Project", foreign_keys=[project_id])
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<OutreachDraft id={self.id} org_id={self.organization_id} channel='{self.channel}' status='{self.status}'>"


class OutreachTemplate(Base):
    __tablename__ = "outreach_templates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), default=TemplateCategory.INTRODUCTION.value, nullable=False, index=True)
    channel = Column(String(50), default=OutreachChannel.EMAIL.value, nullable=False, index=True)
    subject = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<OutreachTemplate id={self.id} name='{self.name}' category='{self.category}'>"
