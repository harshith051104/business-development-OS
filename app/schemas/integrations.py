from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel


class ExternalLeadIngestRequest(BaseModel):
    source_system: str  # Marketing, Growth, Events, Investor, Inbound
    organization_name: str
    organization_type: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    website: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    campaign_name: Optional[str] = None
    event_name: Optional[str] = None
    notes: Optional[str] = None
    lead_score: Optional[int] = 75
    metadata: Optional[Dict[str, Any]] = None


class ExternalLeadIngestResponse(BaseModel):
    success: bool
    message: str
    organization_id: int
    contact_id: Optional[int] = None
    is_new_organization: bool
    source_system: str


class IntegrationStatus(BaseModel):
    system_name: str
    available: bool
    mode: str  # active_direct, clean_interface, pending_provider
    total_ingested_leads: int
    last_sync_at: Optional[datetime] = None
    supported_channels: List[str] = []
