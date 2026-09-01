export type FollowUpPriority = 'High' | 'Medium' | 'Low'
export type FollowUpStatus = 'Pending' | 'Completed' | 'Cancelled'

export interface FollowUp {
  id: number
  organization_id: number
  organization_name?: string
  contact_id?: number
  contact_name?: string
  meeting_id?: number
  title: string
  description?: string
  due_at: string
  priority: FollowUpPriority
  status: FollowUpStatus
  assigned_to?: string
  completed_at?: string
  cancellation_reason?: string
  is_overdue: boolean
  timing_label: string
  created_at: string
  updated_at: string
}

export interface FollowUpCreateInput {
  organization_id: number
  contact_id?: number
  meeting_id?: number
  title: string
  description?: string
  due_at: string
  priority?: FollowUpPriority
  assigned_to?: string
}

export interface FollowUpUpdateInput {
  organization_id?: number
  contact_id?: number
  meeting_id?: number
  title?: string
  description?: string
  due_at?: string
  priority?: FollowUpPriority
  status?: FollowUpStatus
  assigned_to?: string
}

export interface PaginatedFollowUps {
  items: FollowUp[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface GroupedFollowUps {
  overdue: FollowUp[]
  today: FollowUp[]
  upcoming: FollowUp[]
  completed: FollowUp[]
}

export interface FollowUpFilters {
  search?: string
  organization_id?: number
  contact_id?: number
  meeting_id?: number
  status?: string
  priority?: string
  due_category?: 'overdue' | 'today' | 'upcoming' | 'completed'
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}
