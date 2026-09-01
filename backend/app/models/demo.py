import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class DemoStatus(str, enum.Enum):
    SCHEDULED = "Scheduled"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"
    RESCHEDULED = "Rescheduled"


class DemoOutcome(str, enum.Enum):
    INTERESTED = "Interested"
    PROPOSAL_REQUESTED = "Proposal Requested"
    NEEDS_FOLLOW_UP = "Needs Follow-up"
    NOT_INTERESTED = "Not Interested"
    PENDING = "Pending"


class Demo(Base):
    __tablename__ = "demos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True, index=True)
    primary_contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=False, index=True)
    status = Column(String(50), nullable=False, default=DemoStatus.SCHEDULED.value, index=True)
    outcome = Column(String(50), nullable=False, default=DemoOutcome.PENDING.value, index=True)

    scheduled_at = Column(DateTime, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)

    participants = Column(Text, nullable=True)  # List or notes on attendees
    customer_requirements = Column(Text, nullable=True)
    demo_notes = Column(Text, nullable=True)
    next_action = Column(String(255), nullable=True)

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
    meeting = relationship("Meeting", foreign_keys=[meeting_id])
    primary_contact = relationship("Contact", foreign_keys=[primary_contact_id])
    project = relationship("Project", foreign_keys=[project_id])
    owner = relationship("User", foreign_keys=[owner_id])

    def __repr__(self):
        return f"<Demo id={self.id} title='{self.title}' org_id={self.organization_id} status='{self.status}'>"
