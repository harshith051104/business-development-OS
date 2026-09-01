export interface DashboardSummary {
  organizations: number
  contacts: number
  connections: number
  interested: number
  meetings: number
  active_discussions: number
  partnerships: number
}

export interface ConnectionPipeline {
  potential: number
  contacted: number
  connected: number
  interested: number
  meeting: number
  discussion: number
  partnership: number
}

export interface TodayActivityItem {
  id: string
  organization: string
  contact: string
  activity_type: string
  time: string
  status: 'pending' | 'in_progress' | 'completed' | string
}

export interface UpcomingMeetingItem {
  id: string
  organization: string
  contact: string
  meeting_type: string
  date: string
  time: string
  status: 'scheduled' | 'confirmed' | 'completed' | string
}

export interface CategorizedFollowUpItem {
  id: string
  organization: string
  contact: string
  reason: string
  timing: string
  category: 'overdue' | 'today' | 'upcoming'
  status: string
}

export interface GroupedFollowUps {
  overdue: CategorizedFollowUpItem[]
  today: CategorizedFollowUpItem[]
  upcoming: CategorizedFollowUpItem[]
}

export interface TodayActivitiesGroup {
  activities: TodayActivityItem[]
  followups: CategorizedFollowUpItem[]
  meetings: UpcomingMeetingItem[]
}

export interface RecentActivity {
  id: string
  type: string
  description: string
  organization: string
  timestamp: string
  user_name: string
}

export interface DashboardResponse {
  summary: DashboardSummary
  pipeline: ConnectionPipeline
  today: TodayActivitiesGroup
  followups: GroupedFollowUps
  upcoming_meetings: UpcomingMeetingItem[]
  recent_activity: RecentActivity[]
}
