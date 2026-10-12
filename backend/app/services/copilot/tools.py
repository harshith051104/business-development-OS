import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func

logger = logging.getLogger(__name__)

from app.models.user import User, UserRole
from app.models.organization import Organization, ConnectionStatus, PriorityLevel
from app.models.contact import Contact
from app.models.opportunity import Opportunity, OpportunityStage, OpportunityPriority
from app.models.meeting import Meeting, MeetingStatus
from app.models.followup import FollowUp, FollowUpStatus, FollowUpPriority
from app.models.communication import Communication, CommunicationChannel
from app.models.partnership import Partnership, PartnershipStatus
from app.models.project import Project
from app.models.demo import Demo
from app.models.proposal import Proposal
from app.models.negotiation import Negotiation
from app.models.customer import Customer, CustomerStatus
from app.models.discovery import DiscoveredOrganization, DiscoveredContact
from app.models.outreach import OutreachDraft, OutreachTemplate
from app.models.audit import AuditLog
from app.models.activity import ContactActivity
from app.schemas.copilot import DataReference, ConfirmationAction, ToolExecutionRecord


# ─────────────────────────────────────────────────────────────
# HELPER LOOKUPS
# ─────────────────────────────────────────────────────────────

def resolve_organization(db: Session, identifier: Any) -> Optional[Organization]:
    if not identifier:
        return None
    if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
        return db.query(Organization).filter(Organization.id == int(identifier), Organization.is_deleted == False).first()
    # Name match
    clean = str(identifier).strip()
    return db.query(Organization).filter(
        Organization.name.ilike(f"%{clean}%"),
        Organization.is_deleted == False
    ).first()


def resolve_contact(db: Session, identifier: Any, org_id: Optional[int] = None) -> Optional[Contact]:
    if not identifier:
        return None
    if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
        return db.query(Contact).filter(Contact.id == int(identifier), Contact.is_deleted == False).first()
    
    clean = str(identifier).strip()
    q = db.query(Contact).filter(Contact.is_deleted == False)
    if org_id:
        q = q.filter(Contact.organization_id == org_id)
    
    parts = clean.split()
    if len(parts) >= 2:
        return q.filter(Contact.first_name.ilike(f"%{parts[0]}%"), Contact.last_name.ilike(f"%{parts[1]}%")).first()
    return q.filter(or_(Contact.first_name.ilike(f"%{clean}%"), Contact.last_name.ilike(f"%{clean}%"))).first()


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


# ─────────────────────────────────────────────────────────────
# 1. DASHBOARD, ATTENTION & NEXT ACTIONS
# ─────────────────────────────────────────────────────────────

def get_dashboard_summary(db: Session, user: User) -> Dict[str, Any]:
    total_orgs = db.query(Organization).filter(Organization.is_deleted == False).count()
    active_opps = db.query(Opportunity).filter(Opportunity.is_deleted == False).count()
    pipe_val = db.query(func.sum(Opportunity.estimated_value)).filter(Opportunity.is_deleted == False).scalar() or 0.0
    
    # Today meetings
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    all_meets = db.query(Meeting).filter(Meeting.is_deleted == False).all()
    today_meets = len([m for m in all_meets if m.scheduled_at and today_start <= _to_utc(m.scheduled_at) < today_end])
    
    all_fu = db.query(FollowUp).filter(FollowUp.is_deleted == False, FollowUp.status == FollowUpStatus.PENDING.value).all()
    overdue_fu = len([f for f in all_fu if f.due_at and _to_utc(f.due_at) < now])
    
    active_partnerships = db.query(Partnership).filter(Partnership.is_deleted == False, Partnership.status == PartnershipStatus.ACTIVE.value).count()

    return {
        "total_organizations": total_orgs,
        "active_opportunities_count": active_opps,
        "total_pipeline_value": float(pipe_val),
        "today_meetings": today_meets,
        "overdue_followups": overdue_fu,
        "active_partnerships": active_partnerships,
    }


def get_attention_items(db: Session, user: User) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    items = []

    # 1. Overdue followups
    all_fu = db.query(FollowUp).filter(FollowUp.is_deleted == False, FollowUp.status == FollowUpStatus.PENDING.value).all()
    overdue = [f for f in all_fu if f.due_at and _to_utc(f.due_at) < today_start]
    overdue.sort(key=lambda f: _to_utc(f.due_at))

    for f in overdue[:5]:
        items.append({
            "type": "overdue_followup",
            "priority": "HIGH",
            "title": f"Overdue Follow-up: {f.title}",
            "description": f"Due on {f.due_at.strftime('%b %d') if f.due_at else 'N/A'} for {f.organization.name if f.organization else 'General'}",
            "entity_type": "followup",
            "entity_id": f.id,
            "url": f"/business-development/followups/{f.id}"
        })

    # 2. Today's & Tomorrow's meetings
    all_meets = db.query(Meeting).filter(Meeting.is_deleted == False).all()
    meets_2d = [m for m in all_meets if m.scheduled_at and today_start <= _to_utc(m.scheduled_at) <= today_start + timedelta(days=2)]
    meets_2d.sort(key=lambda m: _to_utc(m.scheduled_at))

    for m in meets_2d:
        is_today = _to_utc(m.scheduled_at) < today_end
        items.append({
            "type": "upcoming_meeting",
            "priority": "HIGH" if is_today else "MEDIUM",
            "title": f"{'Today' if is_today else 'Tomorrow'} Meeting: {m.title}",
            "description": f"At {m.scheduled_at.strftime('%I:%M %p') if m.scheduled_at else 'N/A'} with {m.organization.name if m.organization else 'Organization'}",
            "entity_type": "meeting",
            "entity_id": m.id,
            "url": f"/business-development/meetings/{m.id}"
        })

    # 3. High-priority uncontacted organizations
    uncontacted = db.query(Organization).filter(
        Organization.is_deleted == False,
        Organization.status == ConnectionStatus.POTENTIAL.value,
        Organization.priority == PriorityLevel.HIGH.value
    ).limit(3).all()

    for org in uncontacted:
        items.append({
            "type": "uncontacted_high_priority",
            "priority": "HIGH",
            "title": f"High Priority Target: {org.name}",
            "description": f"Located in {org.city or org.country}, in Potential stage with no initial outreach yet.",
            "entity_type": "organization",
            "entity_id": org.id,
            "url": f"/business-development/organizations/{org.id}"
        })

    # 4. Stale opportunities (> 30 days unchanged in Discussion/Meeting)
    stale_date = now - timedelta(days=30)
    stale_opps = db.query(Opportunity).filter(
        Opportunity.is_deleted == False,
        Opportunity.stage.in_([OpportunityStage.MEETING.value, OpportunityStage.DISCUSSION.value]),
        Opportunity.updated_at < stale_date
    ).limit(3).all()

    for opp in stale_opps:
        items.append({
            "type": "stale_opportunity",
            "priority": "MEDIUM",
            "title": f"Stale Opportunity: {opp.name}",
            "description": f"In {opp.stage} with {opp.organization.name if opp.organization else 'Org'} — no update in >30 days.",
            "entity_type": "opportunity",
            "entity_id": opp.id,
            "url": f"/business-development/opportunities/{opp.id}"
        })

    return items


def get_next_actions(db: Session, user: User) -> List[Dict[str, Any]]:
    attention = get_attention_items(db, user)
    actions = []
    for item in attention:
        actions.append({
            "action": f"Address {item['title']}",
            "rationale": item['description'],
            "target_url": item['url'],
            "priority": item['priority']
        })
    return actions


# ─────────────────────────────────────────────────────────────
# 2. ORGANIZATIONS & 360° BRIEFING
# ─────────────────────────────────────────────────────────────

def search_organizations(
    db: Session,
    keyword: Optional[str] = None,
    location: Optional[str] = None,
    organization_type: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    specialty: Optional[str] = None,
    limit: int = 15
) -> List[Dict[str, Any]]:
    q = db.query(Organization).filter(Organization.is_deleted == False)

    if keyword:
        q = q.filter(or_(
            Organization.name.ilike(f"%{keyword}%"),
            Organization.description.ilike(f"%{keyword}%")
        ))
    if location:
        q = q.filter(or_(
            Organization.city.ilike(f"%{location}%"),
            Organization.state.ilike(f"%{location}%"),
            Organization.country.ilike(f"%{location}%")
        ))
    if organization_type and organization_type != "All":
        q = q.filter(Organization.organization_type.ilike(f"%{organization_type}%"))
    if status and status != "All":
        q = q.filter(Organization.status == status)
    if priority and priority != "All":
        q = q.filter(Organization.priority == priority)
    if specialty:
        q = q.filter(Organization.description.ilike(f"%{specialty}%"))

    orgs = q.order_by(desc(Organization.created_at)).limit(limit).all()
    results = []
    for o in orgs:
        results.append({
            "id": o.id,
            "name": o.name,
            "organization_type": o.organization_type,
            "status": o.status,
            "priority": o.priority,
            "city": o.city,
            "state": o.state,
            "country": o.country,
            "website": o.website,
            "owner": o.owner.name if o.owner else "Unassigned",
            "contacts_count": len([c for c in o.contacts if not c.is_deleted]),
        })
    return results


def get_organization_detail(db: Session, org_id: int) -> Optional[Dict[str, Any]]:
    org = db.query(Organization).filter(Organization.id == org_id, Organization.is_deleted == False).first()
    if not org:
        return None
    return {
        "id": org.id,
        "name": org.name,
        "organization_type": org.organization_type,
        "description": org.description,
        "status": org.status,
        "priority": org.priority,
        "city": org.city,
        "state": org.state,
        "country": org.country,
        "website": org.website,
        "email": org.email,
        "phone": org.phone,
        "notes": org.notes,
        "owner": org.owner.name if org.owner else "Unassigned",
        "created_at": org.created_at.isoformat(),
    }


