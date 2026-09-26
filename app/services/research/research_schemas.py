from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ResearchSource(BaseModel):
    url: str
    source_type: str  # "website", "news", "linkedin", "directory", "press_release"
    extracted_text: Optional[str] = None
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ResearchSignal(BaseModel):
    type: str  # "digital_transformation", "expansion", "ai_adoption", etc.
    description: str
    source_url: Optional[str] = None
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    category: str = "business"  # "business", "technology", "leadership", "financial"


class OrganizationResearch(BaseModel):
    """Structured research output for an organization."""
    organization_name: str
    website: Optional[str] = None

    # Organization profile
    official_name: Optional[str] = None
    industry: Optional[str] = None
    organization_type: Optional[str] = None
    headquarters: Optional[str] = None
    locations: List[str] = []
    approximate_scale: Optional[str] = None  # "5000+ employees", "multi-location"
    services: List[str] = []
    specialties: List[str] = []

    # Business intelligence
    what_they_do: Optional[str] = None
    business_model: Optional[str] = None
    market_presence: Optional[str] = None
    recent_expansion: Optional[str] = None
    strategic_initiatives: List[str] = []

    # Technology signals
    ai_adoption: Optional[str] = None
    digital_transformation: Optional[str] = None
    cloud_adoption: Optional[str] = None
    automation: Optional[str] = None
    technology_initiatives: List[str] = []

    # Research metadata
    sources: List[ResearchSource] = []
    signals: List[ResearchSignal] = []
    research_timestamp: datetime = Field(default_factory=datetime.utcnow)
    research_status: str = "completed"  # "not_researched", "researching", "completed", "failed"


class QualificationFactor(BaseModel):
    factor: str
    weight: int  # 0-25
    score: int   # 0-weight
    reason: str


class QualificationResult(BaseModel):
    score: int = Field(0, ge=0, le=100)
    tier: str = "Low"  # "High", "Medium", "Low"
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    factors: List[QualificationFactor] = []
    positive_signals: List[str] = []
    negative_signals: List[str] = []
    missing_information: List[str] = []


class DecisionMakerContact(BaseModel):
    name: str
    role: str
    organization_name: str
    email: Optional[str] = None
    email_status: str = "unverified"  # "verified", "unverified", "unavailable"
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    source: str = "unknown"  # "website", "openoutreach", "bettercontact", "linkedin"
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    decision_maker_score: int = Field(0, ge=0, le=100)


class ResearchBrief(BaseModel):
    """Account Intelligence Brief for BD review."""
    organization_name: str
    fit_score: int = 0
    priority: str = "Medium"

    why_contact: str = ""
    potential_elly_opportunity: str = ""
    best_contact_role: str = ""
    recommended_approach: str = ""

    company_overview: str = ""
    what_they_do: str = ""
    business_signals: List[str] = []
    technology_signals: List[str] = []
    recommended_showcase_projects: List[str] = []
    risks_and_unknowns: List[str] = []
    sources: List[str] = []


class ProjectMatch(BaseModel):
    project_name: str
    project_id: int
    relevance_score: int = Field(0, ge=0, le=100)
    match_reason: str = ""
    category: str = ""


class DiscoveryAnalytics(BaseModel):
    leads_discovered: int = 0
    leads_qualified: int = 0
    high_fit_leads: int = 0
    research_completed: int = 0
    decision_makers_found: int = 0
    verified_contacts: int = 0
    leads_added_to_crm: int = 0
    leads_rejected: int = 0
    duplicate_rate: float = 0.0
    source_performance: Dict[str, Dict[str, int]] = {}
    average_qualification_score: float = 0.0
