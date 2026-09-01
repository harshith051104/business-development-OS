export type PartnershipType =
  | 'Technology Partnership'
  | 'Business Partnership'
  | 'Strategic Partnership'
  | 'Integration Partnership'
  | 'Service Partnership'
  | 'Distribution Partnership'
  | 'Referral Partnership'
  | 'Other'

export type PartnershipStatus = 'Active' | 'On Hold' | 'Completed' | 'Ended'
export type PartnershipPriority = 'High' | 'Medium' | 'Low'

export interface Partnership {
  id: number
  name: string
  organization_id: number
  organization_name?: string | null
  opportunity_id?: number | null
  opportunity_name?: string | null
  primary_contact_id?: number | null
  primary_contact_name?: string | null
  primary_contact_email?: string | null
  primary_contact_phone?: string | null
  primary_contact_designation?: string | null
  project_id?: number | null
  project_name?: string | null
  owner_id?: number | null
  owner_name?: string | null
  owner_email?: string | null
  partnership_type: PartnershipType
  status: PartnershipStatus
  priority: PartnershipPriority
  start_date: string
  end_date?: string | null
  objectives?: string | null
  description?: string | null
  notes?: string | null
  next_action?: string | null
  next_action_date?: string | null
  is_deleted: boolean
  created_by?: string | null
  created_at: string
  updated_at: string

  is_ending_soon: boolean
  needs_attention: boolean
}

export interface PaginatedPartnerships {
  items: Partnership[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PartnershipStats {
  total_partnerships: number
  active_partnerships: number
  on_hold_partnerships: number
  completed_partnerships: number
  ended_partnerships: number
  ending_soon_count: number
  needs_attention_count: number
  new_this_month: number
  by_type: Record<string, number>
  by_owner: Record<string, number>
  by_project: Record<string, number>
}

export interface PartnershipCreatePayload {
  organization_id: number
  opportunity_id?: number | null
  primary_contact_id?: number | null
  project_id?: number | null
  owner_id?: number | null
  name: string
  partnership_type: PartnershipType
  status?: PartnershipStatus
  priority?: PartnershipPriority
  start_date?: string | null
  end_date?: string | null
  objectives?: string | null
  description?: string | null
  notes?: string | null
  next_action?: string | null
  next_action_date?: string | null
  allow_duplicate?: boolean
}

export interface ConvertOpportunityPayload {
  name?: string
  partnership_type: PartnershipType
  priority?: PartnershipPriority
  owner_id?: number | null
  start_date?: string | null
  end_date?: string | null
  objectives?: string | null
  description?: string | null
  notes?: string | null
  next_action?: string | null
  next_action_date?: string | null
  update_organization_status?: boolean
  allow_duplicate?: boolean
}
