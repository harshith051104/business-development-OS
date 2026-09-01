from datetime import datetime, timezone
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class ResearchStatus(str, enum.Enum):
    NOT_RESEARCHED = "not_researched"
    RESEARCHING = "researching"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


class OrganizationResearchRecord(Base):
    """Persisted research results. Supports both per-discovery-org and standalone caching."""
    __tablename__ = "organization_research"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    discovered_org_id = Column(Integer, ForeignKey("discovered_organizations.id", ondelete="CASCADE"), nullable=True, index=True)

    # Organization identification (for standalone caching)
    organization_name = Column(String(500), nullable=True, index=True)
    domain = Column(String(500), nullable=True, index=True)

    # Research data (JSON blobs)
    research_data = Column(Text, nullable=True)  # Full research JSON
    signals_json = Column(Text, nullable=True)   # ResearchSignal list JSON
    sources_json = Column(Text, nullable=True)   # ResearchSource list JSON
    signals = Column(JSON, nullable=True)        # Structured signals dict
    source_urls = Column(JSON, nullable=True)    # List of source URLs

    # Qualification
    qualification_score = Column(Integer, default=0)
    qualification_tier = Column(String(20), default="Low")
    qualification_factors_json = Column(Text, nullable=True)
    qualification = Column(JSON, nullable=True)  # Full qualification result

    # Decision makers
    decision_makers = Column(JSON, nullable=True)

    # Brief
    brief_json = Column(Text, nullable=True)

    # Research metadata
    research_status = Column(String(50), default=ResearchStatus.NOT_RESEARCHED.value, nullable=False)
    research_version = Column(String(50), nullable=True)
    provider_used = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)

    # Cache control
    research_date = Column(DateTime, nullable=True)
    researched_at = Column(DateTime, nullable=True)
    cache_expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    discovered_org = relationship("DiscoveredOrganization", foreign_keys=[discovered_org_id])

    def __repr__(self):
        return f"<OrganizationResearch id={self.id} org='{self.organization_name}' status='{self.research_status}'>"


class DiscoveryIntelligenceMetric(Base):
    """Tracks discovery intelligence metrics for analytics."""
    __tablename__ = "discovery_intelligence_metrics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    leads_discovered = Column(Integer, default=0)
    leads_qualified = Column(Integer, default=0)
    high_fit_leads = Column(Integer, default=0)
    research_completed = Column(Integer, default=0)
    decision_makers_found = Column(Integer, default=0)
    verified_contacts = Column(Integer, default=0)
    leads_added_to_crm = Column(Integer, default=0)
    leads_rejected = Column(Integer, default=0)
    source_name = Column(String(100), default="unknown")
    average_qualification_score = Column(Float, default=0.0)

    def __repr__(self):
        return f"<DiscoveryMetric date={self.date} discovered={self.leads_discovered}>"
