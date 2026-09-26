from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.user import User
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.meeting import Meeting, MeetingStatus
from app.models.followup import FollowUp, FollowUpStatus
from app.models.activity import ContactActivity
from app.schemas.dashboard import (
    DashboardSummary,
    ConnectionPipeline,
    TodayActivityItem,
    UpcomingMeetingItem,
    CategorizedFollowUpItem,
    GroupedFollowUps,
    TodayActivitiesGroup,
    RecentActivity,
    DashboardResponse,
)


class DashboardRepository:
    """Repository layer aggregating Business Development data.
    
    Dynamically computes organization statistics, contact counts, meetings, follow-ups, and pipeline stages directly from the database.
    """

    def get_summary_counts(self, db: Session) -> Dict[str, int]:
        """Dynamically compute summary metrics from Organization, Contact, and Meeting database tables."""
        total_orgs = db.query(Organization).filter(Organization.is_deleted.is_(False)).count()
        total_contacts = db.query(Contact).filter(Contact.is_deleted.is_(False)).count()

        if total_orgs == 0:
            return {
                "organizations": 0,
                "contacts": 0,
                "connections": 0,
                "interested": 0,
                "meetings": 0,
                "active_discussions": 0,
                "partnerships": 0,
            }

        # Query organization status counts
        status_counts = (
            db.query(func.lower(Organization.status), func.count(Organization.id))
            .filter(Organization.is_deleted.is_(False))
            .group_by(func.lower(Organization.status))
            .all()
        )
        counts_map = {st: cnt for st, cnt in status_counts}

        interested_cnt = counts_map.get("interested", 0)
        meeting_org_cnt = counts_map.get("meeting", 0)
        discussion_cnt = counts_map.get("discussion", 0)
        partnership_cnt = counts_map.get("partnership", 0)
        connected_cnt = counts_map.get("connected", 0)

        # Count real scheduled meetings from Meeting table
        real_meetings_count = (
            db.query(Meeting)
            .filter(
                Meeting.is_deleted.is_(False),
                Meeting.status.in_([MeetingStatus.SCHEDULED.value, MeetingStatus.RESCHEDULED.value]),
            )
            .count()
        )
        meetings_display = max(meeting_org_cnt, real_meetings_count) if (meeting_org_cnt or real_meetings_count) else 0

        # Count connected contacts
        connected_contacts = (
            db.query(Contact)
            .filter(
                Contact.is_deleted.is_(False),
                func.lower(Contact.connection_status).in_(["connected", "interested"]),
            )
            .count()
        )

        total_connections = connected_cnt + interested_cnt + meeting_org_cnt + discussion_cnt + partnership_cnt
        if connected_contacts > 0:
            total_connections = max(total_connections, connected_contacts)

        return {
            "organizations": total_orgs,
            "contacts": total_contacts,
            "connections": total_connections,
            "interested": interested_cnt,
            "meetings": meetings_display,
            "active_discussions": discussion_cnt,
            "partnerships": partnership_cnt,
        }

    def get_pipeline(self, db: Session) -> Dict[str, int]:
        """Dynamically calculate 7-stage connection pipeline metrics from source organizations."""
        total_orgs = db.query(Organization).filter(Organization.is_deleted.is_(False)).count()
        if total_orgs == 0:
            return {
                "potential": 0,
                "contacted": 0,
                "connected": 0,
                "interested": 0,
                "meeting": 0,
                "discussion": 0,
                "partnership": 0,
            }

        status_counts = (
            db.query(func.lower(Organization.status), func.count(Organization.id))
            .filter(Organization.is_deleted.is_(False))
            .group_by(func.lower(Organization.status))
            .all()
        )
        counts_map = {st: cnt for st, cnt in status_counts}

        return {
            "potential": counts_map.get("potential", 0),
            "contacted": counts_map.get("contacted", 0),
            "connected": counts_map.get("connected", 0),
            "interested": counts_map.get("interested", 0),
            "meeting": counts_map.get("meeting", 0),
            "discussion": counts_map.get("discussion", 0),
            "partnership": counts_map.get("partnership", 0),
        }

    def get_today_activities(self, db: Session) -> List[Dict[str, Any]]:
        """Dynamically get today's meetings and follow-ups."""
        now = datetime.now(timezone.utc)
        today_start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
        today_end = datetime(now.year, now.month, now.day, 23, 59, 59, tzinfo=timezone.utc)

        acts: List[Dict[str, Any]] = []

        # Today's meetings
        today_meetings = (
            db.query(Meeting)
            .filter(
                Meeting.is_deleted.is_(False),
                Meeting.scheduled_at >= today_start,
                Meeting.scheduled_at <= today_end,
            )
            .order_by(Meeting.scheduled_at.asc())
            .all()
        )
        for m in today_meetings:
            acts.append({
                "id": f"act-mtg-{m.id}",
                "organization": m.organization.name if m.organization else "Organization",
                "contact": m.primary_contact.full_name if m.primary_contact else "Key Contact",
                "activity_type": m.meeting_type or "Meeting",
                "time": m.scheduled_at.strftime("%I:%M %p"),
                "status": "completed" if m.status == MeetingStatus.COMPLETED.value else "pending",
            })

        # Today's follow-ups
        today_followups = (
            db.query(FollowUp)
            .filter(
                FollowUp.is_deleted.is_(False),
                FollowUp.due_at >= today_start,
                FollowUp.due_at <= today_end,
            )
            .order_by(FollowUp.due_at.asc())
            .all()
        )
        for f in today_followups:
            acts.append({
                "id": f"act-fol-{f.id}",
                "organization": f.organization.name if f.organization else "Organization",
                "contact": f.contact.full_name if f.contact else "Key Contact",
                "activity_type": "Follow-up",
                "time": f.due_at.strftime("%I:%M %p"),
                "status": "completed" if f.status == FollowUpStatus.COMPLETED.value else "pending",
            })

        return acts

    def get_upcoming_meetings(self, db: Session) -> List[Dict[str, Any]]:
        """Dynamically get real upcoming scheduled meetings from Meeting table."""
        now = datetime.now(timezone.utc)
        real_meetings = (
            db.query(Meeting)
            .filter(
                Meeting.is_deleted.is_(False),
                Meeting.status.in_([MeetingStatus.SCHEDULED.value, MeetingStatus.RESCHEDULED.value]),
                Meeting.scheduled_at >= now,
            )
            .order_by(Meeting.scheduled_at.asc())
            .limit(10)
            .all()
        )

        results = []
        if real_meetings:
            for m in real_meetings:
                results.append({
                    "id": f"mtg-{m.id}",
                "organization": m.organization.name if m.organization else "Organization",
                    "contact": m.primary_contact.full_name if m.primary_contact else "Key Contact",
                    "meeting_type": m.meeting_type or "Business Discussion",
                    "date": m.scheduled_at.strftime("%d %b %Y"),
                    "time": m.scheduled_at.strftime("%I:%M %p"),
                    "status": m.status.lower(),
                })

        return results

    def get_grouped_followups(self, db: Session) -> Dict[str, List[Dict[str, Any]]]:
        """Dynamically get grouped follow-ups into Overdue, Today, and Upcoming from database."""
        now = datetime.now(timezone.utc)
        today_start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
        today_end = datetime(now.year, now.month, now.day, 23, 59, 59, tzinfo=timezone.utc)

        pending_followups = (
            db.query(FollowUp)
            .filter(
                FollowUp.is_deleted.is_(False),
                FollowUp.status == FollowUpStatus.PENDING.value,
            )
            .order_by(FollowUp.due_at.asc())
            .all()
        )

        overdue_list = []
        today_list = []
        upcoming_list = []

        for f in pending_followups:
            due = f.due_at if f.due_at.tzinfo else f.due_at.replace(tzinfo=timezone.utc)
            org_name = f.organization.name if f.organization else "Organization"
            contact_name = f.contact.full_name if f.contact else "Key Contact"

            if due < today_start:
                days = (today_start.date() - due.date()).days
                overdue_list.append({
                    "id": f"fol-{f.id}",
                    "organization": org_name,
                    "contact": contact_name,
                    "reason": f.title,
                    "timing": f"{days} day{'s' if days > 1 else ''} overdue",
                    "category": "overdue",
                    "status": "pending",
                })
            elif today_start <= due <= today_end:
                today_list.append({
                    "id": f"fol-{f.id}",
                    "organization": org_name,
                    "contact": contact_name,
                    "reason": f.title,
                    "timing": f"Today, {due.strftime('%I:%M %p')}",
                    "category": "today",
                    "status": "pending",
                })
            else:
                days_ahead = (due.date() - today_start.date()).days
                timing_str = "Tomorrow" if days_ahead == 1 else f"In {days_ahead} days"
                upcoming_list.append({
                    "id": f"fol-{f.id}",
                    "organization": org_name,
                    "contact": contact_name,
                    "reason": f.title,
                    "timing": timing_str,
                    "category": "upcoming",
                    "status": "pending",
                })

        return {
            "overdue": overdue_list,
            "today": today_list,
            "upcoming": upcoming_list,
        }

    def get_recent_activities(self, db: Session, limit: int = 10) -> List[Dict[str, Any]]:
        """Dynamically get recent events from ContactActivity table or organizations."""
        contact_acts = (
            db.query(ContactActivity)
            .order_by(ContactActivity.created_at.desc())
            .limit(limit)
            .all()
        )

        if contact_acts:
            acts = []
            for ca in contact_acts:
                acts.append({
                    "id": f"act-ca-{ca.id}",
                    "type": ca.activity_type,
                    "description": ca.description,
                    "organization": ca.organization.name if ca.organization else "Organization",
                    "timestamp": ca.created_at.strftime("%d %b %H:%M"),
                    "user_name": ca.performed_by or "BD Team",
                })
            return acts

        # Fallback to recent organizations
        recent_orgs = (
            db.query(Organization)
            .filter(Organization.is_deleted.is_(False))
            .order_by(Organization.created_at.desc())
            .limit(limit)
            .all()
        )

        if recent_orgs and len(recent_orgs) >= 3:
            activities = []
            for org in recent_orgs:
                activities.append({
                    "id": f"act-org-{org.id}",
                    "type": "organization_added",
                    "description": f"{org.name} added to organizations ({org.organization_type})",
                    "organization": org.name,
                    "timestamp": "Recently",
                    "user_name": "BD Team",
                })
            return activities[:limit]

        return []


