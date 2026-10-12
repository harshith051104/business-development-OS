export const LEAD_TRACKER_CHECKBOX_FIELDS = [
  'linkedin_followed',
  'linkedin_connection_sent',
  'linkedin_connection_accepted',
  'linkedin_first_message_sent',
  'linkedin_reply_received',
  'followup_1_sent',
  'followup_2_sent',
  'followup_3_sent',
  'meeting_scheduled',
  'opportunity_closed',
] as const;

export type LeadTrackerCheckboxField = typeof LEAD_TRACKER_CHECKBOX_FIELDS[number];

export interface LeadTrackerRow {
  id: number;
  campaign_id: number;
  campaign_name?: string;
  contact_id: number;
  name?: string;
  email?: string;
  linkedin?: string;
  company?: string;
  organization_id: number;
  status: string;
  focus?: string;
  notes?: string;
  assigned_user_id?: number;
  assigned_user?: string;
  next_followup_at?: string;
  last_activity_at?: string;
  email_sent: boolean;
  email_opened: boolean;
  email_replied: boolean;
  linkedin_followed: boolean;
  linkedin_connection_sent: boolean;
  linkedin_connection_accepted: boolean;
  linkedin_first_message_sent: boolean;
  linkedin_reply_received: boolean;
  followup_1_sent: boolean;
  followup_2_sent: boolean;
  followup_3_sent: boolean;
  meeting_scheduled: boolean;
  opportunity_closed: boolean;
}

export interface LeadTrackerBoardResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  leads: LeadTrackerRow[];
}

export interface LeadTrackerFieldsResponse {
  checkbox_fields: LeadTrackerCheckboxField[];
  labels: Record<string, string>;
}

export interface LeadTrackerTeamMember {
  user_id: number | null;
  display_name: string;
  total_leads: number;
  completed: number;
  meeting_scheduled: number;
  opportunity_closed: number;
  completion_rate: number;
  email_sent: number;
  linkedin_connection_sent: number;
  linkedin_connection_accepted: number;
  linkedin_first_message_sent: number;
  linkedin_reply_received: number;
  followup_1_sent: number;
  followup_2_sent: number;
  followup_3_sent: number;
}

export interface LeadTrackerTeamProgress {
  total_members: number;
  total_leads: number;
  total_completed: number;
  members: LeadTrackerTeamMember[];
}

export interface LeadTrackerTimelineEvent {
  id: number;
  campaign_contact_id: number;
  user_id?: number;
  event_type: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}
