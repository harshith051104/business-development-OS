export interface CampaignSequenceStep {
  id?: number;
  campaign_id?: number;
  step_number: number;
  delay_days: number;
  channel: string;
  subject_template?: string;
  body_template: string;
  notes?: string;
}

export interface CampaignContact {
  id: number;
  campaign_id: number;
  contact_id: number;
  organization_id: number;
  contact_name?: string;
  contact_email?: string;
  contact_role?: string;
  organization_name?: string;
  organization_industry?: string;
  organization_city?: string;
  current_step_number: number;
  status: 'Pending' | 'Ready_For_Review' | 'Sent' | 'Replied' | 'Paused' | 'Completed' | 'Bounced';
  personalization_score: number;
  subject_preview?: string;
  body_preview?: string;
  ai_cache?: Record<string, any>;
  last_action_at?: string;
  next_action_due?: string;
  last_message_id?: string;
  thread_id?: string;
  opened_at?: string;
  open_count?: number;
  replied_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  total_contacts: number;
  pending: number;
  ready_for_review: number;
  sent: number;
  opened: number;
  replied: number;
  paused: number;
  completed: number;
  bounced: number;
  reply_rate: number;
  open_rate: number;
  conversion_rate: number;
  meetings_generated: number;
  opportunities_generated?: number;
  pipeline_value_generated?: number;
}

export interface CampaignRoiFunnel {
  campaign_id: number;
  campaign_name: string;
  target_industry?: string;
  leads_enrolled: number;
  emails_sent: number;
  emails_opened: number;
  replies_received: number;
  meetings_scheduled: number;
  opportunities_created: number;
  proposals_sent: number;
  negotiations_active: number;
  deals_won: number;
  total_pipeline_value: number;
  total_revenue_won: number;
  sent_to_open_pct: number;
  open_to_reply_pct: number;
  reply_to_meeting_pct: number;
  meeting_to_opp_pct: number;
  opp_to_deal_pct: number;
  overall_lead_to_deal_pct: number;
}

export interface Campaign {
  id: number;
  name: string;
  description?: string;
  status: 'Draft' | 'Active' | 'Paused' | 'Completed';
  category?: 'client' | 'funding';
  sender_email?: string;
  gmail_account_id?: string;
  target_industry?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  sequence_steps: CampaignSequenceStep[];
  stats?: CampaignStats;
  campaign_contacts?: CampaignContact[];
}

export interface CampaignCreate {
  name: string;
  description?: string;
  sender_email?: string;
  gmail_account_id?: string;
  target_industry?: string;
  sequence_steps?: CampaignSequenceStep[];
  contact_ids?: number[];
}

export interface CampaignPreviewRequest {
  contact_id: number;
  step_number?: number;
  subject_template?: string;
  body_template?: string;
  force_regenerate?: boolean;
}

export interface CampaignPreviewResponse {
  contact_id: number;
  contact_name: string;
  organization_name: string;
  step_number: number;
  subject: string;
  body_html: string;
  body_plain: string;
  personalization_score: number;
  unresolved_placeholders: string[];
  is_valid: boolean;
  validation_errors: string[];
  ai_generated_fields: Record<string, string>;
  showcase_project_used?: string;
}

export interface OutreachTrackerItem {
  campaign_contact_id: number;
  campaign_id: number;
  campaign_name?: string;
  contact_id: number;
  contact_name?: string;
  contact_email?: string;
  organization_id: number;
  organization_name?: string;
  status: string;
  subject_preview?: string;
  sent_at?: string;
  opened_at?: string;
  open_count: number;
  clicked_at?: string;
  click_count: number;
  replied_at?: string;
}

export interface OutreachTrackerResponse {
  items: OutreachTrackerItem[];
  summary: {
    total_sent: number;
    opened: number;
    clicked: number;
    replied: number;
    open_rate: number;
    click_rate: number;
    reply_rate: number;
  };
}

export interface GmailAccount {
  id: string;
  email: string;
  name?: string;
  is_active: boolean;
  created_at: string;
}
