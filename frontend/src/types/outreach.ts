export type OutreachChannelType = 'Email' | 'Phone' | 'LinkedIn' | 'WhatsApp' | 'Other'
export type DraftStatusType = 'Draft' | 'Ready' | 'Completed' | 'Cancelled'
export type TemplateCategoryType =
  | 'Introduction'
  | 'Project Showcase'
  | 'Meeting Request'
  | 'Follow-up'
  | 'Partnership Discussion'

export interface OutreachDraft {
  id: number
  organization_id: number
  organization_name?: string | null
  contact_id?: number | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  contact_linkedin?: string | null
  opportunity_id?: number | null
  opportunity_title?: string | null
  project_id?: number | null
  project_name?: string | null
  channel: OutreachChannelType
  subject?: string | null
  message?: string | null
  call_purpose?: string | null
  status: DraftStatusType
  created_by?: number | null
  created_at: string
  updated_at: string
}

export interface PaginatedOutreachDrafts {
  items: OutreachDraft[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface OutreachTemplate {
  id: number
  name: string
  category: TemplateCategoryType
  channel: OutreachChannelType
  subject?: string | null
  body: string
  is_active: boolean
  created_by?: number | null
  created_at: string
  updated_at: string
}

export interface OutreachRecordPayload {
  draft_id?: number | null
  organization_id: number
  contact_id?: number | null
  opportunity_id?: number | null
  channel: OutreachChannelType
  direction?: 'Outgoing' | 'Incoming'
  subject?: string | null
  summary: string
  notes?: string | null
  communication_date?: string | null

  update_organization_status?: boolean
  new_organization_status?: string | null

  create_followup?: boolean
  followup_title?: string | null
  followup_due_at?: string | null
  followup_priority?: string | null
  followup_notes?: string | null
}

export interface OutreachRecordResult {
  communication_id: number
  draft_id?: number | null
  organization_id: number
  organization_status_updated: boolean
  new_organization_status?: string | null
  followup_id?: number | null
  message: string
}
