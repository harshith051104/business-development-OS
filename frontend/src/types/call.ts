export type CallOutcome = 
  | 'Connected'
  | 'Interested'
  | 'Not Interested'
  | 'Callback'
  | 'No Answer'
  | 'Wrong Number'
  | 'Meeting Requested'
  | 'Demo Requested';

export interface CallLog {
  id: number;
  organization_id: number;
  contact_id?: number | null;
  opportunity_id?: number | null;
  channel: string;
  direction: string;
  subject: string;
  summary?: string | null;
  content?: string | null;
  communication_date: string;
  status: string;
  organization_name?: string | null;
  contact_name?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface CallLogRequest {
  organization_id: number;
  contact_id?: number | null;
  opportunity_id?: number | null;
  call_date?: string | null;
  duration_minutes?: number;
  outcome: CallOutcome;
  notes: string;
  next_action?: string | null;
  schedule_followup?: boolean;
  followup_date?: string | null;
}
