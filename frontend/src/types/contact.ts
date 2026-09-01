export type ContactRelationshipStatus =
  | 'Not Contacted'
  | 'Contacted'
  | 'Connected'
  | 'Interested'
  | 'Inactive'

export interface ContactActivity {
  id: number
  activity_type: string
  description: string
  contact_id?: number | null
  organization_id?: number | null
  performed_by?: string | null
  created_at: string
}

export interface Contact {
  id: number
  organization_id: number
  organization_name?: string | null
  first_name: string
  last_name?: string | null
  full_name: string
  designation?: string | null
  department?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  location?: string | null
  is_decision_maker: boolean
  is_primary_contact: boolean
  connection_status: ContactRelationshipStatus | string
  notes?: string | null
  is_deleted?: boolean
  first_contacted_at?: string | null
  last_contacted_at?: string | null
  next_followup_at?: string | null
  created_at: string
  updated_at: string
  activities?: ContactActivity[]
}

export interface ContactCreateInput {
  organization_id: number
  first_name: string
  last_name?: string
  designation?: string
  department?: string
  email?: string
  phone?: string
  linkedin_url?: string
  location?: string
  is_decision_maker?: boolean
  is_primary_contact?: boolean
  connection_status?: string
  notes?: string
  allow_duplicate?: boolean
}

export interface ContactUpdateInput {
  organization_id?: number
  first_name?: string
  last_name?: string
  designation?: string
  department?: string
  email?: string
  phone?: string
  linkedin_url?: string
  location?: string
  is_decision_maker?: boolean
  is_primary_contact?: boolean
  connection_status?: string
  notes?: string
  first_contacted_at?: string
  last_contacted_at?: string
  next_followup_at?: string
}

export interface PaginatedContacts {
  items: Contact[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ContactFilterParams {
  page?: number
  page_size?: number
  search?: string
  organization_id?: number
  is_decision_maker?: boolean
  is_primary_contact?: boolean
  connection_status?: string
  department?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface DuplicateContactCheckResult {
  is_duplicate: boolean
  existing_id?: number
  existing_name?: string
  reason?: string
  message: string
}
