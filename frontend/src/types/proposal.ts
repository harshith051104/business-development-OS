export type ProposalStatus = 'Draft' | 'Internal Review' | 'Sent' | 'Under Discussion' | 'Accepted' | 'Rejected' | 'Expired';

export interface Proposal {
  id: number;
  organization_id: number;
  opportunity_id?: number | null;
  primary_contact_id?: number | null;
  project_id?: number | null;
  owner_id?: number | null;
  title: string;
  version: string;
  value: number;
  currency: string;
  status: ProposalStatus;
  content_summary?: string | null;
  scope_of_work?: string | null;
  commercial_terms?: string | null;
  notes?: string | null;
  date_created: string;
  date_sent?: string | null;
  valid_until?: string | null;
  organization_name?: string | null;
  primary_contact_name?: string | null;
  project_name?: string | null;
  owner_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalCreate {
  organization_id: number;
  opportunity_id?: number | null;
  primary_contact_id?: number | null;
  project_id?: number | null;
  title: string;
  version?: string;
  value?: number;
  currency?: string;
  status?: ProposalStatus;
  content_summary?: string | null;
  scope_of_work?: string | null;
  commercial_terms?: string | null;
  notes?: string | null;
  date_sent?: string | null;
  valid_until?: string | null;
}
