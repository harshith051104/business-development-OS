export type OrganizationType =
  | 'Company'
  | 'Company Group'
  | 'Startup'
  | 'SaaS Company'
  | 'Technology Company'
  | 'Enterprise'
  | 'Consulting Firm'
  | 'Financial Services'
  | 'Insurance Company'
  | 'Manufacturing'
  | 'Retail'
  | 'Education'
  | 'NGO'
  | 'Other'

export type ConnectionStatus =
  | 'Potential'
  | 'Contacted'
  | 'Connected'
  | 'Interested'
  | 'Meeting'
  | 'Discussion'
  | 'Partnership'

export type PriorityLevel = 'High' | 'Medium' | 'Low'

export interface Organization {
  id: number
  name: string
  organization_type: string
  description?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  country?: string | null
  state?: string | null
  city?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  industry?: string | null
  size?: string | null
  status: string
  priority: string
  notes?: string | null
  is_deleted?: boolean
  created_by?: number | null
  created_at: string
  updated_at: string
}

export interface OrganizationCreateInput {
  name: string
  organization_type: string
  description?: string
  website?: string
  email?: string
  phone?: string
  country?: string
  state?: string
  city?: string
  address?: string
  industry?: string
  size?: string
  status?: string
  priority?: string
  notes?: string
  allow_duplicate?: boolean
}

export interface OrganizationUpdateInput {
  name?: string
  organization_type?: string
  description?: string
  website?: string
  email?: string
  phone?: string
  country?: string
  state?: string
  city?: string
  address?: string
  industry?: string
  size?: string
  status?: string
  priority?: string
  notes?: string
}

export interface PaginatedOrganizations {
  items: Organization[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface OrganizationFilterParams {
  page?: number
  page_size?: number
  search?: string
  organization_type?: string
  status?: string
  priority?: string
  city?: string
  state?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface DuplicateCheckResult {
  is_duplicate: boolean
  existing_id?: number
  existing_name?: string
  message: string
}