class DashboardService:
    """Service layer orchestrating Business Development dashboard data."""

    def __init__(self, repository: Optional[DashboardRepository] = None):
        self.repository = repository or DashboardRepository()

    def get_dashboard(self, db: Session, current_user: User) -> DashboardResponse:
        summary_raw = self.repository.get_summary_counts(db)
        pipeline_raw = self.repository.get_pipeline(db)
        today_acts_raw = self.repository.get_today_activities(db)
        meetings_raw = self.repository.get_upcoming_meetings(db)
        followups_raw = self.repository.get_grouped_followups(db)
        recent_acts_raw = self.repository.get_recent_activities(db)

        summary = DashboardSummary(**summary_raw)
        pipeline = ConnectionPipeline(**pipeline_raw)

        overdue_items = [CategorizedFollowUpItem(**f) for f in followups_raw.get("overdue", [])]
        today_followup_items = [CategorizedFollowUpItem(**f) for f in followups_raw.get("today", [])]
        upcoming_followup_items = [CategorizedFollowUpItem(**f) for f in followups_raw.get("upcoming", [])]

        followups = GroupedFollowUps(
            overdue=overdue_items,
            today=today_followup_items,
            upcoming=upcoming_followup_items,
        )

        today_activities = [TodayActivityItem(**a) for a in today_acts_raw]
        upcoming_meetings = [UpcomingMeetingItem(**m) for m in meetings_raw]

        today = TodayActivitiesGroup(
            activities=today_activities,
            followups=today_followup_items,
            meetings=upcoming_meetings,
        )

        recent_activity = [RecentActivity(**r) for r in recent_acts_raw]

        return DashboardResponse(
            summary=summary,
            pipeline=pipeline,
            today=today,
            followups=followups,
            upcoming_meetings=upcoming_meetings,
            recent_activity=recent_activity,
        )


dashboard_service = DashboardService()
