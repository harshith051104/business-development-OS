import io
import csv
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc, func

from app.auth.deps import require_business_development
from app.core.database import get_db
from app.models.user import User
from app.models.organization import Organization, ConnectionStatus, PriorityLevel
from app.models.contact import Contact
from app.models.opportunity import Opportunity, OpportunityStage, OpportunityPriority
from app.models.meeting import Meeting, MeetingStatus
from app.models.followup import FollowUp, FollowUpStatus
from app.models.activity import ContactActivity
from app.models.communication import Communication
from app.models.partnership import Partnership
from app.schemas.analytics import (
    OverviewMetricsOut,
    PipelineStageCountOut,
    ConversionRateItem,
    ConversionRatesOut,
    GrowthPointOut,
    MeetingAnalyticsOut,
    FollowUpAnalyticsOut,
    OpportunityAnalyticsOut,
    CommunicationAnalyticsOut,
    ActivityVolumeOut,
    TeamMemberPerformanceOut,
    TopOpportunityOut,
    StaleOrganizationOut,
    AttentionRequiredOut,
    ComprehensiveAnalyticsOut,
)

router = APIRouter(
    prefix="/api/business-development/analytics",
    tags=["Analytics & Reporting"],
    dependencies=[Depends(require_business_development)],
)

PIPELINE_ORDER = [
    ConnectionStatus.POTENTIAL.value,
    ConnectionStatus.CONTACTED.value,
    ConnectionStatus.CONNECTED.value,
    ConnectionStatus.INTERESTED.value,
    ConnectionStatus.MEETING.value,
    ConnectionStatus.DISCUSSION.value,
    ConnectionStatus.PARTNERSHIP.value,
]


