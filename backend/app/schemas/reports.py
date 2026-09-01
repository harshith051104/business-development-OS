from typing import List, Dict, Any
from pydantic import BaseModel


class StageMetrics(BaseModel):
    stage: str
    count: int
    total_value: float
    avg_days_in_stage: float
    conversion_rate_to_next: float


class FunnelReportResponse(BaseModel):
    total_leads: int
    total_organizations: int
    total_contacts: int
    total_emails_sent: int
    total_calls_logged: int
    total_meetings_completed: int
    total_demos_completed: int
    total_proposals_active: int
    total_negotiations_active: int
    total_partnerships_active: int
    total_customers_active: int
    total_pipeline_value: float
    overall_win_rate: float
    average_sales_cycle_days: float
    stages: List[StageMetrics]
    lead_source_breakdown: Dict[str, int]
    rep_performance: List[Dict[str, Any]]
