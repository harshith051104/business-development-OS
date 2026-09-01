export interface AdminUser {
  id: number
  name: string
  email: string
  role: 'ADMIN' | 'BUSINESS_DEVELOPMENT' | string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AdminUserActivitySummary {
  organizations_count: number
  contacts_count: number
  meetings_count: number
  opportunities_count: number
  partnerships_count: number
}

export interface AdminUserDetail extends AdminUser {
  activity: AdminUserActivitySummary
  recent_actions: Array<{
    id: number
    action: string
    resource_type: string
    resource_id?: number | null
    timestamp?: string | null
  }>
  owned_organizations: Array<{
    id: number
    name: string
    organization_type: string
    status: string
  }>
  owned_opportunities: Array<{
    id: number
    name: string
    stage: string
    priority: string
  }>
  owned_partnerships: Array<{
    id: number
    name: string
    partnership_type: string
    status: string
  }>
}

export interface PaginatedAdminUsers {
  items: AdminUser[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface AdminTeamMember {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
  organizations_count: number
  opportunities_count: number
  partnerships_count: number
  last_activity_date?: string | null
}

export interface AdminTeamList {
  items: AdminTeamMember[]
  total: number
}

export interface AdminDashboardStats {
  total_users: number
  active_bd_users: number
  active_organizations: number
  active_opportunities: number
  active_partnerships: number
  recent_system_activity: Array<{
    id: number
    action: string
    user_email?: string | null
    resource_type: string
    resource_id?: number | null
    timestamp?: string | null
  }>
}

export interface AdminUserCreatePayload {
  name: string
  email: string
  password: string
  role: string
  is_active?: boolean
}

export interface AdminUserUpdatePayload {
  name?: string
  role?: string
  is_active?: boolean
  password?: string
}

export interface BulkAssignmentPayload {
  organization_ids?: number[]
  opportunity_ids?: number[]
  partnership_ids?: number[]
  owner_id?: number | null
}

export interface BulkAssignmentResult {
  success: boolean
  message: string
  updated_organizations: number
  updated_opportunities: number
  updated_partnerships: number
}

export interface SystemSettings {
  organization_types: string[]
  connection_statuses: string[]
  partnership_types: string[]
  meeting_types: string[]
  priority_levels: string[]
  project_categories: string[]
}

export interface SystemSettingsUpdatePayload {
  organization_types?: string[]
  partnership_types?: string[]
  meeting_types?: string[]
  project_categories?: string[]
}
