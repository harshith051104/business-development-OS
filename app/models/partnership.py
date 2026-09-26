import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class PartnershipType(str, enum.Enum):
    TECHNOLOGY_PARTNERSHIP = "Technology Partnership"
    BUSINESS_PARTNERSHIP = "Business Partnership"
    STRATEGIC_PARTNERSHIP = "Strategic Partnership"
    INTEGRATION_PARTNERSHIP = "Integration Partnership"
    SERVICE_PARTNERSHIP = "Service Partnership"
    DISTRIBUTION_PARTNERSHIP = "Distribution Partnership"
    REFERRAL_PARTNERSHIP = "Referral Partnership"
    OTHER = "Other"


class PartnershipStatus(str, enum.Enum):
    ACTIVE = "Active"
    ON_HOLD = "On Hold"
    COMPLETED = "Completed"
    ENDED = "Ended"


class PartnershipPriority(str, enum.Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Partnership(Base):
    __tablename__ = "partnerships"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    primary_contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    name = Column(String(255), nullable=False, index=True)
    partnership_type = Column(String(100), nullable=False, default=PartnershipType.BUSINESS_PARTNERSHIP.value, index=True)
    status = Column(String(50), nullable=False, default=PartnershipStatus.ACTIVE.value, index=True)
    priority = Column(String(20), nullable=False, default=PartnershipPriority.MEDIUM.value, index=True)

    start_date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    end_date = Column(DateTime, nullable=True)
    objectives = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    next_action = Column(String(255), nullable=True)
    next_action_date = Column(DateTime, nullable=True)

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
        return f"<Partnership id={self.id} name='{self.name}' status='{self.status}'>"
