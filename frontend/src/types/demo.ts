export type DemoStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled' | 'No Show';
export type DemoOutcome = 'Pending' | 'Very Interested' | 'Interested' | 'Proposal Requested' | 'Needs Followup' | 'Not Interested';

export interface Demo {
  id: number;
  organization_id: number;
  opportunity_id?: number | null;
  meeting_id?: number | null;
  primary_contact_id?: number | null;
  project_id?: number | null;
  owner_id?: number | null;
  title: string;
  status: DemoStatus;
  outcome: DemoOutcome;
  scheduled_at?: string | null;
  completed_at?: string | null;
  participants?: string | null;
  customer_requirements?: string | null;
  demo_notes?: string | null;
  next_action?: string | null;
  organization_name?: string | null;
  primary_contact_name?: string | null;
  project_name?: string | null;
  owner_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemoCreate {
  organization_id: number;
  opportunity_id?: number | null;
  meeting_id?: number | null;
  primary_contact_id?: number | null;
  project_id?: number | null;
  title: string;
  scheduled_at: string;
  participants?: string | null;
  customer_requirements?: string | null;
  demo_notes?: string | null;
  next_action?: string | null;
}
