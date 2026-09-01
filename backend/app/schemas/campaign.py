from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


# Sequence Step schemas
class CampaignSequenceStepBase(BaseModel):
    step_number: int = Field(..., ge=1)
    delay_days: int = Field(0, ge=0)
    channel: str = "Email"
    subject_template: Optional[str] = None
    body_template: str
    notes: Optional[str] = None


class CampaignSequenceStepCreate(CampaignSequenceStepBase):
    pass


class CampaignSequenceStepUpdate(BaseModel):
    step_number: Optional[int] = None
    delay_days: Optional[int] = None
    channel: Optional[str] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    notes: Optional[str] = None


class CampaignSequenceStepOut(CampaignSequenceStepBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    campaign_id: int
    created_at: datetime
    updated_at: datetime


# Campaign Contact schemas
class CampaignContactAddRequest(BaseModel):
    contact_ids: List[int] = Field(..., min_length=1)


class CampaignContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    campaign_id: int
    contact_id: int
    organization_id: int
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_role: Optional[str] = None
    organization_name: Optional[str] = None
    organization_industry: Optional[str] = None
    organization_city: Optional[str] = None
    current_step_number: int
    status: str
    personalization_score: float
    subject_preview: Optional[str] = None
    body_preview: Optional[str] = None
    ai_cache: Optional[Dict[str, Any]] = None
    last_action_at: Optional[datetime] = None
    next_action_due: Optional[datetime] = None
    last_message_id: Optional[str] = None
    thread_id: Optional[str] = None
    opened_at: Optional[datetime] = None
    open_count: int = 0
    replied_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# Campaign schemas
class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    sender_email: Optional[str] = None
    gmail_account_id: Optional[str] = None
    target_industry: Optional[str] = None
    sequence_steps: Optional[List[CampaignSequenceStepCreate]] = None
    contact_ids: Optional[List[int]] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    sender_email: Optional[str] = None
    gmail_account_id: Optional[str] = None
    target_industry: Optional[str] = None
    sequence_steps: Optional[List[CampaignSequenceStepCreate]] = None


class CampaignStatsOut(BaseModel):
    total_contacts: int = 0
    pending: int = 0
    ready_for_review: int = 0
    sent: int = 0
    opened: int = 0
    replied: int = 0
    paused: int = 0
    completed: int = 0
    bounced: int = 0
    reply_rate: float = 0.0
    open_rate: float = 0.0
    conversion_rate: float = 0.0
    meetings_generated: int = 0
    opportunities_generated: int = 0
    pipeline_value_generated: float = 0.0


class CampaignRoiFunnelOut(BaseModel):
    campaign_id: int
    campaign_name: str
    target_industry: Optional[str] = None
    leads_enrolled: int = 0
    emails_sent: int = 0
    emails_opened: int = 0
    replies_received: int = 0
    meetings_scheduled: int = 0
    opportunities_created: int = 0
    proposals_sent: int = 0
    negotiations_active: int = 0
    deals_won: int = 0
    total_pipeline_value: float = 0.0
    total_revenue_won: float = 0.0
    
    # Conversion Rates (%)
    sent_to_open_pct: float = 0.0
    open_to_reply_pct: float = 0.0
    reply_to_meeting_pct: float = 0.0
    meeting_to_opp_pct: float = 0.0
    opp_to_deal_pct: float = 0.0
    overall_lead_to_deal_pct: float = 0.0


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str] = None
    status: str
    sender_email: Optional[str] = None
    gmail_account_id: Optional[str] = None
    target_industry: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    sequence_steps: List[CampaignSequenceStepOut] = []
    stats: Optional[CampaignStatsOut] = None


class CampaignDetailOut(CampaignOut):
    campaign_contacts: List[CampaignContactOut] = []


class CampaignPreviewRequest(BaseModel):
    contact_id: int
    step_number: Optional[int] = 1
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    force_regenerate: bool = False


class CampaignPreviewResponse(BaseModel):
    contact_id: int
    contact_name: str
    organization_name: str
    step_number: int
    subject: str
    body_html: str
    body_plain: str
    personalization_score: float
    unresolved_placeholders: List[str] = []
    is_valid: bool
    validation_errors: List[str] = []
    ai_generated_fields: Dict[str, str] = {}
    showcase_project_used: Optional[str] = None


class CampaignSendReviewRequest(BaseModel):
    subject: str
    body_html: str
    send_immediately: bool = True  # If True, sends via Gmail; if False, marks Ready_For_Review


class GmailAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: Optional[str] = None
    is_active: bool
    created_at: datetime
