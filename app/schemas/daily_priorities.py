from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class PriorityItem(BaseModel):
    category: str
    title: str
    target_name: str
    target_type: str
    target_id: int
    priority: str
    reason_why: str
    recommended_action: str
    url: str
    urgency_score: Optional[int] = None
    estimated_impact: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DailyPrioritiesResponse(BaseModel):
    summary: str
    top_5_today: List[PriorityItem] = []
    total_priority_count: int
    who_should_i_contact_today: Optional[PriorityItem] = None
    who_needs_followup: Optional[PriorityItem] = None
    which_meeting_is_next: Optional[PriorityItem] = None
    which_opportunity_is_most_important: Optional[PriorityItem] = None
    which_deal_is_stale: Optional[PriorityItem] = None
    which_proposal_needs_attention: Optional[PriorityItem] = None
    which_negotiation_needs_attention: Optional[PriorityItem] = None
    which_customer_needs_attention: Optional[PriorityItem] = None
    what_should_i_do_next: str
    all_priority_items: List[PriorityItem] = []
