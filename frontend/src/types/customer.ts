export type CustomerStatus = 'Active' | 'Churned' | 'At Risk' | 'Renewal Pending' | 'Suspended';
export type AccountHealth = 'Excellent' | 'Good' | 'Needs Attention' | 'Critical';

export interface Customer {
  id: number;
  organization_id: number;
  primary_contact_id?: number | null;
  opportunity_id?: number | null;
  project_id?: number | null;
  owner_id?: number | null;
  contract_value: number;
  currency: string;
  status: CustomerStatus;
  account_health: AccountHealth;
  start_date?: string | null;
  renewal_date?: string | null;
  next_review_date?: string | null;
  notes?: string | null;
  organization_name?: string | null;
  primary_contact_name?: string | null;
  project_name?: string | null;
  owner_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreate {
  organization_id: number;
  primary_contact_id?: number | null;
  opportunity_id?: number | null;
  project_id?: number | null;
  contract_value?: number;
  currency?: string;
  status?: CustomerStatus;
  account_health?: AccountHealth;
  start_date?: string | null;
  renewal_date?: string | null;
  next_review_date?: string | null;
  notes?: string | null;
}

export interface CustomerConvertRequest {
  organization_id: number;
  primary_contact_id?: number | null;
  opportunity_id?: number | null;
  project_id?: number | null;
  contract_value?: number;
  currency?: string;
  start_date?: string | null;
  renewal_date?: string | null;
  notes?: string | null;
}