def _normalize_dt(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _get_date_bounds(
    date_range: Optional[str] = None,
    start_date_str: Optional[str] = None,
    end_date_str: Optional[str] = None,
) -> tuple[Optional[datetime], Optional[datetime]]:
    now = datetime.now(timezone.utc)
    if start_date_str:
        try:
            sd = _normalize_dt(datetime.fromisoformat(start_date_str))
            ed = _normalize_dt(datetime.fromisoformat(end_date_str)) if end_date_str else now
            return sd, ed
        except Exception:
            pass

    if date_range == "today":
        start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
        return start, now
    elif date_range == "this_week":
        start_day = now - timedelta(days=now.weekday())
        start = datetime(start_day.year, start_day.month, start_day.day, 0, 0, 0, tzinfo=timezone.utc)
        return start, now
    elif date_range == "this_month":
        start = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)
        return start, now
    elif date_range == "last_month":
        first_this_month = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)
        last_month_end = first_this_month - timedelta(seconds=1)
        last_month_start = datetime(last_month_end.year, last_month_end.month, 1, 0, 0, 0, tzinfo=timezone.utc)
        return last_month_start, last_month_end
    elif date_range == "last_3_months":
        start = now - timedelta(days=90)
        return start, now
    elif date_range == "this_year":
        start = datetime(now.year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        return start, now

    return None, None


def _calc_conversion(from_name: str, to_name: str, from_c: int, to_c: int) -> ConversionRateItem:
    if from_c <= 0:
        return ConversionRateItem(
            from_stage=from_name,
            to_stage=to_name,
            rate=None,
            from_count=from_c,
            to_count=to_c,
            is_sufficient_data=False,
        )
    rate = round((to_c / from_c) * 100, 1)
    return ConversionRateItem(
        from_stage=from_name,
        to_stage=to_name,
        rate=rate,
        from_count=from_c,
        to_count=to_c,
        is_sufficient_data=True,
    )


@router.get("/overview", response_model=ComprehensiveAnalyticsOut)
def get_comprehensive_analytics(
    date_range: Optional[str] = Query("this_month"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    start_dt, end_dt = _get_date_bounds(date_range, start_date, end_date)
    now = datetime.now(timezone.utc)

    # 1. Total Organizations & Active Pipeline Counts
    orgs_query = db.query(Organization).filter(Organization.is_deleted.is_(False))
    if start_dt:
        orgs_query = orgs_query.filter(Organization.created_at >= start_dt)
    if end_dt:
        orgs_query = orgs_query.filter(Organization.created_at <= end_dt)

    total_orgs = orgs_query.count()

    # Pipeline distribution (all active orgs)
    all_orgs = db.query(Organization).filter(Organization.is_deleted.is_(False)).all()
    stage_counts_map: Dict[str, int] = {st: 0 for st in PIPELINE_ORDER}
    for o in all_orgs:
        if o.status in stage_counts_map:
            stage_counts_map[o.status] += 1
        else:
            stage_counts_map[ConnectionStatus.POTENTIAL.value] += 1

    total_all_orgs = max(1, len(all_orgs))
    pipeline_out: List[PipelineStageCountOut] = []
    for st in PIPELINE_ORDER:
        cnt = stage_counts_map[st]
        pipeline_out.append(
            PipelineStageCountOut(
                stage=st,
                count=cnt,
                percentage=round((cnt / total_all_orgs) * 100, 1),
            )
        )

    # 2. Top-level overview counts
    total_contacts = db.query(Contact).filter(Contact.is_deleted.is_(False)).count()
    connected_stages = [
        ConnectionStatus.CONNECTED.value,
        ConnectionStatus.INTERESTED.value,
        ConnectionStatus.MEETING.value,
        ConnectionStatus.DISCUSSION.value,
        ConnectionStatus.PARTNERSHIP.value,
    ]
    total_connections = db.query(Organization).filter(
        Organization.is_deleted.is_(False),
        Organization.status.in_(connected_stages),
    ).count()

    interested_orgs = stage_counts_map[ConnectionStatus.INTERESTED.value]
    total_meetings = db.query(Meeting).filter(Meeting.is_deleted.is_(False)).count()
    active_discussions = stage_counts_map[ConnectionStatus.DISCUSSION.value]
    active_opportunities = db.query(Opportunity).filter(
        Opportunity.is_deleted.is_(False),
        Opportunity.stage != OpportunityStage.PARTNERSHIP.value,
    ).count()
    partnership_records_cnt = db.query(Partnership).filter(Partnership.is_deleted.is_(False)).count()
    partnerships_established = max(stage_counts_map[ConnectionStatus.PARTNERSHIP.value], partnership_records_cnt)

    overview = OverviewMetricsOut(
        total_organizations=len(all_orgs),
        total_contacts=total_contacts,
        total_connections=total_connections,
        interested_organizations=interested_orgs,
        total_meetings=total_meetings,
        active_discussions=active_discussions,
        active_opportunities=active_opportunities,
        partnerships_established=partnerships_established,
    )

    # 3. Conversion Rates
    # Cumulative pipeline count
    cum_contacted = sum(stage_counts_map[st] for st in PIPELINE_ORDER[1:])
    cum_connected = sum(stage_counts_map[st] for st in PIPELINE_ORDER[2:])
    cum_interested = sum(stage_counts_map[st] for st in PIPELINE_ORDER[3:])
    cum_meeting = sum(stage_counts_map[st] for st in PIPELINE_ORDER[4:])
    cum_discussion = sum(stage_counts_map[st] for st in PIPELINE_ORDER[5:])
    cum_partnership = stage_counts_map[ConnectionStatus.PARTNERSHIP.value]

    conversion_rates = ConversionRatesOut(
        contacted_to_connected=_calc_conversion("Contacted", "Connected", cum_contacted, cum_connected),
        connected_to_interested=_calc_conversion("Connected", "Interested", cum_connected, cum_interested),
        interested_to_meeting=_calc_conversion("Interested", "Meeting", cum_interested, cum_meeting),
        meeting_to_discussion=_calc_conversion("Meeting", "Discussion", cum_meeting, cum_discussion),
        discussion_to_partnership=_calc_conversion("Discussion", "Partnership", cum_discussion, cum_partnership),
        overall_funnel=_calc_conversion("Total Pipeline", "Partnership", len(all_orgs), cum_partnership),
    )

    # 4. Organization Growth (monthly/weekly buckets)
    growth: List[GrowthPointOut] = []
    # 4 past periods
    for i in range(3, -1, -1):
        bucket_start = now - timedelta(days=(i + 1) * 7)
        bucket_end = now - timedelta(days=i * 7)
        c = db.query(Organization).filter(
            Organization.is_deleted.is_(False),
            Organization.created_at >= bucket_start,
            Organization.created_at < bucket_end,
        ).count()
        label = f"Week -{i}" if i > 0 else "This Week"
        growth.append(GrowthPointOut(period_label=label, count=c, date=bucket_start.strftime("%Y-%m-%d")))

    # 5. Meeting Analytics
    meeting_q = db.query(Meeting).filter(Meeting.is_deleted.is_(False))
    if start_dt:
        meeting_q = meeting_q.filter(Meeting.scheduled_at >= start_dt)
    if end_dt:
        meeting_q = meeting_q.filter(Meeting.scheduled_at <= end_dt)

    mtg_all = meeting_q.all()
    mtg_completed = sum(1 for m in mtg_all if m.status == MeetingStatus.COMPLETED.value)
    mtg_scheduled = sum(1 for m in mtg_all if m.status == MeetingStatus.SCHEDULED.value)
    mtg_cancelled = sum(1 for m in mtg_all if m.status == MeetingStatus.CANCELLED.value)
    mtg_rescheduled = sum(1 for m in mtg_all if m.status == MeetingStatus.RESCHEDULED.value)
    mtg_rate = round((mtg_completed / len(mtg_all)) * 100, 1) if mtg_all else None

    meetings_analytics = MeetingAnalyticsOut(
        total=len(mtg_all),
        completed=mtg_completed,
        scheduled=mtg_scheduled,
        cancelled=mtg_cancelled,
        rescheduled=mtg_rescheduled,
        completion_rate=mtg_rate,
    )

    # 6. Follow-Up Analytics
    fol_q = db.query(FollowUp).filter(FollowUp.is_deleted.is_(False))
    if start_dt:
        fol_q = fol_q.filter(FollowUp.due_at >= start_dt)
    if end_dt:
        fol_q = fol_q.filter(FollowUp.due_at <= end_dt)

    fol_all = fol_q.all()
    fol_completed = sum(1 for f in fol_all if f.status == FollowUpStatus.COMPLETED.value)
    fol_cancelled = sum(1 for f in fol_all if f.status == FollowUpStatus.CANCELLED.value)
    fol_pending = sum(
        1 for f in fol_all
        if f.status == FollowUpStatus.PENDING.value and f.due_at and _normalize_dt(f.due_at) >= now
    )
    fol_overdue = sum(
        1 for f in fol_all
        if f.status == FollowUpStatus.PENDING.value and f.due_at and _normalize_dt(f.due_at) < now
    )
    fol_rate = round((fol_completed / len(fol_all)) * 100, 1) if fol_all else None

    followups_analytics = FollowUpAnalyticsOut(
        total=len(fol_all),
        completed=fol_completed,
        pending=fol_pending,
        overdue=fol_overdue,
        cancelled=fol_cancelled,
        completion_rate=fol_rate,
    )

    # 7. Opportunity Analytics & Financial Evaluation
    opp_q = db.query(Opportunity).filter(Opportunity.is_deleted.is_(False))
    opp_all = opp_q.all()
    active_opps = [o for o in opp_all if o.stage != OpportunityStage.PARTNERSHIP.value]
    high_pri_opps = [o for o in active_opps if o.priority == OpportunityPriority.HIGH.value]
    no_next_act_opps = [
        o for o in active_opps if not o.next_action or not o.next_action.strip() or not o.next_action_date
    ]

    opp_stage_counts: Dict[str, int] = {}
    for o in opp_all:
        opp_stage_counts[o.stage] = opp_stage_counts.get(o.stage, 0) + 1

    # Financial evaluation (exclude None / 0)
    values = [o.estimated_value for o in active_opps if o.estimated_value is not None and o.estimated_value > 0]
    total_val = sum(values) if values else None
    has_val = len(values) > 0

    opportunities_analytics = OpportunityAnalyticsOut(
        total=len(opp_all),
        active=len(active_opps),
        high_priority=len(high_pri_opps),
        no_next_action=len(no_next_act_opps),
        stage_distribution=opp_stage_counts,
        total_estimated_value=total_val,
        has_financial_data=has_val,
        currency="USD",
    )

    # 8. Communication Analytics
    comm_q = db.query(Communication).filter(Communication.is_deleted.is_(False))
    if start_dt:
        comm_q = comm_q.filter(Communication.communication_date >= start_dt)
    if end_dt:
        comm_q = comm_q.filter(Communication.communication_date <= end_dt)

    comm_all = comm_q.all()
    comm_channel_counts: Dict[str, int] = {}
    comm_direction_counts: Dict[str, int] = {}
    for c in comm_all:
        comm_channel_counts[c.channel] = comm_channel_counts.get(c.channel, 0) + 1
        comm_direction_counts[c.direction] = comm_direction_counts.get(c.direction, 0) + 1

    communications_analytics = CommunicationAnalyticsOut(
        total=len(comm_all),
        channel_counts=comm_channel_counts,
        direction_counts=comm_direction_counts,
    )

    # 9. Activity Volume
    volume_added_orgs = db.query(Organization).filter(
        Organization.is_deleted.is_(False),
        Organization.created_at >= start_dt if start_dt else True,
    ).count()

    volume_added_contacts = db.query(Contact).filter(
        Contact.is_deleted.is_(False),
        Contact.created_at >= start_dt if start_dt else True,
    ).count()

    activity_volume = ActivityVolumeOut(
        organizations_added=volume_added_orgs,
        contacts_added=volume_added_contacts,
        communications_recorded=len(comm_all),
        meetings_completed=mtg_completed,
        followups_completed=fol_completed,
        opportunities_created=len(opp_all),
    )

    # 10. Team Performance
    users = db.query(User).filter(User.is_active.is_(True)).all()
    team_perf: List[TeamMemberPerformanceOut] = []
    for u in users:
        u_name = u.name or u.email
        u_orgs = db.query(Organization).filter(Organization.created_by == u_name).count()
        u_contacts = db.query(Contact).filter(Contact.created_by == u_name).count()
        u_comms = db.query(Communication).filter(Communication.created_by == u_name).count()
        u_mtgs = db.query(Meeting).filter(Meeting.created_by == u_name, Meeting.status == MeetingStatus.COMPLETED.value).count()
        u_opps = db.query(Opportunity).filter(or_(Opportunity.owner_id == u.id, Opportunity.created_by == u_name)).count()
        u_fols = db.query(FollowUp).filter(FollowUp.created_by == u_name, FollowUp.status == FollowUpStatus.COMPLETED.value).count()

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

    # 11. Top Opportunities
    top_opps_query = (
        db.query(Opportunity)
        .filter(
            Opportunity.is_deleted.is_(False),
            Opportunity.stage != OpportunityStage.PARTNERSHIP.value,
        )
        .order_by(Opportunity.estimated_value.desc().nullslast(), Opportunity.created_at.desc())
        .limit(5)
        .all()
    )

    top_opps_out: List[TopOpportunityOut] = []
    for opp in top_opps_query:
        org_name = opp.organization.name if opp.organization else "Organization"
        owner_name = opp.owner.name if opp.owner else opp.created_by
        top_opps_out.append(
            TopOpportunityOut(
                id=opp.id,
                name=opp.name,
                organization_id=opp.organization_id,
                organization_name=org_name,
                stage=opp.stage,
                priority=opp.priority,
                estimated_value=opp.estimated_value,
                currency=opp.currency or "USD",
                probability=opp.probability or 0,
                next_action=opp.next_action,
                next_action_date=opp.next_action_date,
                owner_name=owner_name,
            )
        )

    # 12. Attention Required & No-Activity Detection
    overdue_fols_list = [
        {
            "id": f.id,
            "title": f.title,
            "organization_name": f.organization.name if f.organization else None,
            "due_at": f.due_at,
            "priority": f.priority,
        }
        for f in fol_all
        if f.status == FollowUpStatus.PENDING.value and f.due_at and _normalize_dt(f.due_at) < now
    ]

    opps_no_action_list = [
        {
            "id": o.id,
            "name": o.name,
            "organization_name": o.organization.name if o.organization else None,
            "stage": o.stage,
            "priority": o.priority,
        }
        for o in no_next_act_opps
    ]

    # Interested orgs without upcoming meetings
    interested_orgs_list = db.query(Organization).filter(
        Organization.is_deleted.is_(False),
        Organization.status == ConnectionStatus.INTERESTED.value,
    ).all()

    interested_no_meeting_list = []
    for org in interested_orgs_list:
        org_meetings = db.query(Meeting).filter(
            Meeting.organization_id == org.id,
            Meeting.is_deleted.is_(False),
        ).all()
        has_future_mtg = any(
            _normalize_dt(m.scheduled_at) >= now
            for m in org_meetings
            if m.scheduled_at and m.status != MeetingStatus.CANCELLED.value
        )
        if not has_future_mtg:
            interested_no_meeting_list.append({
                "id": org.id,
                "name": org.name,
                "city": org.city,
                "priority": org.priority,
            })

    # Stale organizations (>14 days without activity for active connections)
    stale_orgs_out: List[StaleOrganizationOut] = []
    stale_cutoff = now - timedelta(days=14)
    active_connection_orgs = db.query(Organization).filter(
        Organization.is_deleted.is_(False),
        Organization.status.in_([
            ConnectionStatus.CONTACTED.value,
            ConnectionStatus.CONNECTED.value,
            ConnectionStatus.INTERESTED.value,
            ConnectionStatus.MEETING.value,
            ConnectionStatus.DISCUSSION.value,
        ])
    ).all()

    for org in active_connection_orgs:
        last_comm = db.query(Communication).filter(
            Communication.organization_id == org.id,
            Communication.is_deleted.is_(False),
        ).order_by(Communication.communication_date.desc()).first()

        last_mtg = db.query(Meeting).filter(
            Meeting.organization_id == org.id,
            Meeting.is_deleted.is_(False),
        ).order_by(Meeting.scheduled_at.desc()).first()

        last_act = db.query(ContactActivity).filter(
            ContactActivity.organization_id == org.id,
        ).order_by(ContactActivity.created_at.desc()).first()

        timestamps = []
        if last_comm and last_comm.communication_date:
            timestamps.append(_normalize_dt(last_comm.communication_date))
        if last_mtg and last_mtg.scheduled_at:
            timestamps.append(_normalize_dt(last_mtg.scheduled_at))
        if last_act and last_act.created_at:
            timestamps.append(_normalize_dt(last_act.created_at))

        latest_ts = max(timestamps) if timestamps else _normalize_dt(org.created_at)
        if latest_ts and latest_ts < stale_cutoff:
            days = (now - latest_ts).days
            primary_c = db.query(Contact).filter(
                Contact.organization_id == org.id,
                Contact.is_primary_contact.is_(True),
                Contact.is_deleted.is_(False),
            ).first()

            stale_orgs_out.append(
                StaleOrganizationOut(
                    id=org.id,
                    name=org.name,
                    status=org.status,
                    priority=org.priority,
                    days_since_last_activity=days,
                    last_activity_date=latest_ts,
                    primary_contact_name=primary_c.full_name if primary_c else None,
                )
            )

    attention_required = AttentionRequiredOut(
        overdue_followups_count=len(overdue_fols_list),
        opportunities_no_next_action_count=len(opps_no_action_list),
        interested_no_meeting_count=len(interested_no_meeting_list),
        stale_organizations_count=len(stale_orgs_out),
        overdue_followups=overdue_fols_list[:10],
        opportunities_no_next_action=opps_no_action_list[:10],
        interested_no_meeting=interested_no_meeting_list[:10],
        stale_organizations=stale_orgs_out[:10],
    )

    return ComprehensiveAnalyticsOut(
        date_range=date_range or "all_time",
        start_date=start_dt,
        end_date=end_dt,
        overview=overview,
        pipeline=pipeline_out,
        conversion_rates=conversion_rates,
        organization_growth=growth,
        meetings=meetings_analytics,
        followups=followups_analytics,
        opportunities=opportunities_analytics,
        communications=communications_analytics,
        activity_volume=activity_volume,
        team_performance=team_perf,
        top_opportunities=top_opps_out,
        attention_required=attention_required,
    )


def _sanitize_csv_cell(val: Any) -> str:
    if val is None:
        return ""
    s = str(val)
    if s.startswith(("=", "+", "-", "@")):
        return f"'{s}"
    return s


@router.get("/export")
def export_analytics_csv(
    date_range: Optional[str] = Query("this_month"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_business_development),
):
    """
    Exports comprehensive Business Development analytics summary and details to CSV.
    Safely sanitizes all cells against CSV formula injection.
    """
    data = get_comprehensive_analytics(date_range, start_date, end_date, db, current_user)

    output = io.StringIO()
    writer = csv.writer(output)

    def write_safe_row(row_items: list[Any]):
        writer.writerow([_sanitize_csv_cell(item) for item in row_items])

    # 1. Header
    write_safe_row(["ELLY INTERNAL BUSINESS DEVELOPMENT REPORT"])
    write_safe_row(["Report Date", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")])
    write_safe_row(["Date Range", data.date_range])
    write_safe_row([])

    # 2. Executive Overview Metrics
    write_safe_row(["EXECUTIVE OVERVIEW METRICS"])
    write_safe_row(["Metric", "Count"])
    write_safe_row(["Total Organizations", data.overview.total_organizations])
    write_safe_row(["Total Contacts", data.overview.total_contacts])
    write_safe_row(["Total Connections", data.overview.total_connections])
    write_safe_row(["Interested Organizations", data.overview.interested_organizations])
    write_safe_row(["Total Meetings", data.overview.total_meetings])
    write_safe_row(["Active Discussions", data.overview.active_discussions])
    write_safe_row(["Active Opportunities", data.overview.active_opportunities])
    write_safe_row(["Partnerships Established", data.overview.partnerships_established])
    write_safe_row([])

    # 3. Connection Pipeline Distribution
    write_safe_row(["CONNECTION PIPELINE DISTRIBUTION"])
    write_safe_row(["Stage", "Organizations", "Share %"])
    for stage_item in data.pipeline:
        write_safe_row([stage_item.stage, stage_item.count, f"{stage_item.percentage}%"])
    write_safe_row([])

    # 4. Conversion Rates
    write_safe_row(["STAGE CONVERSION EFFICIENCY"])
    write_safe_row(["From Stage", "To Stage", "From Count", "To Count", "Conversion Rate %"])
    for conv_item in [
        data.conversion_rates.contacted_to_connected,
        data.conversion_rates.connected_to_interested,
        data.conversion_rates.interested_to_meeting,
        data.conversion_rates.meeting_to_discussion,
        data.conversion_rates.discussion_to_partnership,
        data.conversion_rates.overall_funnel,
    ]:
        rate_str = f"{conv_item.rate}%" if conv_item.rate is not None else "Not enough data"
        write_safe_row([conv_item.from_stage, conv_item.to_stage, conv_item.from_count, conv_item.to_count, rate_str])
    write_safe_row([])

    # 5. Opportunity Details
    write_safe_row(["TOP ACTIVE BUSINESS OPPORTUNITIES"])
    write_safe_row(["Opportunity Name", "Organization", "Stage", "Priority", "Estimated Value", "Probability", "Next Action", "Next Action Date"])
    for opp in data.top_opportunities:
        val_str = f"{opp.currency} {opp.estimated_value:,.2f}" if opp.estimated_value else "Value unavailable"
        act_date = opp.next_action_date.strftime("%Y-%m-%d") if opp.next_action_date else ""
        write_safe_row([opp.name, opp.organization_name, opp.stage, opp.priority, val_str, f"{opp.probability}%", opp.next_action or "None set", act_date])
    write_safe_row([])

    # 6. Team Operational Visibility
    write_safe_row(["TEAM OPERATIONAL ACTIVITY"])
    write_safe_row(["BD Rep", "Email", "Organizations Added", "Contacts Added", "Communications Logged", "Meetings Completed", "Opportunities Managed", "Follow-ups Completed"])
    for tm in data.team_performance:
        write_safe_row([tm.name, tm.email, tm.organizations_added, tm.contacts_added, tm.communications_logged, tm.meetings_completed, tm.opportunities_managed, tm.followups_completed])

    output.seek(0)
    filename = f"bd_analytics_report_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
