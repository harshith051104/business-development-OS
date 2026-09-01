from typing import List, Optional
from pydantic import BaseModel, Field


class DashboardSummary(BaseModel):
    organizations: int = Field(0, description="Total number of organizations currently tracked")
    contacts: int = Field(0, description="Total number of individual business contacts stored")
    connections: int = Field(0, description="Total established connections with organizations/contacts")
    interested: int = Field(0, description="Organizations that have shown interest in our company/projects")
    meetings: int = Field(0, description="Upcoming or scheduled meetings count")
    active_discussions: int = Field(0, description="Organizations currently in active business discussions")
    partnerships: int = Field(0, description="Established strategic partnerships")


class ConnectionPipeline(BaseModel):
    potential: int = Field(0, description="Identified potential organizations")
    contacted: int = Field(0, description="Organizations contacted by BD team")
    connected: int = Field(0, description="Established preliminary connections")
    interested: int = Field(0, description="Confirmed interest in projects/solutions")
    meeting: int = Field(0, description="Meeting scheduled or held")
    discussion: int = Field(0, description="Active business/partnership discussion")
    partnership: int = Field(0, description="Signed or formal partnership established")


class TodayActivityItem(BaseModel):
    id: str
    organization: str
    contact: str
    activity_type: str  # Follow-up, Call, Meeting, Send presentation, Introduction
    time: str
    status: str = "pending"  # pending, in_progress, completed


class UpcomingMeetingItem(BaseModel):
    id: str
    organization: str
    contact: str
    meeting_type: str
    date: str
    time: str
    status: str = "scheduled"  # scheduled, confirmed, completed


class CategorizedFollowUpItem(BaseModel):
    id: str
    organization: str
    contact: str
    reason: str
    timing: str  # e.g. "3 days overdue", "Today, 3:00 PM", "Tomorrow"
    category: str  # "overdue", "today", "upcoming"
    status: str = "pending"


class GroupedFollowUps(BaseModel):
    overdue: List[CategorizedFollowUpItem] = Field(default_factory=list)
    today: List[CategorizedFollowUpItem] = Field(default_factory=list)
    upcoming: List[CategorizedFollowUpItem] = Field(default_factory=list)


class TodayActivitiesGroup(BaseModel):
    activities: List[TodayActivityItem] = Field(default_factory=list)
    followups: List[CategorizedFollowUpItem] = Field(default_factory=list)
    meetings: List[UpcomingMeetingItem] = Field(default_factory=list)


class RecentActivity(BaseModel):
    id: str
    type: str  # organization_added, contact_added, connection_created, status_updated, meeting_scheduled, project_shared, discussion_started
    description: str
    organization: str
    timestamp: str
    user_name: str


class DashboardResponse(BaseModel):
    summary: DashboardSummary
    pipeline: ConnectionPipeline
    today: TodayActivitiesGroup
    followups: GroupedFollowUps
    upcoming_meetings: List[UpcomingMeetingItem]
    recent_activity: List[RecentActivity]
