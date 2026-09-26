from datetime import datetime, timezone
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base


class DiscoveryStatus(str, enum.Enum):
    DISCOVERED = "discovered"
    SAVED = "saved"
    SKIPPED = "skipped"
    ADDED = "added"


class PotentialFit(str, enum.Enum):
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class DiscoveredOrganization(Base):
    __tablename__ = "discovered_organizations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    organization_type = Column(String(100), nullable=False, index=True, default="Unknown")
    country = Column(String(100), default=None)
    state = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True, index=True)
    address = Column(Text, nullable=True)
    website = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)

    # Discovery context & OpenOutreach-style parameters
    product_description = Column(Text, nullable=True)
    target_icp = Column(Text, nullable=True)
    discovery_objective = Column(Text, nullable=True)

    source_type = Column(String(100), default="search", nullable=False)
    source_name = Column(String(255), default="Approved Directory", nullable=False)
    source_url = Column(String(500), nullable=True)

    status = Column(String(50), default=DiscoveryStatus.DISCOVERED.value, nullable=False, index=True)
    potential_fit = Column(String(50), nullable=True)
    potential_fit_score = Column(Integer, default=75, nullable=False)
    qualification_reason = Column(Text, nullable=True)

    # Deduplication link if matching organization is detected in ELLY CRM
    matched_existing_org_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)

    # Search history reference for tracking discovery runs
    search_history_id = Column(Integer, ForeignKey("discovery_search_history.id", ondelete="SET NULL"), nullable=True, index=True)

    # Added link once converted into ELLY CRM
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True)
    discovered_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    search_history = relationship("DiscoverySearchHistory", foreign_keys=[search_history_id])
    organization = relationship("Organization", foreign_keys=[organization_id], backref="discovery_source")
    matched_existing_org = relationship("Organization", foreign_keys=[matched_existing_org_id])
    discovered_by = relationship("User", foreign_keys=[discovered_by_id])
    contacts = relationship("DiscoveredContact", back_populates="discovered_org", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DiscoveredOrganization id={self.id} name='{self.name}' status='{self.status}' fit='{self.potential_fit}'>"


class DiscoveredContact(Base):
    __tablename__ = "discovered_contacts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    discovered_org_id = Column(Integer, ForeignKey("discovered_organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    full_name = Column(String(255), nullable=False)
    job_title = Column(String(255), nullable=False)
    seniority_level = Column(String(100), nullable=True)  # e.g., C-Suite, Executive, Director, Head
    department = Column(String(100), nullable=True)  # e.g., Digital Transformation, Technology, Business Development
    business_relevance = Column(Text, nullable=True)

    email = Column(String(255), nullable=True)
    email_status = Column(String(50), default="unverified", nullable=False)  # unverified, enriched, unavailable
    phone = Column(String(100), nullable=True)
    linkedin_url = Column(String(500), nullable=True)

    fit_level = Column(String(50), default=PotentialFit.HIGH.value, nullable=False)
    fit_reason = Column(Text, nullable=True)
    status = Column(String(50), default=DiscoveryStatus.DISCOVERED.value, nullable=False, index=True)

    # Deduplication link if matching contact is detected in ELLY CRM
    matched_existing_contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    discovered_org = relationship("DiscoveredOrganization", back_populates="contacts")
    matched_existing_contact = relationship("Contact", foreign_keys=[matched_existing_contact_id])

    def __repr__(self):
        return f"<DiscoveredContact id={self.id} name='{self.full_name}' title='{self.job_title}' fit='{self.fit_level}'>"


class DiscoverySearchHistory(Base):
    __tablename__ = "discovery_search_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    
    query_keyword = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    organization_type = Column(String(100), nullable=True)
    product_description = Column(Text, nullable=True)
    target_icp = Column(Text, nullable=True)
    discovery_objective = Column(Text, nullable=True)
    provider_used = Column(String(100), default="Curated Healthcare Directory", nullable=False)

    results_count = Column(Integer, default=0, nullable=False)
    contacts_found = Column(Integer, default=0, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<DiscoverySearchHistory id={self.id} kw='{self.query_keyword}' loc='{self.location}' orgs={self.results_count}>"
