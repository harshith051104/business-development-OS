export type MeetingType =
  | 'Introduction'
  | 'Project Showcase'
  | 'Business Discussion'
  | 'Partnership Discussion'
  | 'Technical Discussion'
  | 'Follow-up'
  | 'Other'

export type MeetingStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'Rescheduled'

export interface MeetingContactInfo {
  id: number
  full_name: string
  designation?: string
  email?: string
  is_decision_maker: boolean
  is_primary_contact: boolean
}

export interface Meeting {
  id: number
  organization_id: number
  organization_name?: string
  primary_contact_id?: number
  primary_contact_name?: string
  contact_ids: number[]
  title: string
  meeting_type: MeetingType
  scheduled_at: string
  duration_minutes: number
  location?: string
  meeting_url?: string
  status: MeetingStatus
  description?: string
  agenda?: string
  notes?: string
  decisions?: string
  next_actions?: string
  cancellation_reason?: string
  attendees?: MeetingContactInfo[]
  created_at: string
  updated_at: string
}

export interface MeetingCreateInput {
  organization_id: number
  primary_contact_id?: number
  contact_ids?: number[]
  title: string
  meeting_type: string
  description?: string
  scheduled_at: string
  duration_minutes?: number
  location?: string
  meeting_url?: string
  agenda?: string
  notes?: string
  decisions?: string
  next_actions?: string
}

export interface MeetingUpdateInput {
  organization_id?: number
  primary_contact_id?: number
  contact_ids?: number[]
  title?: string
  meeting_type?: string
  description?: string
  scheduled_at?: string
  duration_minutes?: number
  location?: string
  meeting_url?: string
  agenda?: string
  notes?: string
  decisions?: string
  next_actions?: string
  status?: MeetingStatus
}

export interface MeetingCompleteInput {
  notes?: string
  decisions?: string
  next_actions?: string
  followup_title?: string
  followup_due_at?: string
  followup_priority?: 'High' | 'Medium' | 'Low'
  advance_org_status?: string
}

export interface MeetingRescheduleInput {
  scheduled_at: string
  duration_minutes?: number
  note?: string
}

export interface PaginatedMeetings {
  items: Meeting[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface MeetingFilters {
  search?: string
  organization_id?: number
  contact_id?: number
  status?: string
  meeting_type?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}
