from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class OverviewMetricsOut(BaseModel):
    total_organizations: int = 0
    total_contacts: int = 0
    total_connections: int = 0
    interested_organizations: int = 0
    total_meetings: int = 0
    active_discussions: int = 0
    active_opportunities: int = 0
    partnerships_established: int = 0


class PipelineStageCountOut(BaseModel):
    stage: str
    count: int
    percentage: float


class ConversionRateItem(BaseModel):
    from_stage: str
    to_stage: str
    rate: Optional[float] = None  # None if insufficient data
    from_count: int
    to_count: int
    is_sufficient_data: bool = True


class ConversionRatesOut(BaseModel):
    contacted_to_connected: ConversionRateItem
    connected_to_interested: ConversionRateItem
    interested_to_meeting: ConversionRateItem
    meeting_to_discussion: ConversionRateItem
    discussion_to_partnership: ConversionRateItem
    overall_funnel: ConversionRateItem


class GrowthPointOut(BaseModel):
    period_label: str
    count: int
    date: Optional[str] = None


class MeetingAnalyticsOut(BaseModel):
    total: int = 0
    completed: int = 0
    scheduled: int = 0
    cancelled: int = 0
    rescheduled: int = 0
    completion_rate: Optional[float] = None


class FollowUpAnalyticsOut(BaseModel):
    total: int = 0
    completed: int = 0
    pending: int = 0
    overdue: int = 0
    cancelled: int = 0
    completion_rate: Optional[float] = None


class OpportunityAnalyticsOut(BaseModel):
    total: int = 0
    active: int = 0
    high_priority: int = 0
    no_next_action: int = 0
    stage_distribution: Dict[str, int] = {}
    total_estimated_value: Optional[float] = None
    has_financial_data: bool = False
    currency: str = "USD"


class CommunicationAnalyticsOut(BaseModel):
    total: int = 0
    channel_counts: Dict[str, int] = {}
    direction_counts: Dict[str, int] = {}


class ActivityVolumeOut(BaseModel):
    organizations_added: int = 0
    contacts_added: int = 0
    communications_recorded: int = 0
    meetings_completed: int = 0
    followups_completed: int = 0
    opportunities_created: int = 0


class TeamMemberPerformanceOut(BaseModel):
    user_id: int
    name: str
    email: str
    organizations_added: int = 0
    contacts_added: int = 0
    communications_logged: int = 0
    meetings_completed: int = 0
    opportunities_managed: int = 0
    followups_completed: int = 0


class TopOpportunityOut(BaseModel):
    id: int
    name: str
    organization_id: int
    organization_name: str
    stage: str
    priority: str
    estimated_value: Optional[float] = None
    currency: str = "USD"
    probability: int = 0
    next_action: Optional[str] = None
    next_action_date: Optional[datetime] = None
    owner_name: Optional[str] = None


class StaleOrganizationOut(BaseModel):
    id: int
    name: str
    status: str
    priority: str
    days_since_last_activity: int
    last_activity_date: Optional[datetime] = None
    primary_contact_name: Optional[str] = None


class AttentionRequiredOut(BaseModel):
    overdue_followups_count: int = 0
    opportunities_no_next_action_count: int = 0
    interested_no_meeting_count: int = 0
    stale_organizations_count: int = 0

    overdue_followups: List[Dict[str, Any]] = []
    opportunities_no_next_action: List[Dict[str, Any]] = []
    interested_no_meeting: List[Dict[str, Any]] = []
    stale_organizations: List[StaleOrganizationOut] = []


class ComprehensiveAnalyticsOut(BaseModel):
    date_range: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    overview: OverviewMetricsOut
    pipeline: List[PipelineStageCountOut]
    conversion_rates: ConversionRatesOut
    organization_growth: List[GrowthPointOut]
    meetings: MeetingAnalyticsOut
    followups: FollowUpAnalyticsOut
    opportunities: OpportunityAnalyticsOut
    communications: CommunicationAnalyticsOut
    activity_volume: ActivityVolumeOut
    team_performance: List[TeamMemberPerformanceOut]
    top_opportunities: List[TopOpportunityOut]
    attention_required: AttentionRequiredOut
