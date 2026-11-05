from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

FinancialMetricKey = Literal["revenue", "net_income", "total_assets", "total_liabilities", "cash"]
FinancialHealthLabel = Literal["strong", "mixed", "weak", "stale", "insufficient_data"]


class FinancialPointOut(BaseModel):
    period_end: str
    fiscal_year: Optional[int] = None
    value: float
    concept: str
    form: str
    filed: str
    accession: str
    source_url: str

    model_config = ConfigDict(from_attributes=True)


class FinancialHealthOut(BaseModel):
    label: FinancialHealthLabel
    reasons: List[str]
    revenue_growth: Optional[float] = None
    net_margin: Optional[float] = None
    period_end: Optional[str] = None


class OrganizationFinancialsDataOut(BaseModel):
    entity_name: Optional[str] = None
    currency: str
    dataset_url: str
    company_url: str
    metrics: Dict[str, List[FinancialPointOut]]


class OrganizationFinancialsOut(BaseModel):
    linked: bool
    source: Optional[str] = None
    cik: Optional[str] = None
    entity_name: Optional[str] = None
    fetched_at: Optional[str] = None
    fetch_status: Optional[Literal["ok", "error"]] = None
    fetch_error: Optional[str] = None
    data: Optional[OrganizationFinancialsDataOut] = None
    health: FinancialHealthOut


class LinkFinancialsRequest(BaseModel):
    cik: str = Field(..., min_length=1, description="SEC EDGAR Central Index Key (CIK) for the public company")
