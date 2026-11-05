from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel

from app.schemas.organization_financials import FinancialHealthOut


class InsightPointOut(BaseModel):
    fiscal_year: Optional[int] = None
    period_end: str
    value: float
    form: str
    filed: str
    source_url: str


class InsightFinancialsOut(BaseModel):
    entity_name: Optional[str] = None
    cik: str
    currency: str
    company_url: Optional[str] = None
    fetched_at: Optional[str] = None
    fetch_status: Optional[str] = None
    health: FinancialHealthOut
    metrics: Dict[str, List[InsightPointOut]]


class InsightOrganizationOut(BaseModel):
    id: int
    name: str
    organization_type: str
    industry: Optional[str] = None
    priority: str
    status: str
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    created_at: datetime
    financials: Optional[InsightFinancialsOut] = None


class InsightsResponseOut(BaseModel):
    items: List[InsightOrganizationOut]
    truncated: bool
    limit: int
    owner_scope: str
