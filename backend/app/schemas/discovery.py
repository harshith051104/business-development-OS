from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field


class DiscoverySearchQuery(BaseModel):
    keyword: Optional[str] = None
    location: Optional[str] = None
    organization_type: Optional[str] = None
    industry: Optional[str] = None
    product_description: Optional[str] = Field(None, description="What our company/project provides")
    target_icp: Optional[str] = Field(None, description="Target market or Ideal Customer Profile")
    discovery_objective: Optional[str] = Field(None, description="Specific B2B discovery objective")
    provider: Optional[str] = Field(None, description="Discovery provider name")
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class DiscoveredContactOut(BaseModel):
    id: int
    discovered_org_id: int
    full_name: str
    job_title: str
    seniority_level: Optional[str] = None
    department: Optional[str] = None
    business_relevance: Optional[str] = None

    email: Optional[str] = None
    email_status: str = "unverified"
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None

    fit_level: str = "High"
    fit_reason: Optional[str] = None
    status: str = "discovered"

    matched_existing_contact_id: Optional[int] = None
    is_existing_duplicate: bool = False
    existing_contact_name: Optional[str] = None

    created_at: datetime

    class Config:
        from_attributes = True


class DiscoveredOrganizationOut(BaseModel):
    id: int
    name: str
    organization_type: str
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None

    product_description: Optional[str] = None
    target_icp: Optional[str] = None
    discovery_objective: Optional[str] = None

    source_type: str
    source_name: str
    source_url: Optional[str] = None

    status: str
    potential_fit: Optional[str] = None
    potential_fit_score: int = 75
    qualification_reason: Optional[str] = None

    organization_id: Optional[int] = None
    discovered_by_id: Optional[int] = None

    # Duplicate check metadata
    is_existing_duplicate: bool = False
    existing_org_id: Optional[int] = None
    existing_org_name: Optional[str] = None
    search_history_id: Optional[int] = None

    # Discovered decision-makers
    contacts: List[DiscoveredContactOut] = []

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedDiscoveryOut(BaseModel):
    items: List[DiscoveredOrganizationOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class DiscoveryQualifyIn(BaseModel):
    potential_fit: str = Field(..., description="High, Medium, or Low")
    qualification_reason: Optional[str] = None


class DiscoveryAddIn(BaseModel):
    priority: Optional[str] = "Medium"
    notes: Optional[str] = None
    custom_notes: Optional[str] = None
    allow_duplicate: bool = False
    selected_contact_ids: Optional[List[int]] = None


class ContactDiscoveryQuery(BaseModel):
    target_roles: Optional[List[str]] = Field(
        default=["CEO", "CTO", "CDO", "CIO", "VP of Sales", "Head of Business Development", "Head of Innovation"],
        description="Target executive roles to discover"
    )
    limit: int = Field(10, ge=1, le=50)


class ContactEnrichIn(BaseModel):
    contact_id: int


class DiscoveryHistoryOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    query_keyword: Optional[str] = None
    location: Optional[str] = None
    organization_type: Optional[str] = None
    product_description: Optional[str] = None
    target_icp: Optional[str] = None
    discovery_objective: Optional[str] = None
    provider_used: str = "Curated Healthcare Directory"
    results_count: int
    contacts_found: int = 0
    timestamp: datetime

    class Config:
        from_attributes = True


class DiscoveryStatsOut(BaseModel):
    total_discovered: int
    total_added: int
    total_saved: int
    total_skipped: int
    total_imported: int
    conversion_rate: Optional[float] = None
    is_sufficient_data: bool = False


class ProviderListOut(BaseModel):
    organization_providers: List[Dict[str, Any]]
    contact_providers: List[Dict[str, Any]]
    enrichment_providers: List[Dict[str, Any]]


class CsvImportRowValidation(BaseModel):
    row_number: int
    name: str
    organization_type: str
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    is_valid: bool
    is_duplicate: bool
    existing_org_name: Optional[str] = None
    errors: List[str] = []
    error_message: Optional[str] = None


class CsvImportPreviewOut(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    duplicate_rows: int
    valid_rows_count: Optional[int] = None
    invalid_rows_count: Optional[int] = None
    duplicate_rows_count: Optional[int] = None
    rows: List[CsvImportRowValidation] = []
    preview_rows: List[CsvImportRowValidation] = []


class CsvImportExecuteIn(BaseModel):
    rows: List[Dict[str, Any]]
    skip_duplicates: bool = True


class CsvImportResultOut(BaseModel):
    imported_count: int
    imported_ids: List[int] = []
    skipped_count: int
    errors: List[str] = []


class DiscoveryPromptParseIn(BaseModel):
    prompt: str


class DiscoveryPromptParseOut(BaseModel):
    keyword: Optional[str] = None
    location: Optional[str] = None
    organization_type: Optional[str] = None
    product_description: Optional[str] = None
    target_icp: Optional[str] = None
    discovery_objective: Optional[str] = None
    extracted_summary: Optional[str] = None
