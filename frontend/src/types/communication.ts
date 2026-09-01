export type CommunicationChannel =
  | 'Email'
  | 'Phone'
  | 'LinkedIn'
  | 'WhatsApp'
  | 'Meeting'
  | 'Video Call'
  | 'In Person'
  | 'Other'

export type CommunicationDirection = 'Outgoing' | 'Incoming'

export type CommunicationStatus = 'Completed' | 'Pending' | 'Cancelled'

export interface Communication {
  id: number
  organization_id: number
  contact_id?: number | null
  opportunity_id?: number | null
  meeting_id?: number | null
  followup_id?: number | null

  channel: CommunicationChannel | string
  direction: CommunicationDirection | string
  subject: string
  content?: string | null
  summary?: string | null
  communication_date: string
  status: CommunicationStatus | string

  created_by?: string | null
  created_at: string
  updated_at: string

  // Display fields
  organization_name?: string | null
  contact_name?: string | null
  contact_designation?: string | null
  opportunity_name?: string | null
  meeting_title?: string | null
  followup_title?: string | null
}

export interface CommunicationCreateInput {
  organization_id: number
  contact_id?: number | null
  opportunity_id?: number | null
  meeting_id?: number | null
  followup_id?: number | null
  channel?: CommunicationChannel | string
  direction?: CommunicationDirection | string
  subject: string
  content?: string | null
  summary?: string | null
  communication_date?: string | null
  status?: CommunicationStatus | string
}

export interface CommunicationUpdateInput {
  contact_id?: number | null
  opportunity_id?: number | null
  meeting_id?: number | null
  followup_id?: number | null
  channel?: CommunicationChannel | string
  direction?: CommunicationDirection | string
  subject?: string
  content?: string | null
  summary?: string | null
  communication_date?: string | null
  status?: CommunicationStatus | string
}

export interface PaginatedCommunications {
  items: Communication[]
  total: number
  page: number
  page_size: number
  total_pages: number
  channel_counts: Record<string, number>
  direction_counts: Record<string, number>
}

export interface CommunicationFilters {
  page?: number
  page_size?: number
  search?: string
  organization_id?: number
  contact_id?: number
  opportunity_id?: number
  channel?: string
  direction?: string
  status?: string
  date_range?: 'today' | 'this_week' | 'this_month'
  start_date?: string
  end_date?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface TimelineItem {
  id: string
  event_type: 'communication' | 'meeting' | 'followup' | 'activity' | string
  timestamp: string
  title: string
  subtitle?: string | null
  description?: string | null
  channel?: string | null
  direction?: string | null
  status?: string | null
  performed_by?: string | null
  organization_id?: number | null
  contact_id?: number | null
  opportunity_id?: number | null
  reference_id?: number | null
}

export interface RelationshipTimeline {
  events: TimelineItem[]
  total_events: number
  organization_name?: string | null
  contact_name?: string | null
  opportunity_name?: string | null
}
