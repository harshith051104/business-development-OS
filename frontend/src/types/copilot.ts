export interface CopilotContext {
  current_page?: string;
  active_entity_type?: 'organization' | 'contact' | 'opportunity' | 'meeting' | 'followup' | 'project' | 'partnership' | 'discovery_lead';
  active_entity_id?: string | number;
  active_filters?: Record<string, any>;
}

export interface ToolExecutionRecord {
  tool_name: string;
  arguments?: Record<string, any>;
  status: string;
  execution_time_ms?: number;
  summary?: string;
}

export interface DataReference {
  entity_type: string;
  entity_id: string | number;
  title: string;
  subtitle?: string;
  url?: string;
  metadata?: Record<string, any>;
}

export interface ConfirmationAction {
  action_id: string;
  action_type: 'move_connection_stage' | 'create_meeting' | 'create_followup' | 'create_opportunity' | 'draft_outreach_campaign';
  title: string;
  description: string;
  target_entity_type?: string;
  target_entity_id?: string | number;
  payload: Record<string, any>;
  expires_at?: string;
}

export interface CopilotMessage {
  id?: number | string;
  conversation_id?: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string;
  tools_executed?: ToolExecutionRecord[];
  data_references?: DataReference[];
  pending_confirmation?: ConfirmationAction;
  confirmation_status?: 'pending' | 'approved' | 'rejected' | 'expired';
  suggested_followups?: string[];
  created_at?: string;
}

export interface CopilotConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface CopilotChatRequest {
  message: string;
  conversation_id?: string;
  context?: CopilotContext;
}

export interface CopilotChatResponse {
  conversation_id: string;
  message_id: number;
  reply: string;
  intent?: string;
  tools_executed: ToolExecutionRecord[];
  data_references: DataReference[];
  pending_confirmation?: ConfirmationAction;
  suggested_followups: string[];
}

export interface CopilotConfirmRequest {
  action_id: string;
  approved: boolean;
  notes?: string;
}

export interface CopilotConfirmResponse {
  action_id: string;
  approved: boolean;
  success: boolean;
  message: string;
  result_data?: Record<string, any>;
  data_references?: DataReference[];
}

export interface CopilotSuggestion {
  category: string;
  prompt: string;
  description: string;
}
