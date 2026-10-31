from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, List

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.communication import Communication
from app.models.meeting import Meeting, MeetingStatus
from app.models.opportunity import Opportunity
from app.models.followup import FollowUp, FollowUpStatus
from app.models.task import BDTask, TaskStatus
from app.schemas.analytics import TeamMemberPerformanceOut


def resolve_period(period_text: str) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    phrase = (period_text or "").strip().lower()

    if phrase == "this week":
        start_day = now - timedelta(days=now.weekday())
        start = datetime(start_day.year, start_day.month, start_day.day, 0, 0, 0, tzinfo=timezone.utc)
        return start, now
    elif phrase == "this month":
        start = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)
        return start, now
    elif phrase == "last quarter":
        start = now - timedelta(days=90)
        return start, now

    return now - timedelta(days=30), now


def get_team_performance(db: Session, period_start: datetime, period_end: datetime) -> List[TeamMemberPerformanceOut]:
    users = db.query(User).filter(User.is_active.is_(True)).all()
    team_perf: List[TeamMemberPerformanceOut] = []
    for u in users:
        u_name = u.name or u.email
        u_orgs = db.query(Organization).filter(
            Organization.created_by == u_name,
            Organization.created_at >= period_start,
            Organization.created_at <= period_end,
        ).count()
        u_contacts = db.query(Contact).filter(
            Contact.created_by == u_name,
            Contact.created_at >= period_start,
            Contact.created_at <= period_end,
        ).count()
        u_comms = db.query(Communication).filter(
            Communication.created_by == u_name,
            Communication.created_at >= period_start,
            Communication.created_at <= period_end,
        ).count()
        u_mtgs = db.query(Meeting).filter(
            Meeting.created_by == u_name,
            Meeting.status == MeetingStatus.COMPLETED.value,
            Meeting.created_at >= period_start,
            Meeting.created_at <= period_end,
        ).count()
        u_opps = db.query(Opportunity).filter(
            or_(Opportunity.owner_id == u.id, Opportunity.created_by == u_name),
            Opportunity.created_at >= period_start,
            Opportunity.created_at <= period_end,
        ).count()
        u_fols = db.query(FollowUp).filter(
            FollowUp.created_by == u_name,
            FollowUp.status == FollowUpStatus.COMPLETED.value,
            FollowUp.created_at >= period_start,
            FollowUp.created_at <= period_end,
        ).count()

        team_perf.append(
            TeamMemberPerformanceOut(
                user_id=u.id,
                name=u_name,
                email=u.email,
                organizations_added=u_orgs,
                contacts_added=u_contacts,
                communications_logged=u_comms,
                meetings_completed=u_mtgs,
                opportunities_managed=u_opps,
                followups_completed=u_fols,
            )
        )
    return team_perf


@dataclass
class ReportData:
    period_start: datetime
    period_end: datetime
    team: List[TeamMemberPerformanceOut]
    task_stats: Dict[int, dict]
    company_totals: dict = field(default_factory=dict)


def gather_report_data(db: Session, period_start: datetime, period_end: datetime) -> ReportData:
    now = datetime.now(timezone.utc)
    team = get_team_performance(db, period_start, period_end)

    task_stats: Dict[int, dict] = {}
    users = db.query(User).filter(User.is_active.is_(True)).all()
    for u in users:
        completed = db.query(BDTask).filter(
            BDTask.owner_id == u.id,
            BDTask.status == TaskStatus.COMPLETED.value,
            BDTask.completed_at >= period_start,
            BDTask.completed_at <= period_end,
        ).count()
        open_count = db.query(BDTask).filter(
            BDTask.owner_id == u.id,
            BDTask.status != TaskStatus.COMPLETED.value,
        ).count()
        overdue = db.query(BDTask).filter(
            BDTask.owner_id == u.id,
            BDTask.status != TaskStatus.COMPLETED.value,
            BDTask.due_date < now,
        ).count()
        task_stats[u.id] = {"completed": completed, "open": open_count, "overdue": overdue}

    organizations_added = db.query(Organization).filter(
        Organization.is_deleted.is_(False),
        Organization.created_at >= period_start,
        Organization.created_at <= period_end,
    ).count()
    contacts_added = db.query(Contact).filter(
        Contact.is_deleted.is_(False),
        Contact.created_at >= period_start,
        Contact.created_at <= period_end,
    ).count()
    communications_recorded = db.query(Communication).filter(
        Communication.is_deleted.is_(False),
        Communication.communication_date >= period_start,
        Communication.communication_date <= period_end,
    ).count()
    meetings_completed = db.query(Meeting).filter(
        Meeting.is_deleted.is_(False),
        Meeting.status == MeetingStatus.COMPLETED.value,
        Meeting.scheduled_at >= period_start,
        Meeting.scheduled_at <= period_end,
    ).count()
    followups_completed = db.query(FollowUp).filter(
        FollowUp.is_deleted.is_(False),
        FollowUp.status == FollowUpStatus.COMPLETED.value,
        FollowUp.due_at >= period_start,
        FollowUp.due_at <= period_end,
    ).count()
    opportunities_created = db.query(Opportunity).filter(
        Opportunity.is_deleted.is_(False),
        Opportunity.created_at >= period_start,
        Opportunity.created_at <= period_end,
    ).count()

    company_totals = {
        "organizations_added": organizations_added,
        "contacts_added": contacts_added,
        "communications_recorded": communications_recorded,
        "meetings_completed": meetings_completed,
        "followups_completed": followups_completed,
        "opportunities_created": opportunities_created,
    }

    return ReportData(
        period_start=period_start,
        period_end=period_end,
        team=team,
        task_stats=task_stats,
        company_totals=company_totals,
    )
