export type OpportunityStage =
  | 'Potential'
  | 'Contacted'
  | 'Connected'
  | 'Interested'
  | 'Meeting'
  | 'Discussion'
  | 'Partnership'

export type OpportunityPriority = 'High' | 'Medium' | 'Low'

export interface OpportunityActivity {
  id: number
  activity_type: string
  description: string
  performed_by?: string | null
  created_at: string
}

export interface OpportunityMeetingSummary {
  id: number
  title: string
  meeting_type: string
  scheduled_at: string
  status: string
}

export interface OpportunityFollowUpSummary {
  id: number
  title: string
  due_at: string
  priority: string
  status: string
}

export interface Opportunity {
  id: number
  organization_id: number
  primary_contact_id?: number | null
  project_id?: number | null
  owner_id?: number | null

  name: string
  description?: string | null
  stage: OpportunityStage | string
  priority: OpportunityPriority | string
  estimated_value?: number | null
  currency: string
  probability?: number | null
  expected_close_date?: string | null

  next_action?: string | null
  next_action_date?: string | null
  notes?: string | null

  created_by?: string | null
  created_at: string
  updated_at: string

  // Display Helpers
  organization_name?: string | null
  primary_contact_name?: string | null
  primary_contact_designation?: string | null
  project_title?: string | null
  owner_name?: string | null
  has_next_action: boolean

  activities?: OpportunityActivity[]
  meetings?: OpportunityMeetingSummary[]
  followups?: OpportunityFollowUpSummary[]
}

export interface OpportunityCreateInput {
  name: string
  organization_id: number
  primary_contact_id?: number | null
  project_id?: number | null
  owner_id?: number | null
  description?: string | null
  stage?: string
  priority?: string
  estimated_value?: number | null
  currency?: string
  probability?: number | null
  expected_close_date?: string | null
  next_action?: string | null
  next_action_date?: string | null
  notes?: string | null
}

export interface OpportunityUpdateInput {
  name?: string
  primary_contact_id?: number | null
  project_id?: number | null
  owner_id?: number | null
  description?: string | null
  stage?: string
  priority?: string
  estimated_value?: number | null
  currency?: string
  probability?: number | null
  expected_close_date?: string | null
  next_action?: string | null
  next_action_date?: string | null
  notes?: string | null
}

export interface PaginatedOpportunities {
  items: Opportunity[]
  total: number
  page: number
  page_size: number
  total_pages: number
  no_next_action_count: number
  active_count: number
  high_priority_count: number
}

export interface OpportunityFilters {
  page?: number
  page_size?: number
  search?: string
  organization_id?: number
  contact_id?: number
  project_id?: number
  owner_id?: number
  stage?: string
  priority?: string
  no_next_action?: boolean
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

// Kanban Types
export interface KanbanCard {
  organization_id: number
  organization_name: string
  organization_type: string
  priority: string
  status: string
  city?: string | null
  primary_contact_name?: string | null
  primary_contact_designation?: string | null
  last_activity_text?: string | null
  last_activity_date?: string | null
  next_followup_date?: string | null
  next_followup_title?: string | null
  active_opportunities_count: number
}

export interface KanbanColumn {
  stage: string
  count: number
  organizations: KanbanCard[]
}

export interface KanbanBoard {
  columns: KanbanColumn[]
  total_organizations: number
  summary_by_stage: Record<string, number>
}
