import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.core.database import Base


class OrganizationType(str, enum.Enum):
    HOSPITAL = "Hospital"
    HOSPITAL_GROUP = "Hospital Group"
    CLINIC = "Clinic"
    DIAGNOSTIC_CENTER = "Diagnostic Center"
    HEALTHCARE_COMPANY = "Healthcare Company"
    HEALTHCARE_TECH = "Healthcare Technology Company"
    MEDICAL_INFRASTRUCTURE = "Medical Infrastructure Company"
    HOME_HEALTHCARE = "Home Healthcare"
    ELDER_CARE = "Elder Care"
    PHARMACY = "Pharmacy"
    MEDICAL_EQUIPMENT = "Medical Equipment Company"
    INSURANCE = "Insurance Company"
    NGO = "NGO"
    OTHER = "Other"


class ConnectionStatus(str, enum.Enum):
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


class PriorityLevel(str, enum.Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    organization_type = Column(String(100), nullable=False, default="Technology Company")
    description = Column(Text, nullable=True)
    website = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True, default=None)
    state = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True, index=True)
    address = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_precision = Column(String(20), nullable=True, default=None)  # EXACT, APPROXIMATE, None
    location_source = Column(String(50), nullable=True, default=None)    # nominatim, google, manual, city_fallback
    industry = Column(String(100), nullable=True, default="Unknown")
    size = Column(String(50), nullable=True, default="200-1000")
    status = Column(String(50), nullable=False, default=ConnectionStatus.POTENTIAL.value)
    priority = Column(String(20), nullable=False, default=PriorityLevel.MEDIUM.value)
    notes = Column(Text, nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_by = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    contacts = relationship(
        "Contact",
        back_populates="organization",
        cascade="all, delete-orphan",
        order_by="desc(Contact.is_primary_contact), desc(Contact.is_decision_maker), Contact.first_name",
    )
    owner = relationship("User", foreign_keys=[owner_id], lazy="joined")

    @property
    def owner_name(self):
        return self.owner.name if self.owner else None

    @property
    def owner_email(self):
        return self.owner.email if self.owner else None

    def __repr__(self):
        return f"<Organization id={self.id} name='{self.name}' status='{self.status}' priority='{self.priority}'>"
