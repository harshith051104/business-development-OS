import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class ProposalStatus(str, enum.Enum):
    DRAFT = "Draft"
    INTERNAL_REVIEW = "Internal Review"
    SENT = "Sent"
    VIEWED = "Viewed"
    UNDER_DISCUSSION = "Under Discussion"
    ACCEPTED = "Accepted"
    REJECTED = "Rejected"


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    primary_contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=False, index=True)
    version = Column(String(50), nullable=False, default="v1.0")
    value = Column(Float, nullable=True, default=0.0)
    currency = Column(String(10), default="USD", nullable=False)
    status = Column(String(50), nullable=False, default=ProposalStatus.DRAFT.value, index=True)

    content_summary = Column(Text, nullable=True)
    scope_of_work = Column(Text, nullable=True)
    commercial_terms = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    date_created = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    date_sent = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)

    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    created_by = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    organization = relationship("Organization", foreign_keys=[organization_id])
    opportunity = relationship("Opportunity", foreign_keys=[opportunity_id])
    primary_contact = relationship("Contact", foreign_keys=[primary_contact_id])
    project = relationship("Project", foreign_keys=[project_id])
    owner = relationship("User", foreign_keys=[owner_id])

    def __repr__(self):
        return f"<Proposal id={self.id} title='{self.title}' org_id={self.organization_id} status='{self.status}'>"
