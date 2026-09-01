export type NegotiationStatus = 'Active' | 'Terms Proposed' | 'Legal Review' | 'Blocked' | 'Agreed' | 'Abandoned';

export interface Negotiation {
  id: number;
  organization_id: number;
  opportunity_id?: number | null;
  proposal_id?: number | null;
  primary_contact_id?: number | null;
  owner_id?: number | null;
  title: string;
  commercial_value: number;
  currency: string;
  status: NegotiationStatus;
  expected_close_date?: string | null;
  key_requirements?: string | null;
  open_issues?: string | null;
  risks?: string | null;
  next_action?: string | null;
  notes?: string | null;
  organization_name?: string | null;
  primary_contact_name?: string | null;
  proposal_title?: string | null;
  owner_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NegotiationCreate {
  organization_id: number;
  opportunity_id?: number | null;
  proposal_id?: number | null;
  primary_contact_id?: number | null;
  title: string;
  commercial_value?: number;
  currency?: string;
  status?: NegotiationStatus;
  expected_close_date?: string | null;
  key_requirements?: string | null;
  open_issues?: string | null;
  risks?: string | null;
  next_action?: string | null;
  notes?: string | null;
}
