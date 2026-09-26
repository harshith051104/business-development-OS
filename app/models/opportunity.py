import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class OpportunityStage(str, enum.Enum):
    # 10-Stage Commercial Funnel
    NEW = "New"
    CONTACTED = "Contacted"
    RESPONDED = "Responded"
    MEETING = "Meeting"
    DEMO = "Demo"
    DISCUSSION = "Discussion"
    PROPOSAL = "Proposal"
    NEGOTIATION = "Negotiation"
    PARTNERSHIP = "Partnership"
    CUSTOMER = "Customer"

    # Backward-compatible aliases for historical records
    POTENTIAL = "Potential"
    CONNECTED = "Connected"
    INTERESTED = "Interested"


class OpportunityPriority(str, enum.Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    primary_contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    stage = Column(String(50), nullable=False, default=OpportunityStage.POTENTIAL.value, index=True)
    priority = Column(String(20), nullable=False, default=OpportunityPriority.MEDIUM.value, index=True)

    estimated_value = Column(Float, nullable=True)
    currency = Column(String(10), default="USD", nullable=False)
    probability = Column(Integer, nullable=True)  # 0 to 100
    expected_close_date = Column(DateTime, nullable=True)

    next_action = Column(String(255), nullable=True)
    next_action_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    created_by = Column(String(150), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    organization = relationship("Organization", foreign_keys=[organization_id])
    primary_contact = relationship("Contact", foreign_keys=[primary_contact_id])
    project = relationship("Project", foreign_keys=[project_id])
    owner = relationship("User", foreign_keys=[owner_id])
    activities = relationship("ContactActivity", foreign_keys="ContactActivity.opportunity_id", cascade="all, delete-orphan")
    meetings = relationship("Meeting", foreign_keys="Meeting.opportunity_id", back_populates="opportunity", cascade="all, delete-orphan")
    followups = relationship("FollowUp", foreign_keys="FollowUp.opportunity_id", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Opportunity id={self.id} name='{self.name}' org_id={self.organization_id} stage='{self.stage}'>"