def get_organization_360_briefing(db: Session, org_identifier: Any) -> Optional[Dict[str, Any]]:
    org = resolve_organization(db, org_identifier)
    if not org:
        return None

    # Contacts
    contacts = db.query(Contact).filter(Contact.organization_id == org.id, Contact.is_deleted == False).all()
    contact_roster = []
    for c in contacts:
        contact_roster.append({
            "id": c.id,
            "name": f"{c.first_name} {c.last_name}",
            "designation": c.designation,
            "department": c.department,
            "email": c.email,
            "phone": c.phone,
            "is_decision_maker": c.is_decision_maker,
            "is_primary": c.is_primary_contact,
        })

    # Opportunities
    opps = db.query(Opportunity).filter(Opportunity.organization_id == org.id, Opportunity.is_deleted == False).all()
    opp_list = []
    for op in opps:
        opp_list.append({
            "id": op.id,
            "title": op.name,
            "stage": op.stage,
            "value": op.estimated_value,
            "probability": op.probability,
            "next_action": op.next_action,
        })

    # Meetings
    meetings = db.query(Meeting).filter(Meeting.organization_id == org.id, Meeting.is_deleted == False).order_by(desc(Meeting.scheduled_at)).all()
    meeting_list = []
    for m in meetings:
        meeting_list.append({
            "id": m.id,
            "title": m.title,
            "scheduled_at": m.scheduled_at.isoformat(),
            "status": m.status,
            "meeting_type": m.meeting_type,
            "notes": m.notes,
            "decisions": m.decisions,
        })

    # Communications
    comms = db.query(Communication).filter(Communication.organization_id == org.id, Communication.is_deleted == False).order_by(desc(Communication.communication_date)).limit(10).all()
    comm_list = []
    for cm in comms:
        comm_list.append({
            "id": cm.id,
            "channel": cm.channel,
            "subject": cm.subject,
            "date": cm.communication_date.isoformat(),
            "summary": cm.summary or cm.content,
        })

    # Partnerships
    partnerships = db.query(Partnership).filter(Partnership.organization_id == org.id, Partnership.is_deleted == False).all()
    part_list = []
    for p in partnerships:
        part_list.append({
            "id": p.id,
            "name": p.name,
            "status": p.status,
            "type": p.partnership_type,
        })

    # Follow-ups
    followups = db.query(FollowUp).filter(FollowUp.organization_id == org.id, FollowUp.is_deleted == False, FollowUp.status == FollowUpStatus.PENDING.value).all()
    fu_list = []
    for f in followups:
        fu_list.append({
            "id": f.id,
            "title": f.title,
            "due_date": f.due_at.isoformat(),
            "priority": f.priority,
        })

    # Synthesize Recommended Next Action
    recommended_action = "Initiate initial introductory outreach with key executive leadership."
    if org.status == ConnectionStatus.POTENTIAL.value:
        if contact_roster:
            dm = next((c for c in contact_roster if c["is_decision_maker"]), contact_roster[0])
            recommended_action = f"Send personalized introduction email to {dm['name']} ({dm['designation']})."
        else:
            recommended_action = "Discover key decision-makers (CTO, CIO, VP of Sales, Head of Partnerships) using B2B Discovery."
    elif org.status in [ConnectionStatus.CONTACTED.value, ConnectionStatus.CONNECTED.value]:
        recommended_action = "Follow up to gauge platform interest and schedule an exploratory showcase meeting."
    elif org.status == ConnectionStatus.INTERESTED.value:
        recommended_action = "Schedule a Project Showcase meeting to demonstrate platform capabilities."
    elif org.status == ConnectionStatus.MEETING.value:
        recommended_action = "Review meeting decisions and prepare commercial proposal / opportunity terms."
    elif org.status == ConnectionStatus.DISCUSSION.value:
        recommended_action = "Finalize partnership scope, SLA, and convert opportunity to formal Partnership."

    return {
        "organization": {
            "id": org.id,
            "name": org.name,
            "type": org.organization_type,
            "status": org.status,
            "priority": org.priority,
            "location": f"{org.city or ''}, {org.state or ''}, {org.country or ''}".strip(", "),
            "website": org.website,
            "owner": org.owner.name if org.owner else "Unassigned",
            "description": org.description,
            "notes": org.notes,
        },
        "contacts": contact_roster,
        "opportunities": opp_list,
        "meetings": meeting_list,
        "communications": comm_list,
        "partnerships": part_list,
        "pending_followups": fu_list,
        "recommended_next_action": recommended_action,
    }


# ─────────────────────────────────────────────────────────────
# 3. CONTACTS & DECISION MAKERS
# ─────────────────────────────────────────────────────────────

def search_contacts(
    db: Session,
    keyword: Optional[str] = None,
    organization_id: Optional[int] = None,
    org_name: Optional[str] = None,
    role: Optional[str] = None,
    is_decision_maker: Optional[bool] = None,
    limit: int = 15
) -> List[Dict[str, Any]]:
    q = db.query(Contact).filter(Contact.is_deleted == False)

    if org_name and not organization_id:
        org = resolve_organization(db, org_name)
        if org:
            organization_id = org.id

    if organization_id:
        q = q.filter(Contact.organization_id == organization_id)
    if keyword:
        q = q.filter(or_(
            Contact.first_name.ilike(f"%{keyword}%"),
            Contact.last_name.ilike(f"%{keyword}%"),
            Contact.designation.ilike(f"%{keyword}%"),
            Contact.email.ilike(f"%{keyword}%")
        ))
    if role:
        q = q.filter(or_(
            Contact.designation.ilike(f"%{role}%"),
            Contact.department.ilike(f"%{role}%")
        ))
    if is_decision_maker is not None:
        q = q.filter(Contact.is_decision_maker == is_decision_maker)

    contacts = q.order_by(desc(Contact.created_at)).limit(limit).all()
    results = []
    for c in contacts:
        results.append({
            "id": c.id,
            "name": f"{c.first_name} {c.last_name}".strip(),
            "designation": c.designation,
            "department": c.department,
            "organization_name": c.organization.name if c.organization else "None",
            "organization_id": c.organization_id,
            "email": c.email,
            "phone": c.phone,
            "is_decision_maker": c.is_decision_maker,
            "is_primary": c.is_primary_contact,
        })
    return results


