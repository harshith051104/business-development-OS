from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class CopilotContext(BaseModel):
    current_page: Optional[str] = Field(None, description="Frontend route e.g. /business-development/organizations/14")
    active_entity_type: Optional[str] = Field(None, description="organization, contact, meeting, opportunity, partnership, showcase")
    active_entity_id: Optional[int] = Field(None, description="ID of active entity currently in view")


class CopilotChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000, description="Natural language prompt / question from user")
    conversation_id: Optional[str] = Field(None, description="Unique conversation UUID; if null, a new thread will be started")
    context: Optional[CopilotContext] = Field(default=None, description="Client page context for pronoun and relative reference resolution")


class DataReference(BaseModel):
    entity_type: str = Field(..., description="organization, contact, meeting, opportunity, partnership, project")
    entity_id: int
    title: str
    subtitle: Optional[str] = None
    url: str
    badge: Optional[str] = None


class ToolExecutionRecord(BaseModel):
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    status: str = Field(default="success")  # 'success', 'error', 'requires_confirmation'
    summary: Optional[str] = None


class ConfirmationAction(BaseModel):
    action_id: str = Field(..., description="Unique single-use action identifier")
    action_type: str = Field(..., description="create_meeting, create_followup, create_opportunity, move_connection_stage, create_organization, create_partnership, save_outreach_draft")
    title: str
    description: str
    target_entity_type: Optional[str] = None
    target_entity_id: Optional[int] = None
    payload: Dict[str, Any]
    expires_at: datetime


class CopilotChatResponse(BaseModel):
    conversation_id: str
    message_id: int
    reply: str
    intent: Optional[str] = None
    tools_executed: List[ToolExecutionRecord] = Field(default_factory=list)
    data_references: List[DataReference] = Field(default_factory=list)
    pending_confirmation: Optional[ConfirmationAction] = None
    suggested_followups: List[str] = Field(default_factory=list)
    created_at: datetime


class CopilotConfirmRequest(BaseModel):
    action_id: str
    approved: bool = Field(..., description="True to execute the action, False to cancel")
    modified_payload: Optional[Dict[str, Any]] = Field(None, description="Optional overrides to proposed payload")


class CopilotConfirmResponse(BaseModel):
    action_id: str
    approved: bool
    success: bool
    message: str
    result_data: Optional[Dict[str, Any]] = None
    data_references: List[DataReference] = Field(default_factory=list)


class CopilotMessageOut(BaseModel):
    id: int
    conversation_id: str
    sender: str
    content: str
    intent: Optional[str] = None
    tools_executed: Optional[List[Dict[str, Any]]] = None
    data_references: Optional[List[Dict[str, Any]]] = None
    pending_confirmation: Optional[Dict[str, Any]] = None
    confirmation_status: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CopilotConversationOut(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CopilotSuggestion(BaseModel):
    category: str
    prompt: str
    description: Optional[str] = None
