import {
  UserPlus,
  Send,
  Handshake,
  MessageCircle,
  MessageSquare,
  Mail,
  Eye,
  Reply,
  Repeat,
  Calendar,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

export const CHECKBOX_LABELS: Record<string, string> = {
  linkedin_followed: "LinkedIn Followed",
  linkedin_connection_sent: "Connection Sent",
  linkedin_connection_accepted: "Connection Accepted",
  linkedin_first_message_sent: "First Message Sent",
  linkedin_reply_received: "LinkedIn Reply",
  email_sent: "Email Sent",
  email_opened: "Email Opened",
  email_replied: "Email Replied",
  followup_1_sent: "Follow-up #1",
  followup_2_sent: "Follow-up #2",
  followup_3_sent: "Follow-up #3",
  meeting_scheduled: "Meeting Scheduled",
  opportunity_closed: "Deal Closed",
};

export const CHECKBOX_FIELDS = Object.keys(CHECKBOX_LABELS);

export const CHECKBOX_ICONS: Record<string, LucideIcon> = {
  linkedin_followed: UserPlus,
  linkedin_connection_sent: Send,
  linkedin_connection_accepted: Handshake,
  linkedin_first_message_sent: MessageCircle,
  linkedin_reply_received: MessageSquare,
  email_sent: Mail,
  email_opened: Eye,
  email_replied: Reply,
  followup_1_sent: Repeat,
  followup_2_sent: Repeat,
  followup_3_sent: Repeat,
  meeting_scheduled: Calendar,
  opportunity_closed: CheckCircle2,
};

export const LEAD_TRACKER_CHECKBOX_FIELDS = CHECKBOX_FIELDS;
export type LeadTrackerCheckboxField = string;

export interface TrackerUser {
  id: string;
  name: string;
  display_name: string;
  email: string;
  role?: string;
}

export interface CreateLeadPayload {
  name: string;
  email: string;
  company?: string;
  focus?: string;
  linkedin?: string;
  campaign_id?: number | string;
  notes?: string;
  role?: string;
}

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