def find_decision_makers(
    db: Session,
    organization_id: Optional[int] = None,
    org_name: Optional[str] = None,
    roles: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    if org_name and not organization_id:
        org = resolve_organization(db, org_name)
        if org:
            organization_id = org.id

    q = db.query(Contact).filter(Contact.is_deleted == False)
    if organization_id:
        q = q.filter(Contact.organization_id == organization_id)

    # Filter for decision makers or executive titles
    leadership_filters = [
        Contact.is_decision_maker == True,
        Contact.designation.ilike("%CEO%"),
        Contact.designation.ilike("%CTO%"),
        Contact.designation.ilike("%CDO%"),
        Contact.designation.ilike("%CIO%"),
        Contact.designation.ilike("%Director%"),
        Contact.designation.ilike("%President%"),
        Contact.designation.ilike("%Head%"),
        Contact.designation.ilike("%VP%"),
    ]
    if roles:
        role_filters = [Contact.designation.ilike(f"%{r}%") for r in roles]
        q = q.filter(or_(*role_filters))
    else:
        q = q.filter(or_(*leadership_filters))

    contacts = q.order_by(desc(Contact.is_decision_maker)).limit(20).all()
    results = []
    for c in contacts:
        results.append({
            "id": c.id,
            "name": f"{c.first_name} {c.last_name}".strip(),
            "designation": c.designation,
            "organization_id": c.organization_id,
            "organization_name": c.organization.name if c.organization else "None",
            "email": c.email,
            "phone": c.phone,
            "is_decision_maker": c.is_decision_maker,
        })
    return results


# ─────────────────────────────────────────────────────────────
# 4. CONNECTION PIPELINE
# ─────────────────────────────────────────────────────────────

def get_pipeline_summary(db: Session) -> Dict[str, Any]:
    stages = {}
    for stage in ConnectionStatus:
        orgs = db.query(Organization).filter(
            Organization.is_deleted == False,
            Organization.status == stage.value
        ).all()
        stages[stage.value] = {
            "count": len(orgs),
            "sample_organizations": [o.name for o in orgs[:5]]
        }
    return stages


def get_stage_organizations(db: Session, stage_name: str) -> List[Dict[str, Any]]:
    # Normalize stage
    matched_stage = None
    for s in ConnectionStatus:
        if s.value.lower() == stage_name.lower() or s.name.lower() == stage_name.lower():
            matched_stage = s.value
            break
    if not matched_stage:
        matched_stage = stage_name.title()

    orgs = db.query(Organization).filter(
        Organization.is_deleted == False,
        Organization.status == matched_stage
    ).order_by(desc(Organization.priority), desc(Organization.updated_at)).all()

    return [{
        "id": o.id,
        "name": o.name,
        "priority": o.priority,
        "location": o.city or o.country,
        "owner": o.owner.name if o.owner else "Unassigned",
        "contacts_count": len([c for c in o.contacts if not c.is_deleted])
    } for o in orgs]


# ─────────────────────────────────────────────────────────────
# 5. OPPORTUNITIES
# ─────────────────────────────────────────────────────────────

def search_opportunities(
    db: Session,
    keyword: Optional[str] = None,
    org_name: Optional[str] = None,
    stage: Optional[str] = None,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    priority: Optional[str] = None,
    is_stale: Optional[bool] = None,
    limit: int = 15
) -> List[Dict[str, Any]]:
    q = db.query(Opportunity).filter(Opportunity.is_deleted == False)

    if org_name:
        org = resolve_organization(db, org_name)
        if org:
            q = q.filter(Opportunity.organization_id == org.id)
    if keyword:
        q = q.filter(or_(
            Opportunity.name.ilike(f"%{keyword}%"),
            Opportunity.description.ilike(f"%{keyword}%")
        ))
    if stage and stage != "All":
        q = q.filter(Opportunity.stage.ilike(f"%{stage}%"))
    if min_value is not None:
        q = q.filter(Opportunity.estimated_value >= min_value)
    if max_value is not None:
        q = q.filter(Opportunity.estimated_value <= max_value)
    if priority and priority != "All":
        q = q.filter(Opportunity.priority == priority)
    if is_stale:
        stale_date = datetime.now(timezone.utc) - timedelta(days=30)
        q = q.filter(Opportunity.updated_at < stale_date)

    opps = q.order_by(desc(Opportunity.estimated_value)).limit(limit).all()
    results = []
    for op in opps:
        results.append({
            "id": op.id,
            "title": op.name,
            "organization_name": op.organization.name if op.organization else "None",
            "organization_id": op.organization_id,
            "stage": op.stage,
            "value": op.estimated_value,
            "probability": op.probability,
            "priority": op.priority,
            "owner": op.owner.name if op.owner else "Unassigned",
            "next_action": op.next_action,
        })
    return results


# ─────────────────────────────────────────────────────────────
# 6. MEETINGS & PRE-MEETING PREP BRIEFING
# ─────────────────────────────────────────────────────────────

def search_meetings(
    db: Session,
    user: Optional[User] = None,
    org_name: Optional[str] = None,
    time_filter: str = "upcoming",  # 'today', 'tomorrow', 'this_week', 'past', 'upcoming'
    limit: int = 10
) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    tomorrow_end = today_start + timedelta(days=2)
    week_end = today_start + timedelta(days=7)

    q = db.query(Meeting).filter(Meeting.is_deleted == False)

    if org_name:
        org = resolve_organization(db, org_name)
        if org:
            q = q.filter(Meeting.organization_id == org.id)

    if time_filter == "today":
        q = q.filter(Meeting.scheduled_at >= today_start, Meeting.scheduled_at < today_end)
    elif time_filter == "tomorrow":
        q = q.filter(Meeting.scheduled_at >= today_end, Meeting.scheduled_at < tomorrow_end)
    elif time_filter == "this_week":
        q = q.filter(Meeting.scheduled_at >= today_start, Meeting.scheduled_at < week_end)
    elif time_filter == "past":
        q = q.filter(Meeting.scheduled_at < now).order_by(desc(Meeting.scheduled_at))
    else:  # upcoming
        q = q.filter(Meeting.scheduled_at >= now).order_by(Meeting.scheduled_at.asc())

    meetings = q.limit(limit).all()
    results = []
    for m in meetings:
        results.append({
            "id": m.id,
            "title": m.title,
            "organization_name": m.organization.name if m.organization else "None",
            "organization_id": m.organization_id,
            "contact_name": f"{m.primary_contact.first_name} {m.primary_contact.last_name}" if m.primary_contact else "None",
            "scheduled_at": m.scheduled_at.isoformat(),
            "meeting_type": m.meeting_type,
            "status": m.status,
            "agenda": m.agenda,
        })
    return results


def get_organization_map_data(
    db: Session,
    location_query: Optional[str] = None,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Get organizations with coordinates for map display."""
    from app.models.organization import Organization
    q = db.query(Organization).filter(
        Organization.is_deleted == False,
        Organization.latitude.isnot(None),
        Organization.longitude.isnot(None),
    )
    if location_query:
        q = q.filter(
            (Organization.city.ilike(f"%{location_query}%")) |
            (Organization.state.ilike(f"%{location_query}%")) |
            (Organization.country.ilike(f"%{location_query}%"))
        )
    orgs = q.limit(limit).all()
    return [
        {
            "id": o.id,
            "name": o.name,
            "latitude": o.latitude,
            "longitude": o.longitude,
            "organization_type": o.organization_type,
            "city": o.city,
            "country": o.country,
            "status": o.status,
            "priority": o.priority,
            "location_precision": o.location_precision,
            "location_source": o.location_source,
        }
        for o in orgs
    ]


def get_calendar_events(
    db: Session,
    user: Optional[User] = None,
    days_ahead: int = 7
) -> List[Dict[str, Any]]:
    """Get upcoming meetings as calendar events."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=days_ahead)
    meetings = db.query(Meeting).filter(
        Meeting.is_deleted == False,
        Meeting.scheduled_at >= now,
        Meeting.scheduled_at <= end,
        Meeting.status != "Cancelled",
    ).order_by(Meeting.scheduled_at).all()
    return [
        {
            "id": m.id,
            "title": m.title or f"Meeting with {m.organization.name if m.organization else 'Org'}",
            "start": m.scheduled_at.isoformat(),
            "organization_name": m.organization.name if m.organization else None,
            "status": m.status,
            "meeting_type": m.meeting_type,
            "location": m.location,
        }
        for m in meetings
    ]


def get_meeting_preparation_briefing(db: Session, meeting_identifier: Any = "next") -> Optional[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    meeting = None
    if isinstance(meeting_identifier, int) or (isinstance(meeting_identifier, str) and meeting_identifier.isdigit()):
        meeting = db.query(Meeting).filter(Meeting.id == int(meeting_identifier), Meeting.is_deleted == False).first()
    elif str(meeting_identifier).lower() in ["tomorrow", "next", "upcoming"]:
        meeting = db.query(Meeting).filter(
            Meeting.is_deleted == False,
            Meeting.scheduled_at >= today_start
        ).order_by(Meeting.scheduled_at.asc()).first()
    else:
        # Match by org name in meeting
        org = resolve_organization(db, meeting_identifier)
        if org:
            meeting = db.query(Meeting).filter(
                Meeting.organization_id == org.id,
                Meeting.is_deleted == False
            ).order_by(desc(Meeting.scheduled_at)).first()

    if not meeting:
        return None

    org = meeting.organization
    contact = meeting.primary_contact

    # Past meetings with same org
    past_meetings = []
    if org:
        pms = db.query(Meeting).filter(
            Meeting.organization_id == org.id,
            Meeting.id != meeting.id,
            Meeting.is_deleted == False
        ).order_by(desc(Meeting.scheduled_at)).limit(3).all()
        for pm in pms:
            past_meetings.append({
                "date": pm.scheduled_at.strftime("%b %d, %Y"),
                "title": pm.title,
                "notes": pm.notes,
                "decisions": pm.decisions,
            })

    # Active opportunities
    opps = []
    if org:
        ops = db.query(Opportunity).filter(Opportunity.organization_id == org.id, Opportunity.is_deleted == False).all()
        for op in ops:
            opps.append({
                "title": op.name,
                "stage": op.stage,
                "value": op.estimated_value,
                "next_action": op.next_action
            })

    # Showcase project recommendation
    recommended_projects = db.query(Project).filter(Project.is_deleted == False).limit(2).all()
    showcase_recs = [{
        "name": p.name,
        "category": p.category,
        "pitch": p.short_description or p.description[:150]
    } for p in recommended_projects]

    return {
        "meeting": {
            "id": meeting.id,
            "title": meeting.title,
            "scheduled_at": meeting.scheduled_at.strftime("%A, %b %d, %Y at %I:%M %p"),
            "meeting_type": meeting.meeting_type,
            "agenda": meeting.agenda or "General exploratory and showcase discussion",
        },
        "target_organization": {
            "id": org.id if org else None,
            "name": org.name if org else "Unlinked",
            "type": org.organization_type if org else None,
            "status": org.status if org else None,
            "priority": org.priority if org else None,
            "location": f"{org.city or ''}, {org.country or ''}".strip(", ") if org else None,
            "notes": org.notes if org else None,
        },
        "primary_contact": {
            "name": f"{contact.first_name} {contact.last_name}" if contact else "Not designated",
            "designation": contact.designation if contact else "N/A",
            "email": contact.email if contact else "N/A",
            "phone": contact.phone if contact else "N/A",
        },
        "past_meetings_history": past_meetings,
        "active_opportunities": opps,
        "recommended_showcase_projects": showcase_recs,
        "suggested_talking_points": [
            "Acknowledge recent digital transformation initiatives at target organization.",
            "Demonstrate platform workflows and operational intelligence modules.",
            "Discuss potential strategic integration / technology partnership timeline.",
            "Agree on follow-up action and commercial proposal timeline."
        ]
    }


# ─────────────────────────────────────────────────────────────
# 7. FOLLOW-UPS
# ─────────────────────────────────────────────────────────────

def search_followups(
    db: Session,
    user: Optional[User] = None,
    org_name: Optional[str] = None,
    status: str = "PENDING",
    is_overdue: Optional[bool] = None,
    limit: int = 15
) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    q = db.query(FollowUp).filter(FollowUp.is_deleted == False)

    if org_name:
        org = resolve_organization(db, org_name)
        if org:
            q = q.filter(FollowUp.organization_id == org.id)
    if status and status != "All":
        q = q.filter(FollowUp.status == status)
    if is_overdue is True:
        q = q.filter(FollowUp.status == FollowUpStatus.PENDING.value, FollowUp.due_at < today_start)

    followups = q.order_by(FollowUp.due_at.asc()).limit(limit).all()
    results = []
    for f in followups:
        results.append({
            "id": f.id,
            "title": f.title,
            "organization_name": f.organization.name if f.organization else "General",
            "organization_id": f.organization_id,
            "due_date": f.due_at.strftime("%b %d, %Y"),
            "is_overdue": f.due_at < today_start and f.status == FollowUpStatus.PENDING.value,
            "priority": f.priority,
            "status": f.status,
            "description": f.description,
        })
    return results


# ─────────────────────────────────────────────────────────────
# 8. COMMUNICATIONS & OUTREACH
# ─────────────────────────────────────────────────────────────

def search_communications(
    db: Session,
    org_name: Optional[str] = None,
    contact_name: Optional[str] = None,
    channel: Optional[str] = None,
    limit: int = 15
) -> List[Dict[str, Any]]:
    q = db.query(Communication).filter(Communication.is_deleted == False)

    if org_name:
        org = resolve_organization(db, org_name)
        if org:
            q = q.filter(Communication.organization_id == org.id)
    if contact_name:
        c = resolve_contact(db, contact_name)
        if c:
            q = q.filter(Communication.contact_id == c.id)
    if channel and channel != "All":
        q = q.filter(Communication.channel == channel)

    comms = q.order_by(desc(Communication.communication_date)).limit(limit).all()
    results = []
    for cm in comms:
        results.append({
            "id": cm.id,
            "organization_name": cm.organization.name if cm.organization else "General",
            "contact_name": f"{cm.contact.first_name} {cm.contact.last_name}" if cm.contact else "N/A",
            "channel": cm.channel,
            "subject": cm.subject,
            "date": cm.communication_date.strftime("%b %d, %Y %I:%M %p"),
            "content": cm.content or cm.summary,
        })
    return results


def prepare_outreach_draft_content(
    db: Session,
    user: User,
    org_identifier: Any,
    contact_identifier: Optional[Any] = None,
    template_type: str = "Introduction"
) -> Dict[str, Any]:
    org = resolve_organization(db, org_identifier)
    org_name = org.name if org else str(org_identifier)
    
    contact = resolve_contact(db, contact_identifier, org_id=org.id if org else None) if contact_identifier else None
    contact_name = f"{contact.first_name} {contact.last_name}" if contact else "Leadership Team"
    designation = contact.designation if contact else "Executive Leadership"

    # Gather research intelligence if available
    research_context = ""
    research_source = None
    matched_project = None

    # Check for research data on discovered organization
    disc_org = db.query(DiscoveredOrganization).filter(
        DiscoveredOrganization.name.ilike(f"%{org_name}%")
    ).first()
    if disc_org:
        from app.models.discovery import OrganizationResearchRecord
        research_rec = db.query(OrganizationResearchRecord).filter(
            OrganizationResearchRecord.discovered_org_id == disc_org.id
        ).order_by(desc(OrganizationResearchRecord.created_at)).first()
        if research_rec and research_rec.research_data:
            rd = research_rec.research_data
            if rd.get("what_they_do"):
                research_context += f"They specialize in {rd['what_they_do']}. "
            if rd.get("technology_initiatives"):
                research_context += f"Their technology initiatives include {rd['technology_initiatives']}. "
            if rd.get("digital_transformation"):
                research_context += f"Regarding digital transformation: {rd['digital_transformation']}. "
            if rd.get("ai_adoption"):
                research_context += f"AI adoption status: {rd['ai_adoption']}. "
            if rd.get("challenges"):
                research_context += f"Key challenges: {rd['challenges']}. "
            research_source = "Research Intelligence"

    # Check for research on CRM organization directly
    if not research_context and org:
        from app.models.discovery import OrganizationResearchRecord
        research_rec = db.query(OrganizationResearchRecord).filter(
            OrganizationResearchRecord.organization_name.ilike(f"%{org_name}%")
        ).order_by(desc(OrganizationResearchRecord.created_at)).first()
        if research_rec and research_rec.research_data:
            rd = research_rec.research_data
            if rd.get("what_they_do"):
                research_context += f"They specialize in {rd['what_they_do']}. "
            if rd.get("technology_initiatives"):
                research_context += f"Their technology initiatives include {rd['technology_initiatives']}. "
            research_source = "Research Intelligence"

    # Match showcase project
    if org:
        from app.services.discovery.project_matcher import match_projects
        match_input = {"description": research_context or (org.description or org_name)}
        matched = match_projects(db, match_input)
        if matched:
            matched_project = matched[0].project_name

    # Build personalized subject
    if research_context and org_name:
        subject = f"Strategic Partnership Opportunity — {org_name}"
    else:
        subject = f"Strategic Technology Partnership — {org_name} & ELLY Platform"

    # Build personalized body
    greeting = f"Dear {contact_name}," if contact else f"Dear {designation},"
    intro_line = (
        f"I hope this message finds you well."
        if not contact
        else f"I hope you're doing well, {contact.first_name}."
    )

    if research_context:
        body = (
            f"{greeting}\n\n"
            f"{intro_line}\n\n"
            f"We've been studying {org_name}'s work and believe our platform could "
            f"complement your current initiatives.\n\n"
            f"{research_context}\n"
        )
        if matched_project:
            body += f"\nWe believe our {matched_project} solution could directly address some of these needs.\n"
        body += (
            f"\nWould you have 15 minutes this week for a brief conversation to explore "
            f"how this could add value for {org_name}?\n\n"
            f"Warm regards,\n"
            f"{user.name}\n"
            f"Business Development Team"
        )
    else:
        body = (
            f"{greeting}\n\n"
            f"{intro_line}\n\n"
            f"I am reaching out from our Business Development team regarding our advanced technology platform. "
            f"We have been following {org_name}'s growth and believe our platform can "
            f"create strategic value in enhancing digital workflows and operational efficiency.\n\n"
            f"We would welcome the opportunity to schedule a brief 20-minute exploratory conversation "
            f"to showcase our platform and discuss potential partnership opportunities.\n\n"
            f"Would you be available for a brief virtual call this coming week?\n\n"
            f"Warm regards,\n"
            f"{user.name}\n"
            f"Business Development Team"
        )

    return {
        "organization_name": org_name,
        "organization_id": org.id if org else None,
        "contact_name": contact_name,
        "contact_id": contact.id if contact else None,
        "subject": subject,
        "body": body,
        "channel": "EMAIL",
        "research_used": bool(research_context),
        "research_source": research_source,
        "matched_project": matched_project,
    }


# ─────────────────────────────────────────────────────────────
# 9. PARTNERSHIPS & SHOWCASE
# ─────────────────────────────────────────────────────────────

def search_partnerships(
    db: Session,
    org_name: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 10
) -> List[Dict[str, Any]]:
    q = db.query(Partnership).filter(Partnership.is_deleted == False)
    if org_name:
        org = resolve_organization(db, org_name)
        if org:
            q = q.filter(Partnership.organization_id == org.id)
    if status and status != "All":
        q = q.filter(Partnership.status == status)

    partnerships = q.order_by(desc(Partnership.created_at)).limit(limit).all()
    results = []
    for p in partnerships:
        results.append({
            "id": p.id,
            "name": p.name,
            "organization_name": p.organization.name if p.organization else "None",
            "organization_id": p.organization_id,
            "partnership_type": p.partnership_type,
            "status": p.status,
            "priority": p.priority,
            "owner": p.owner.name if p.owner else "Unassigned",
        })
    return results


def search_projects(db: Session, keyword: Optional[str] = None, category: Optional[str] = None) -> List[Dict[str, Any]]:
    q = db.query(Project).filter(Project.is_deleted == False)
    if keyword:
        q = q.filter(or_(Project.name.ilike(f"%{keyword}%"), Project.description.ilike(f"%{keyword}%")))
    if category and category != "All":
        q = q.filter(Project.category.ilike(f"%{category}%"))

    projects = q.all()
    return [{
        "id": p.id,
        "title": p.name,
        "slug": p.slug,
        "category": p.category,
        "status": p.status,
        "short_description": p.short_description,
    } for p in projects]


# ─────────────────────────────────────────────────────────────
# 10. BD TEAM & ADMIN
# ─────────────────────────────────────────────────────────────

def get_team_members(db: Session) -> List[Dict[str, Any]]:
    users = db.query(User).filter(User.is_active == True).all()
    results = []
    for u in users:
        orgs_count = db.query(Organization).filter(Organization.owner_id == u.id, Organization.is_deleted == False).count()
        opps_count = db.query(Opportunity).filter(Opportunity.owner_id == u.id, Opportunity.is_deleted == False).count()
        results.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "assigned_organizations": orgs_count,
            "assigned_opportunities": opps_count,
        })
    return results


def get_system_audit_summary(db: Session, limit: int = 15) -> List[Dict[str, Any]]:
    logs = db.query(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit).all()
    return [{
        "id": l.id,
        "action": l.action,
        "resource_type": l.resource_type,
        "resource_id": l.resource_id,
        "user_email": l.user_email,
        "timestamp": l.timestamp.strftime("%b %d, %Y %I:%M %p")
    } for l in logs]


# ─────────────────────────────────────────────────────────────
# 11. PHASE 17 EXTENDED TOOLS: CUSTOMERS, DEMOS, PROPOSALS, NEGOTIATIONS, TASKS
# ─────────────────────────────────────────────────────────────

def search_customers(db: Session, status: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    from app.models.customer import Customer
    q = db.query(Customer).filter(Customer.is_deleted == False)
    if status:
        q = q.filter(Customer.status == status)
    custs = q.order_by(desc(Customer.updated_at)).limit(limit).all()
    return [{
        "id": c.id,
        "organization_name": c.organization.name if c.organization else "Unknown",
        "organization_id": c.organization_id,
        "status": c.status,
        "account_health": c.account_health,
        "contract_value": c.contract_value or 0.0,
        "currency": c.currency or "USD",
        "start_date": c.start_date.strftime("%b %d, %Y") if c.start_date else None,
        "renewal_date": c.renewal_date.strftime("%b %d, %Y") if c.renewal_date else None,
    } for c in custs]


def search_demos(db: Session, status: Optional[str] = None, outcome: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    from app.models.demo import Demo
    q = db.query(Demo).filter(Demo.is_deleted == False)
    if status:
        q = q.filter(Demo.status == status)
    if outcome:
        q = q.filter(Demo.outcome == outcome)
    demos = q.order_by(desc(Demo.scheduled_at)).limit(limit).all()
    return [{
        "id": d.id,
        "title": d.title,
        "organization_name": d.organization.name if d.organization else "Unknown",
        "organization_id": d.organization_id,
        "status": d.status,
        "outcome": d.outcome,
        "scheduled_at": d.scheduled_at.strftime("%b %d, %Y %I:%M %p") if d.scheduled_at else None,
        "customer_requirements": d.customer_requirements,
        "next_action": d.next_action,
    } for d in demos]


def search_proposals(db: Session, status: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    from app.models.proposal import Proposal
    q = db.query(Proposal).filter(Proposal.is_deleted == False)
    if status:
        q = q.filter(Proposal.status == status)
    props = q.order_by(desc(Proposal.date_created)).limit(limit).all()
    return [{
        "id": p.id,
        "title": p.title,
        "organization_name": p.organization.name if p.organization else "Unknown",
        "organization_id": p.organization_id,
        "version": p.version,
        "value": p.value or 0.0,
        "status": p.status,
        "date_created": p.date_created.strftime("%b %d, %Y"),
    } for p in props]


def search_negotiations(db: Session, status: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    from app.models.negotiation import Negotiation
    q = db.query(Negotiation).filter(Negotiation.is_deleted == False)
    if status:
        q = q.filter(Negotiation.status == status)
    negs = q.order_by(desc(Negotiation.updated_at)).limit(limit).all()
    return [{
        "id": n.id,
        "title": n.title,
        "organization_name": n.organization.name if n.organization else "Unknown",
        "organization_id": n.organization_id,
        "commercial_value": n.commercial_value or 0.0,
        "status": n.status,
        "open_issues": n.open_issues,
        "risks": n.risks,
        "next_action": n.next_action,
    } for n in negs]


def search_tasks(db: Session, status: Optional[str] = None, priority: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
    from app.models.task import BDTask
    q = db.query(BDTask).filter(BDTask.is_deleted == False)
    if status:
        q = q.filter(BDTask.status == status)
    if priority:
        q = q.filter(BDTask.priority == priority)
    tasks = q.order_by(desc(BDTask.created_at)).limit(limit).all()
    return [{
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "status": t.status,
        "priority": t.priority,
        "due_date": t.due_date.strftime("%b %d, %Y") if t.due_date else None,
        "entity_type": t.entity_type,
        "entity_id": t.entity_id,
    } for t in tasks]


def search_knowledge_base(db: Session, query: str, limit: int = 5) -> List[Dict[str, Any]]:
    from app.services import kb_service
    return kb_service.search(db, query=query, limit=limit)


def get_my_notifications(db: Session, user: Any, unread_only: bool = True, limit: int = 20) -> List[Dict[str, Any]]:
    from app.services import notification_service
    notes = notification_service.list_for_user(db, user_id=user.id, unread_only=unread_only, limit=limit)
    return [{
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "link": n.link,
        "is_read": n.is_read,
        "created_at": n.created_at.strftime("%b %d, %Y %H:%M") if n.created_at else None,
    } for n in notes]


def get_active_signals(db: Session, limit: int = 20) -> List[Dict[str, Any]]:
    from app.services import signal_service
    signals = signal_service.list_active(db, limit=limit)
    return [{
        "id": s.id,
        "organization_id": s.organization_id,
        "contact_id": s.contact_id,
        "signal_type": s.signal_type,
        "description": s.description,
        "score": s.score,
        "created_at": s.created_at.strftime("%b %d, %Y") if s.created_at else None,
    } for s in signals]


def get_organization_global_timeline(db: Session, org_identifier: Any) -> List[Dict[str, Any]]:
    org = resolve_organization(db, org_identifier) if not isinstance(org_identifier, int) else db.query(Organization).filter(Organization.id == org_identifier, Organization.is_deleted == False).first()
    if not org:
        return []

    timeline = []

    # 1. Communications & Calls
    comms = db.query(Communication).filter(Communication.organization_id == org.id, Communication.is_deleted == False).all()
    for c in comms:
        timeline.append({
            "type": "call" if c.channel == "Phone" else "communication",
            "date": c.communication_date,
            "title": c.subject,
            "summary": c.summary or c.content,
            "badge": c.channel,
        })

    # 2. Meetings
    meets = db.query(Meeting).filter(Meeting.organization_id == org.id, Meeting.is_deleted == False).all()
    for m in meets:
        timeline.append({
            "type": "meeting",
            "date": m.scheduled_at,
            "title": f"Meeting: {m.title}",
            "summary": f"Type: {m.meeting_type} · Status: {m.status}",
            "badge": m.meeting_type,
        })

    # 3. Demos
    from app.models.demo import Demo
    demos = db.query(Demo).filter(Demo.organization_id == org.id, Demo.is_deleted == False).all()
    for d in demos:
        timeline.append({
            "type": "demo",
            "date": d.scheduled_at,
            "title": f"Demo: {d.title}",
            "summary": f"Outcome: {d.outcome} · Notes: {d.demo_notes or 'N/A'}",
            "badge": "Demo",
        })

    # 4. Proposals
    from app.models.proposal import Proposal
    props = db.query(Proposal).filter(Proposal.organization_id == org.id, Proposal.is_deleted == False).all()
    for p in props:
        timeline.append({
            "type": "proposal",
            "date": p.date_created,
            "title": f"Proposal: {p.title} ({p.version})",
            "summary": f"Value: ₹{p.value or 0:,.2f} · Status: {p.status}",
            "badge": "Proposal",
        })

    # 5. Negotiations
    from app.models.negotiation import Negotiation
    negs = db.query(Negotiation).filter(Negotiation.organization_id == org.id, Negotiation.is_deleted == False).all()
    for n in negs:
        timeline.append({
            "type": "negotiation",
            "date": n.created_at,
            "title": f"Negotiation: {n.title}",
            "summary": f"Value: ₹{n.commercial_value or 0:,.2f} · Status: {n.status}",
            "badge": "Negotiation",
        })

    # 6. Customer milestones
    from app.models.customer import Customer
    cust = db.query(Customer).filter(Customer.organization_id == org.id, Customer.is_deleted == False).first()
    if cust:
        timeline.append({
            "type": "customer",
            "date": cust.start_date,
            "title": f"Customer Account Activated",
            "summary": f"Contract: ₹{cust.contract_value or 0:,.2f} · Health: {cust.account_health}",
            "badge": "Customer",
        })

    # Sort descending by date
    timeline.sort(key=lambda x: x["date"], reverse=True)
    return [{
        "type": item["type"],
        "date_formatted": item["date"].strftime("%b %d, %Y %I:%M %p") if item["date"] else "N/A",
        "title": item["title"],
        "summary": item["summary"],
        "badge": item["badge"],
    } for item in timeline]


def get_funnel_reports(db: Session) -> Dict[str, Any]:
    """Compute comprehensive commercial funnel metrics across all 10 stages."""
    total_orgs = db.query(Organization).filter(Organization.is_deleted == False).count()

    funnel_stages = [
        "New", "Contacted", "Responded", "Meeting", "Demo",
        "Discussion", "Proposal", "Negotiation", "Partnership", "Customer",
    ]

    stage_metrics = []
    for st in funnel_stages:
        match_statuses = [st]
        if st == "New":
            match_statuses.append("Potential")
        elif st == "Responded":
            match_statuses.extend(["Connected", "Interested"])

        cnt = db.query(Organization).filter(
            Organization.status.in_(match_statuses), Organization.is_deleted == False
        ).count()
        val = db.query(func.sum(Opportunity.estimated_value)).filter(
            Opportunity.stage.in_(match_statuses), Opportunity.is_deleted == False
        ).scalar() or 0.0

        stage_metrics.append({
            "stage": st,
            "count": cnt,
            "value": float(val),
            "percentage": round((cnt / total_orgs * 100) if total_orgs else 0, 1),
        })

    pipe_val = db.query(func.sum(Opportunity.estimated_value)).filter(
        Opportunity.is_deleted == False,
        Opportunity.stage.notin_([OpportunityStage.PARTNERSHIP.value, OpportunityStage.CUSTOMER.value]),
    ).scalar() or 0.0

    total_proposals = db.query(Proposal).filter(Proposal.is_deleted == False).count()
    active_proposals = db.query(Proposal).filter(
        Proposal.status.in_(["Sent", "Under Review"]), Proposal.is_deleted == False
    ).count()
    total_demos = db.query(Demo).filter(Demo.is_deleted == False).count()
    total_negotiations = db.query(Negotiation).filter(Negotiation.is_deleted == False).count()
    total_partnerships = db.query(Partnership).filter(
        Partnership.status == PartnershipStatus.ACTIVE.value, Partnership.is_deleted == False
    ).count()
    total_customers = db.query(Customer).filter(
        Customer.status == CustomerStatus.ACTIVE.value, Customer.is_deleted == False
    ).count()

    return {
        "total_organizations": total_orgs,
        "pipeline_value": float(pipe_val),
        "funnel_stages": stage_metrics,
        "summary": {
            "total_proposals": total_proposals,
            "active_proposals": active_proposals,
            "total_demos": total_demos,
            "total_negotiations": total_negotiations,
            "total_partnerships": total_partnerships,
            "total_customers": total_customers,
        },
    }


# ─────────────────────────────────────────────────────────────
# 18. WEB DISCOVERY (Tavily/Serper)
# ─────────────────────────────────────────────────────────────

def discover_web(
    db: Session,
    keyword: str = "",
    location: str = "",
    organization_type: str = "",
    product_description: str = "",
    target_icp: str = "",
    limit: int = 5,
    user: Any = None,
) -> List[Dict[str, Any]]:
    """Search the web for organizations using Tavily/Serper providers. Saves to CRM."""
    from app.services.discovery_providers.tavily_provider import TavilySearchProvider
    from app.services.discovery_providers.serper_provider import SerperSearchProvider
    from app.services.discovery_providers.directory_provider import DirectoryDiscoveryProvider
    from app.models.discovery import DiscoveredOrganization, DiscoveryStatus
    from app.models.organization import Organization, ConnectionStatus, PriorityLevel, OrganizationType
    from app.services.discovery_engine import check_organization_duplicate

    # Try Tavily first, then Serper, then Directory (fast fallback)
    providers = [
        TavilySearchProvider(),
        SerperSearchProvider(),
        DirectoryDiscoveryProvider(),
    ]

    results = []
    for provider in providers:
        try:
            provider_results, _ = provider.search_organizations(
                keyword=keyword or None,
                location=location or None,
                organization_type=organization_type or None,
                product_description=product_description or None,
                target_icp=target_icp or None,
                limit=limit,
            )
            if provider_results:
                results = provider_results
                break
        except Exception:
            continue

    # Save to DB and promote to organizations
    saved_count = 0
    for o in results:
        name = o.get("name", "").strip()
        if not name or name == "Unknown":
            continue

        existing = db.query(DiscoveredOrganization).filter(
            DiscoveredOrganization.name == name
        ).first()
        if existing:
            continue

        disc_org = DiscoveredOrganization(
            name=name,
            organization_type=o.get("organization_type", "Unknown"),
            country=o.get("country", ""),
            city=o.get("city", ""),
            website=o.get("website", ""),
            description=o.get("description", ""),
            source_type=o.get("source_type", "search"),
            source_name=o.get("source_name", "Web Search"),
            source_url=o.get("source_url", ""),
            status=DiscoveryStatus.DISCOVERED.value,
            potential_fit=o.get("fit_level", "Low"),
            potential_fit_score=65,
            qualification_reason="Web discovered lead",
        )
        db.add(disc_org)
        db.flush()

        is_dup, existing_id, _ = check_organization_duplicate(db, name, o.get("website"))
        if is_dup and existing_id:
            disc_org.organization_id = existing_id
            disc_org.status = DiscoveryStatus.ADDED.value
        else:
            org_type_val = o.get("organization_type", "Unknown")
            valid_types = [e.value for e in OrganizationType]
            if org_type_val not in valid_types:
                org_type_val = "Technology Company"

            org = Organization(
                name=name,
                organization_type=org_type_val,
                country=o.get("country", "Unknown"),
                city=o.get("city"),
                website=o.get("website", ""),
                description=o.get("description", ""),
                status=ConnectionStatus.POTENTIAL.value,
                priority=PriorityLevel.MEDIUM.value,
                notes=f"Web discovered via {o.get('source_name', 'search')}.",
            )
            db.add(org)
            db.flush()
            disc_org.organization_id = org.id
            disc_org.status = DiscoveryStatus.ADDED.value
            saved_count += 1

        # Auto-discover contacts for this org
        try:
            from app.services.discovery.decision_maker import discover_decision_makers
            from app.models.contact import Contact
            from app.core.config import settings as _cfg

            org_id = disc_org.organization_id
            if org_id:
                contacts = discover_decision_makers(
                    db=db,
                    organization_name=name,
                    organization_type=o.get("organization_type", ""),
                    website=o.get("website", ""),
                    limit=5,
                )
                for c in contacts:
                    full_name = c.get("name", "") or c.get("full_name", "")
                    if not full_name or len(full_name.strip()) < 2:
                        continue
                    existing_c = db.query(Contact).filter(
                        Contact.organization_id == org_id,
                        Contact.first_name == full_name.split()[0],
                    ).first()
                    if existing_c:
                        continue

                    # Enrich contact with email, phone, LinkedIn via web search
                    email = c.get("email", "")
                    phone = c.get("phone", "")
                    linkedin = c.get("linkedin_url", "")

                    if not email or not phone or not linkedin:
                        try:
                            import httpx
                            domain = o.get("website", "").replace("https://", "").replace("http://", "").split("/")[0]
                            query = f"{full_name} {name} email phone linkedin"
                            enriched = False

                            if _cfg.TAVILY_API_KEY:
                                with httpx.Client(timeout=10.0) as client:
                                    resp = client.post("https://api.tavily.com/search",
                                        json={"api_key": _cfg.TAVILY_API_KEY, "query": query, "max_results": 5})
                                    if resp.status_code == 200:
                                        for r in resp.json().get("results", []):
                                            text = r.get("content", "") + " " + r.get("url", "")
                                            if not email:
                                                emails_found = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
                                                for e in emails_found:
                                                    if domain and domain.split(".")[0] in e:
                                                        email = e
                                                        break
                                                if not email and emails_found:
                                                    email = emails_found[0]
                                            if not linkedin:
                                                li_match = re.search(r"linkedin\.com/in/[a-zA-Z0-9_-]+", text)
                                                if li_match:
                                                    linkedin = "https://www." + li_match.group(0)
                                            if not phone:
                                                phones_found = re.findall(r"(?:\+?\d{1,3}[\s\-]?)?(?:\(\d{2,4}\)[\s\-]?)?\d{2,4}[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}", text)
                                                for p in phones_found:
                                                    if len(re.sub(r'\D', '', p)) >= 8:
                                                        phone = p.strip()
                                                        break
                                            if email and phone and linkedin:
                                                enriched = True
                                                break

                            if not enriched and _cfg.SERPER_API_KEY and (not email or not phone or not linkedin):
                                with httpx.Client(timeout=10.0) as client:
                                    resp = client.post("https://google.serper.dev/search",
                                        headers={"X-API-KEY": _cfg.SERPER_API_KEY, "Content-Type": "application/json"},
                                        json={"q": query, "num": 5})
                                    if resp.status_code == 200:
                                        for r in resp.json().get("organic", []):
                                            text = r.get("snippet", "") + " " + r.get("link", "")
                                            if not email:
                                                emails_found = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)
                                                for e in emails_found:
                                                    if domain and domain.split(".")[0] in e:
                                                        email = e
                                                        break
                                                if not email and emails_found:
                                                    email = emails_found[0]
                                            if not linkedin:
                                                li_match = re.search(r"linkedin\.com/in/[a-zA-Z0-9_-]+", text)
                                                if li_match:
                                                    linkedin = "https://www." + li_match.group(0)
                                            if not phone:
                                                phones_found = re.findall(r"(?:\+?\d{1,3}[\s\-]?)?(?:\(\d{2,4}\)[\s\-]?)?\d{2,4}[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}", text)
                                                for p in phones_found:
                                                    if len(re.sub(r'\D', '', p)) >= 8:
                                                        phone = p.strip()
                                                        break
                        except Exception:
                            pass

                    # Skip contacts with no way to reach them
                    if not email and not phone and not linkedin:
                        continue

                    parts = full_name.strip().split(maxsplit=1)
                    new_contact = Contact(
                        organization_id=org_id,
                        first_name=parts[0],
                        last_name=parts[1] if len(parts) > 1 else "",
                        designation=c.get("role", "") or c.get("job_title", ""),
                        department=c.get("department", "Executive Management"),
                        email=email,
                        phone=phone,
                        linkedin_url=linkedin,
                        is_decision_maker=True,
                        connection_status="Not Contacted",
                        owner_id=user.id if user else None,
                    )
                    db.add(new_contact)
        except Exception as e:
            logger.warning("Contact discovery failed for %s: %s", name, str(e)[:100])

    db.commit()
    return results


# ─────────────────────────────────────────────────────────────
# 19. PHASE 19 — RESEARCH, QUALIFY, BRIEF, MATCH
# ─────────────────────────────────────────────────────────────

def research_organization_tool(
    db: Session,
    discovered_org_id: int,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """Research a single discovered organization via ScrapeGraphAI."""
    from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
    orch = DiscoveryOrchestrator(db)
    result = orch.research_single(discovered_org_id)
    if result is None:
        return {"error": f"Discovered organization {discovered_org_id} not found"}
    return result


def qualify_organization_tool(
    db: Session,
    discovered_org_id: int,
) -> Dict[str, Any]:
    """Re-qualify a discovered organization with explainable scoring."""
    from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
    orch = DiscoveryOrchestrator(db)
    result = orch.qualify_single(discovered_org_id)
    if result is None:
        return {"error": f"Discovered organization {discovered_org_id} not found"}
    return result


def get_research_brief(
    db: Session,
    discovered_org_id: int,
) -> Dict[str, Any]:
    """Generate an Account Intelligence Brief for a discovered organization."""
    from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
    orch = DiscoveryOrchestrator(db)
    result = orch.get_brief(discovered_org_id)
    if result is None:
        return {"error": f"Discovered organization {discovered_org_id} not found"}
    return result


def discover_decision_makers_tool(
    db: Session,
    discovered_org_id: int,
    roles: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Discover decision-makers for a discovered organization."""
    from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
    orch = DiscoveryOrchestrator(db)
    role_list = [r.strip() for r in roles.split(",")] if roles else None
    return orch.discover_decision_makers(discovered_org_id, roles=role_list)


def discover_qualified(
    db: Session,
    keyword: str = "",
    location: str = "",
    organization_type: str = "",
    product_description: str = "",
    target_icp: str = "",
    discovery_objective: str = "",
    limit: int = 10,
    research: bool = True,
    user: Any = None,
) -> Dict[str, Any]:
    """Full discovery pipeline: search → dedup → research → qualify → save to CRM."""
    from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator
    from app.models.discovery import DiscoveredOrganization, DiscoveredContact, DiscoveryStatus
    from app.models.organization import Organization, ConnectionStatus, PriorityLevel, OrganizationType
    from app.services.discovery_engine import check_organization_duplicate

    orch = DiscoveryOrchestrator(db)
    result = orch.discover(
        keyword=keyword,
        location=location,
        organization_type=organization_type,
        product_description=product_description,
        target_icp=target_icp,
        discovery_objective=discovery_objective,
        limit=limit,
        research=research,
    )

    # Save discovered orgs to DB and auto-promote to organizations
    orgs = result.get("organizations", [])
    saved_count = 0
    newly_created_orgs = []
    for o in orgs:
        name = o.get("name", "").strip()
        if not name or name == "Unknown":
            continue

        # Check if already discovered (by name)
        existing = db.query(DiscoveredOrganization).filter(
            DiscoveredOrganization.name == name
        ).first()
        if existing:
            continue

        # Create DiscoveredOrganization
        disc_org = DiscoveredOrganization(
            name=name,
            organization_type=o.get("organization_type", "Unknown"),
            country=o.get("country", ""),
            state=o.get("state", ""),
            city=o.get("city", ""),
            address=o.get("address", ""),
            website=o.get("website", ""),
            email=o.get("email", ""),
            phone=o.get("phone", ""),
            description=o.get("description", ""),
            product_description=product_description,
            target_icp=target_icp,
            discovery_objective=discovery_objective,
            source_type=o.get("source_type", "search"),
            source_name=o.get("source_name", "Multi-Source"),
            source_url=o.get("source_url", ""),
            status=DiscoveryStatus.DISCOVERED.value,
            potential_fit=o.get("potential_fit", "Low"),
            potential_fit_score=o.get("potential_fit_score", 0),
            qualification_reason=o.get("qualification_reason", ""),
        )
        db.add(disc_org)
        db.flush()

        # Auto-promote to organizations table
        is_dup, existing_id, _ = check_organization_duplicate(db, name, o.get("website"))
        if is_dup and existing_id:
            disc_org.organization_id = existing_id
            disc_org.status = DiscoveryStatus.ADDED.value
        else:
            # Map org type
            org_type_val = o.get("organization_type", "Unknown")
            valid_types = [e.value for e in OrganizationType]
            if org_type_val not in valid_types:
                org_type_val = "Technology Company"

            # Map priority
            fit = o.get("potential_fit", "Low")
            priority_val = PriorityLevel.LOW.value
            if fit == "High":
                priority_val = PriorityLevel.HIGH.value
            elif fit == "Medium":
                priority_val = PriorityLevel.MEDIUM.value

            org = Organization(
                name=name,
                organization_type=org_type_val,
                country=o.get("country", "Unknown"),
                state=o.get("state"),
                city=o.get("city"),
                address=o.get("address"),
                website=o.get("website", ""),
                phone=o.get("phone"),
                email=o.get("email"),
                description=o.get("description", ""),
                status=ConnectionStatus.POTENTIAL.value,
                priority=priority_val,
                notes=f"Sourced via AI Discovery. Fit: {fit} ({o.get('potential_fit_score', 0)}/100). {o.get('qualification_reason', '')}",
            )
            db.add(org)
            db.flush()
            disc_org.organization_id = org.id
            disc_org.status = DiscoveryStatus.ADDED.value
            saved_count += 1
            newly_created_orgs.append(org)

    db.commit()

    if saved_count > 0:
        result["saved_to_crm"] = saved_count
        result["message"] = f"{saved_count} new organizations added to CRM."
        try:
            from app.services.google_sheets_service import sync_organization
            for created_org in newly_created_orgs:
                sync_organization(created_org)
        except Exception:
            pass

    return result


def get_discovery_analytics_tool(db: Session) -> Dict[str, Any]:
    """Get discovery intelligence analytics — source performance, conversion rates."""
    from app.services.discovery.analytics import get_discovery_analytics
    return get_discovery_analytics(db)


# ─────────────────────────────────────────────────────────────
# 20. BETTERCONTACT ENRICHMENT
# ─────────────────────────────────────────────────────────────

def enrich_contacts_tool(
    db: Session,
    organization: str = "",
    contacts_json: str = "[]",
    domain: str = "",
) -> Dict[str, Any]:
    """Enrich contacts at an organization using BetterContact."""
    import json
    from app.services.enrichment.bettercontact_adapter import get_bettercontact_adapter

    adapter = get_bettercontact_adapter()
    if not adapter.is_available:
        return {"error": "BetterContact not configured. Set BETTERCONTACT_API_KEY."}

    contacts = json.loads(contacts_json) if isinstance(contacts_json, str) else contacts_json
    if not contacts:
        return {"error": "No contacts provided"}

    result = adapter.enrich_organization_contacts(organization, contacts, domain)
    return result.to_dict()


# ─────────────────────────────────────────────────────────────
# 21. PROVIDER HEALTH
# ─────────────────────────────────────────────────────────────

def get_provider_health_tool(db: Session) -> Dict[str, Any]:
    """Get health status for all external providers (no API keys exposed)."""
    from app.services.discovery.provider_health import ProviderHealthTracker
    tracker = ProviderHealthTracker.get_instance()
    return tracker.get_all_status()


# ─────────────────────────────────────────────────────────────
# 22. CAMPAIGNS & MULTI-STEP OUTREACH SEQUENCES
# ─────────────────────────────────────────────────────────────

def search_campaigns_tool(
    db: Session,
    name: Optional[str] = None,
    status: Optional[str] = None,
    industry: Optional[str] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """List or search multi-step outreach campaigns."""
    from app.models.campaign import Campaign, CampaignContact, CampaignContactStatus
    q = db.query(Campaign)
    if name:
        q = q.filter(Campaign.name.ilike(f"%{name}%"))
    if status and status != "All":
        q = q.filter(Campaign.status == status)
    if industry and industry != "All":
        q = q.filter(Campaign.target_industry == industry)
    
    campaigns = q.order_by(desc(Campaign.created_at)).limit(limit).all()
    results = []
    for c in campaigns:
        contacts = db.query(CampaignContact).filter(CampaignContact.campaign_id == c.id).all()
        sent = sum(1 for cc in contacts if cc.status in [CampaignContactStatus.SENT.value, CampaignContactStatus.REPLIED.value, CampaignContactStatus.COMPLETED.value])
        replied = sum(1 for cc in contacts if cc.status == CampaignContactStatus.REPLIED.value)
        results.append({
            "id": c.id,
            "name": c.name,
            "status": c.status,
            "industry": c.target_industry,
            "sender_email": c.sender_email,
            "steps_count": len(c.sequence_steps),
            "enrolled_contacts": len(contacts),
            "emails_sent": sent,
            "replies": replied,
        })
    return results


def get_campaign_replies_tool(db: Session) -> List[Dict[str, Any]]:
    """Get all contacts who replied to outreach campaigns."""
    from app.models.campaign import CampaignContact, CampaignContactStatus
    from app.models.contact import Contact
    from app.models.organization import Organization
    
    replied_ccs = (
        db.query(CampaignContact)
        .filter(CampaignContact.status == CampaignContactStatus.REPLIED.value)
        .order_by(desc(CampaignContact.last_action_at))
        .limit(15)
        .all()
    )
    results = []
    for cc in replied_ccs:
        c = db.query(Contact).filter(Contact.id == cc.contact_id).first()
        org = db.query(Organization).filter(Organization.id == cc.organization_id).first()
        results.append({
            "contact_id": cc.contact_id,
            "contact_name": c.full_name if c else "Unknown",
            "contact_role": c.designation if c else "Executive",
            "organization_name": org.name if org else "Unknown",
            "organization_id": cc.organization_id,
            "campaign_id": cc.campaign_id,
            "campaign_name": cc.campaign.name if cc.campaign else "Outreach Campaign",
            "replied_at": cc.last_action_at.isoformat() if cc.last_action_at else None,
        })
    return results


def get_next_best_action_tool(db: Session, user: Optional[Any] = None) -> Dict[str, Any]:
    """Get the AI calculated single highest-priority Next Best Action across the commercial funnel."""
    from app.services.daily_priorities import compute_next_best_action
    return compute_next_best_action(db, user)


def get_campaign_roi_tool(db: Session, campaign_id: int) -> Dict[str, Any]:
    """Get the full commercial ROI funnel and conversion statistics for a campaign."""
    from app.services.campaign_service import CampaignService
    return CampaignService.get_campaign_roi_funnel(db, campaign_id)


# ─────────────────────────────────────────────────────────────
# 23. AUTONOMOUS BD AGENT EXECUTION TOOLS
# ─────────────────────────────────────────────────────────────

def recommend_showcase_deck(
    db: Session,
    organization_id: int,
    user: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Examine an organization's industry and requirements, and recommend the best
    showcase project deck or presentation to share.
    """
    from app.models.organization import Organization
    from app.models.project import Project

    org = db.query(Organization).filter(
        Organization.id == organization_id,
        Organization.is_deleted == False,
    ).first()
    if not org:
        return {"error": f"Organization with ID {organization_id} not found."}

    projects = db.query(Project).filter(
        Project.is_deleted == False,
    ).all()

    if not projects:
        return {
            "organization_name": org.name,
            "recommended_deck": None,
            "message": "No showcase projects or presentations currently registered in the database."
        }

    # Score relevance
    scored_projects = []
    org_text = f"{org.name} {org.organization_type or ''} {org.description or ''}".lower()

    for p in projects:
        score = 0
        p_category = (p.category or "").lower()
        p_desc = f"{p.name} {p.short_description or ''} {p.description or ''}".lower()

        # Category match
        if p_category in org_text or any(word in p_desc for word in org_text.split() if len(word) > 4):
            score += 3
        if p.presentation_url:
            score += 2
        if p.demo_url:
            score += 1
        if p.is_featured:
            score += 1

        scored_projects.append((score, p))

    scored_projects.sort(key=lambda x: x[0], reverse=True)
    best_match = scored_projects[0][1]

    pitch_summary = (
        f"Recommended for {org.name} ({org.organization_type or 'Partner'}): "
        f"'{best_match.name}' directly addresses workflows in {best_match.category}. "
        f"Key value: {best_match.short_description}"
    )

    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "recommended_project": {
            "id": best_match.id,
            "name": best_match.name,
            "category": best_match.category,
            "short_description": best_match.short_description,
            "demo_url": best_match.demo_url,
            "presentation_url": best_match.presentation_url,
            "has_presentation": bool(best_match.presentation_url),
        },
        "pitch_summary": pitch_summary,
        "other_candidates": [
            {
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "presentation_url": p.presentation_url,
            }
            for _, p in scored_projects[1:4]
        ],
    }


def draft_outreach_email(
    db: Session,
    organization_id: int,
    contact_id: Optional[int] = None,
    template_type: str = "introduction",
    pitch_angle: Optional[str] = None,
    user: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Generate a tailored cold or follow-up outreach email draft using organization
    intelligence, contact details, and relevant showcase project assets.
    """
    from app.models.organization import Organization
    from app.models.contact import Contact

    org = db.query(Organization).filter(
        Organization.id == organization_id,
        Organization.is_deleted == False,
    ).first()
    if not org:
        return {"error": f"Organization {organization_id} not found."}

    # Resolve contact
    contact = None
    if contact_id:
        contact = db.query(Contact).filter(
            Contact.id == contact_id,
            Contact.organization_id == organization_id,
            Contact.is_deleted == False,
        ).first()

    if not contact:
        # Pick decision maker or first contact
        contacts = db.query(Contact).filter(
            Contact.organization_id == organization_id,
            Contact.is_deleted == False,
        ).order_by(desc(Contact.is_decision_maker)).all()
        if contacts:
            contact = contacts[0]

    recipient_name = contact.full_name if contact else f"{org.name} Leadership"
    first_name = recipient_name.split()[0]
    recipient_email = contact.email if (contact and contact.email) else ""
    recipient_role = contact.designation if contact else "Decision Maker"

    # Find recommended deck
    deck_rec = recommend_showcase_deck(db, organization_id)
    project_name = "our Technology Intelligence Platform"
    deck_url = ""
    if deck_rec.get("recommended_project"):
        proj = deck_rec["recommended_project"]
        project_name = proj["name"]
        deck_url = proj.get("presentation_url") or proj.get("demo_url") or ""

    if template_type.lower() in ("follow_up", "followup"):
        subject = f"Following up: Strategic partnership between {org.name} & Electra"
        deck_mention = f"\nI've also attached our deck overview for {project_name}: {deck_url}" if deck_url else ""
        body = (
            f"Hi {first_name},\n\n"
            f"Following up on our earlier communications regarding {org.name}'s ongoing initiatives.\n\n"
            f"{pitch_angle or f'We wanted to share how {project_name} can streamline operational outcomes for your team.'}"
            f"{deck_mention}\n\n"
            f"Would you be open for a brief 15-minute sync later this week to discuss?\n\n"
            f"Best regards,\n"
            f"{getattr(user, 'full_name', 'Business Development Team') if user else 'Business Development Team'}\n"
            f"Electra"
        )
    else:
        subject = f"Collaboration with {org.name} | {project_name}"
        deck_mention = f"\nYou can explore our presentation deck here: {deck_url}" if deck_url else ""
        body = (
            f"Hi {first_name},\n\n"
            f"I came across {org.name}'s impressive footprint in {org.city or org.country or 'the industry'} and wanted to reach out directly.\n\n"
            f"At Electra, we specialize in high-impact solutions including {project_name}. "
            f"{pitch_angle or 'We partner with leading organizations to accelerate digital intelligence and drive commercial expansion.'}"
            f"{deck_mention}\n\n"
            f"Are you available for a quick introductory conversation next Tuesday or Wednesday?\n\n"
            f"Warm regards,\n"
            f"{getattr(user, 'full_name', 'Business Development Team') if user else 'Business Development Team'}\n"
            f"Electra"
        )

    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "contact_id": contact.id if contact else None,
        "contact_name": recipient_name,
        "contact_email": recipient_email,
        "contact_role": recipient_role,
        "subject": subject,
        "body": body,
        "recommended_deck_url": deck_url,
        "template_type": template_type,
        "requires_confirmation": True,
        "action_type": "send_email",
    }


def schedule_meeting_tool(
    db: Session,
    organization_id: int,
    title: str,
    scheduled_at: str,
    duration_minutes: int = 30,
    meeting_type: str = "Introduction",
    meeting_url: Optional[str] = None,
    notes: Optional[str] = None,
    user: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Prepare a scheduled meeting with an organization. Returns structured payload
    for human confirmation before creating the meeting record.
    """
    from app.models.organization import Organization
    from app.models.contact import Contact

    org = db.query(Organization).filter(
        Organization.id == organization_id,
        Organization.is_deleted == False,
    ).first()
    if not org:
        return {"error": f"Organization with ID {organization_id} not found."}

    contacts = db.query(Contact).filter(
        Contact.organization_id == organization_id,
        Contact.is_deleted == False,
    ).all()
    primary_contact = contacts[0] if contacts else None

    return {
        "organization_id": org.id,
        "organization_name": org.name,
        "title": title or f"Meeting with {org.name}",
        "scheduled_at": scheduled_at,
        "duration_minutes": duration_minutes,
        "meeting_type": meeting_type,
        "meeting_url": meeting_url or "",
        "notes": notes or f"Scheduled via ELLY Copilot for {org.name}",
        "primary_contact_id": primary_contact.id if primary_contact else None,
        "primary_contact_name": primary_contact.full_name if primary_contact else None,
        "requires_confirmation": True,
        "action_type": "schedule_meeting",
    }


def auto_generate_followups(
    db: Session,
    organization_id: Optional[int] = None,
    limit: int = 5,
    user: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Scan for opportunities and organizations with stale momentum, and suggest
    concrete follow-up actions and outreach templates.
    """
    from app.models.organization import Organization, ConnectionStatus
    from app.models.opportunity import Opportunity
    from app.models.followup import FollowUp, FollowUpStatus

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)

    items = []

    # Check overdue followups
    overdue_q = db.query(FollowUp).filter(
        FollowUp.status == FollowUpStatus.PENDING.value,
        FollowUp.is_deleted == False,
    )
    if organization_id:
        overdue_q = overdue_q.filter(FollowUp.organization_id == organization_id)
    
    for f in overdue_q.limit(limit).all():
        org = db.query(Organization).filter(Organization.id == f.organization_id).first()
        items.append({
            "type": "overdue_followup",
            "priority": "HIGH",
            "organization_id": f.organization_id,
            "organization_name": org.name if org else "Unknown",
            "title": f"Complete pending follow-up: {f.title}",
            "reason": f"Follow-up due at {f.due_at} is pending action.",
            "recommended_action": f"Draft outreach email or log touchpoint with {org.name if org else 'prospect'}.",
        })

    # Check stale contacted organizations
    if len(items) < limit:
        stale_orgs_q = db.query(Organization).filter(
            Organization.is_deleted == False,
            Organization.status == ConnectionStatus.CONTACTED.value,
        )
        if organization_id:
            stale_orgs_q = stale_orgs_q.filter(Organization.id == organization_id)
        
        for org in stale_orgs_q.limit(limit - len(items)).all():
            items.append({
                "type": "stale_lead",
                "priority": "MEDIUM",
                "organization_id": org.id,
                "organization_name": org.name,
                "title": f"Follow up with {org.name} (Contacted)",
                "reason": f"Organization is in 'Contacted' stage. Re-engage to move towards Connected.",
                "recommended_action": f"Send follow-up email sharing relevant showcase deck.",
            })

    return {
        "count": len(items),
        "follow_up_recommendations": items,
    }


# ─────────────────────────────────────────────────────────────
# 24. FUNDING / INVESTOR OUTREACH (additive — separate audience from client discovery)
# ─────────────────────────────────────────────────────────────

def find_investors(
    db: Session,
    sector: str = "",
    stage: str = "",
    location: str = "",
    limit: int = 10,
    user: Any = None,
) -> List[Dict[str, Any]]:
    """
    Search for angel investors, VC firms and funds via the standalone
    Investor & VC Discovery provider. Saves results to the Discovery queue and
    promotes new ones to the CRM, same as discover_web/discover_qualified.
    """
    from app.services.discovery_providers.investor_discovery_provider import InvestorDiscoveryProvider
    from app.models.discovery import DiscoveredOrganization, DiscoveryStatus
    from app.models.organization import Organization, ConnectionStatus, PriorityLevel, OrganizationType
    from app.services.discovery_engine import check_organization_duplicate

    provider = InvestorDiscoveryProvider()
    target_icp = f"Angel investors, VCs and funds investing in {sector}" if sector else "Angel investors, VCs and funds relevant to our sector and stage"
    if stage:
        target_icp += f", stage: {stage}"

    results, _ = provider.search_organizations(
        keyword=sector or None,
        location=location or None,
        target_icp=target_icp,
        limit=limit,
    )

    saved = []
    seen_org_ids = set()
    for o in results:
        name = o.get("name", "").strip()
        if not name or name == "Unknown":
            continue

        existing = db.query(DiscoveredOrganization).filter(DiscoveredOrganization.name == name).first()
        if existing and existing.id in seen_org_ids:
            continue
        if existing:
            seen_org_ids.add(existing.id)
            saved.append({
                "name": name,
                "status": "already_discovered",
                "discovered_org_id": existing.id,
                "organization_id": existing.organization_id,
                "website": existing.website,
                "potential_fit": existing.potential_fit,
            })
            continue

        disc_org = DiscoveredOrganization(
            name=name,
            organization_type=o.get("organization_type", "Investor"),
            city=o.get("city", ""),
            website=o.get("website", ""),
            email=o.get("email", ""),
            phone=o.get("phone", ""),
            description=o.get("description", ""),
            target_icp=target_icp,
            discovery_objective="Raise funding / build investor relationships",
            source_type=o.get("source_type", "investor_search"),
            source_name=o.get("source_name", "Investor & VC Discovery"),
            source_url=o.get("source_url", ""),
            status=DiscoveryStatus.DISCOVERED.value,
            potential_fit=o.get("potential_fit", "Medium"),
            potential_fit_score=o.get("potential_fit_score", 50),
            qualification_reason=o.get("qualification_reason", ""),
        )
        db.add(disc_org)
        db.flush()

        is_dup, existing_id, _ = check_organization_duplicate(db, name, o.get("website"))
        if is_dup and existing_id:
            disc_org.organization_id = existing_id
            disc_org.status = DiscoveryStatus.ADDED.value
        else:
            org = Organization(
                name=name,
                organization_type=OrganizationType.OTHER.value,
                country=o.get("country", "Unknown"),
                city=o.get("city"),
                website=o.get("website", ""),
                email=o.get("email"),
                phone=o.get("phone"),
                description=o.get("description", ""),
                status=ConnectionStatus.POTENTIAL.value,
                priority=PriorityLevel.MEDIUM.value,
                notes=f"Investor lead via {o.get('source_name', 'Investor & VC Discovery')}.",
            )
            db.add(org)
            db.flush()
            disc_org.organization_id = org.id
            disc_org.status = DiscoveryStatus.ADDED.value

        seen_org_ids.add(disc_org.id)
        saved.append({
            "name": name,
            "status": "added",
            "discovered_org_id": disc_org.id,
            "organization_id": disc_org.organization_id,
            "website": o.get("website"),
            "potential_fit": o.get("potential_fit"),
        })

    db.commit()
    return saved


def find_investor_contacts(
    db: Session,
    discovered_org_id: int,
    roles: Optional[str] = None,
    user: Any = None,
) -> List[Dict[str, Any]]:
    """
    Find decision-maker / partner contacts at a discovered investor organization,
    then immediately promote them into the real CRM Contact table (via
    convert_discovered_org_to_crm) so send_funding_outreach has someone to send to.
    Reuses the same executive discovery pipeline (now VC-title-aware: General
    Partner, Venture Partner, etc.) and the existing discovered-contact-to-CRM
    conversion path already used by the manual "Add to CRM" flow.
    """
    from app.models.discovery import DiscoveredOrganization, DiscoveredContact, DiscoveryStatus
    from app.services.discovery_engine import convert_discovered_org_to_crm

    found = discover_decision_makers_tool(db, discovered_org_id, roles=roles)

    disc_org = db.query(DiscoveredOrganization).filter(
        DiscoveredOrganization.id == discovered_org_id
    ).first()

    out_contacts: List[Dict[str, Any]] = []
    if disc_org:
        for c in found:
            c_name = (c.get("name") or "").strip()
            if not c_name:
                continue
            existing = db.query(DiscoveredContact).filter(
                DiscoveredContact.discovered_org_id == disc_org.id,
                DiscoveredContact.full_name == c_name,
            ).first()
            if not existing:
                existing = DiscoveredContact(
                    discovered_org_id=disc_org.id,
                    full_name=c_name,
                    job_title=c.get("role") or c.get("job_title") or "Executive",
                    email=c.get("email"),
                    email_status=c.get("email_status") or "not_found",
                    phone=c.get("phone"),
                    linkedin_url=c.get("linkedin_url"),
                    fit_level=c.get("fit_level") or "High",
                    fit_reason=c.get("fit_reason") or "Key executive decision-maker",
                    status=DiscoveryStatus.DISCOVERED.value,
                )
                db.add(existing)
                db.flush()
            out_contacts.append({
                "id": existing.id,
                "full_name": existing.full_name,
                "job_title": existing.job_title,
                "email": existing.email,
                "phone": existing.phone,
                "linkedin_url": existing.linkedin_url,
                "fit_level": existing.fit_level,
                "fit_reason": existing.fit_reason,
            })

        if disc_org.organization_id:
            convert_discovered_org_to_crm(
                db,
                disc_org,
                selected_contact_ids=None,
                user_id=user.id if user else None,
            )
        db.commit()

    return out_contacts


def send_funding_outreach(
    db: Session,
    organization_ids: str,
    template: Optional[str] = None,
    use_ai_template: bool = False,
    campaign_name: Optional[str] = None,
    user: Any = None,
) -> Dict[str, Any]:
    """
    Send funding/investor outreach immediately, with no approval step — distinct
    from the reviewed client-campaign flow. organization_ids is a comma-separated
    list of CRM organization IDs (from find_investors' saved results).
    """
    from app.services.campaign_service import CampaignService

    if isinstance(organization_ids, str):
        org_ids = [int(x.strip()) for x in organization_ids.split(",") if x.strip().isdigit()]
    else:
        org_ids = [int(x) for x in organization_ids]

    if not org_ids:
        return {"error": "No valid organization_ids provided"}

    body_template = None if use_ai_template else template
    subject_template = None

    result = CampaignService.quick_send(
        db=db,
        user=user,
        organization_ids=org_ids,
        subject_template=subject_template,
        body_template=body_template,
        campaign_name=campaign_name,
    )
    return result


