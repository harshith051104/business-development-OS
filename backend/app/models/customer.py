import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class CustomerStatus(str, enum.Enum):
    PROSPECT = "Prospect"
    ONBOARDING = "Onboarding"
    ACTIVE = "Active"
    AT_RISK = "At Risk"
    RENEWAL = "Renewal"
    CHURNED = "Churned"


class AccountHealth(str, enum.Enum):
    EXCELLENT = "Excellent"
    GOOD = "Good"
    NEEDS_ATTENTION = "Needs Attention"
    CRITICAL = "Critical"


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    primary_contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_id = Column(Integer, ForeignKey("opportunities.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    contract_value = Column(Float, nullable=True, default=0.0)
    currency = Column(String(10), default="USD", nullable=False)
    status = Column(String(50), nullable=False, default=CustomerStatus.ACTIVE.value, index=True)
    account_health = Column(String(50), nullable=False, default=AccountHealth.GOOD.value, index=True)

    start_date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    renewal_date = Column(DateTime, nullable=True)
    next_review_date = Column(DateTime, nullable=True)

    notes = Column(Text, nullable=True)
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
    primary_contact = relationship("Contact", foreign_keys=[primary_contact_id])
    opportunity = relationship("Opportunity", foreign_keys=[opportunity_id])
    project = relationship("Project", foreign_keys=[project_id])
    owner = relationship("User", foreign_keys=[owner_id])

    def __repr__(self):
        return f"<Customer id={self.id} org_id={self.organization_id} status='{self.status}' health='{self.account_health}'>"
