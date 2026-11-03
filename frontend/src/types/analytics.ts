export interface OverviewMetrics {
  total_organizations: number
  total_contacts: number
  total_connections: number
  interested_organizations: number
  total_meetings: number
  active_discussions: number
  active_opportunities: number
  partnerships_established: number
}

export interface PipelineStageCount {
  stage: string
  count: number
  percentage: number
}

export interface ConversionRateItem {
  from_stage: string
  to_stage: string
  rate: number | null
  from_count: number
  to_count: number
  is_sufficient_data: boolean
}

export interface ConversionRates {
  contacted_to_connected: ConversionRateItem
  connected_to_interested: ConversionRateItem
  interested_to_meeting: ConversionRateItem
  meeting_to_discussion: ConversionRateItem
  discussion_to_partnership: ConversionRateItem
  overall_funnel: ConversionRateItem
}

export interface GrowthPoint {
  period_label: string
  count: number
  date?: string | null
}

export interface MeetingAnalytics {
  total: number
  completed: number
  scheduled: number
  cancelled: number
  rescheduled: number
  completion_rate: number | null
}

export interface FollowUpAnalytics {
  total: number
  completed: number
  pending: number
  overdue: number
  cancelled: number
  completion_rate: number | null
}

export interface OpportunityAnalytics {
  total: number
  active: number
  high_priority: number
  no_next_action: number
  stage_distribution: Record<string, number>
  total_estimated_value: number | null
  has_financial_data: boolean
  currency: string
}

export interface CommunicationAnalytics {
  total: number
  channel_counts: Record<string, number>
  direction_counts: Record<string, number>
}

export interface ActivityVolume {
  organizations_added: number
  contacts_added: number
  communications_recorded: number
  meetings_completed: number
  followups_completed: number
  opportunities_created: number
}

export interface TeamMemberPerformance {
  user_id: number
  name: string
  email: string
  organizations_added: number
  contacts_added: number
  communications_logged: number
  meetings_completed: number
  opportunities_managed: number
  followups_completed: number
}

export interface TopOpportunity {
  id: number
  name: string
  organization_id: number
  organization_name: string
  stage: string
  priority: string
  estimated_value: number | null
  currency: string
  probability: number
  next_action?: string | null
  next_action_date?: string | null
  owner_name?: string | null
}

export interface StaleOrganization {
  id: number
  name: string
  status: string
  priority: string
  days_since_last_activity: number
  last_activity_date?: string | null
  primary_contact_name?: string | null
}

export interface AttentionRequired {
  overdue_followups_count: number
  opportunities_no_next_action_count: number
  interested_no_meeting_count: number
  stale_organizations_count: number

  overdue_followups: Array<{
    id: number
    title: string
    organization_name?: string | null
    due_at: string
    priority: string
  }>
  opportunities_no_next_action: Array<{
    id: number
    name: string
    organization_name?: string | null
    stage: string
    priority: string
  }>
  interested_no_meeting: Array<{
    id: number
    name: string
    city?: string | null
    priority: string
  }>
  stale_organizations: StaleOrganization[]
}

export interface ComprehensiveAnalytics {
  date_range: string
  start_date?: string | null
  end_date?: string | null
  overview: OverviewMetrics
  pipeline: PipelineStageCount[]
  conversion_rates: ConversionRates
  organization_growth: GrowthPoint[]
  meetings: MeetingAnalytics
  followups: FollowUpAnalytics
  opportunities: OpportunityAnalytics
  communications: CommunicationAnalytics
  activity_volume: ActivityVolume
  team_performance: TeamMemberPerformance[]
  top_opportunities: TopOpportunity[]
  attention_required: AttentionRequired
}
