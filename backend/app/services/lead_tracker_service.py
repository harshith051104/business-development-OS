"""
Lead Tracker service — per-campaign-contact milestone checklist, activity timeline,
and team progress aggregation. Mirrors the Outreach Tracker board from the
Finance-Management-OS_IHT project, adapted to this app's SQLAlchemy/SQLite models.

Email sent/opened/replied milestones are NOT stored here — they're derived from
the real Gmail send/pixel-tracking fields already on CampaignContact (status,
opened_at, replied_at), so this board never diverges from what actually happened
on a real send. Only the manual LinkedIn/follow-up/meeting/opportunity milestones
are toggleable checkboxes.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.campaign import (
    CampaignContact,
    CampaignContactStatus,
    CampaignContactTimeline,
    LEAD_TRACKER_CHECKBOX_FIELDS,
    LEAD_TRACKER_CHECKBOX_LABELS,
)
from app.models.task import BDTask, TaskPriority, TaskStatus
from app.models.user import User
from app.services import notification_service

EDITABLE_TEXT_FIELDS = {"tracker_notes", "focus", "next_followup_at"}

# Checkbox fields that trigger an auto-created follow-up task, keyed to a (title, description, delay_days) template.
AUTO_TASK_RULES = {
    "meeting_scheduled": ("Prep for meeting", "Meeting was scheduled for this lead — prepare talking points and agenda.", 1),
    "followup_3_sent": ("Check in: no reply after 3 follow-ups", "Third follow-up sent with no reply yet. Decide whether to try another channel or deprioritize.", 3),
}

# Checkbox fields significant enough to notify the assigned rep about.
NOTIFY_ON_CHECKED = {"meeting_scheduled", "opportunity_closed"}


def update_checkboxes(
    db: Session,
    campaign_contact_id: int,
    user_id: int,
    updates: Dict[str, Any],
) -> CampaignContact:
    """Apply checkbox/field updates to a campaign contact, logging a timeline event per changed checkbox."""
    invalid = set(updates.keys()) - set(LEAD_TRACKER_CHECKBOX_FIELDS) - EDITABLE_TEXT_FIELDS
    if invalid:
        raise ValueError(f"Invalid tracker fields: {invalid}")

    cc = db.query(CampaignContact).filter(CampaignContact.id == campaign_contact_id).first()
    if not cc:
        raise ValueError(f"Campaign contact '{campaign_contact_id}' not found.")

    checked_milestones: List[str] = []
    auto_task_fields: List[str] = []

    for field, new_value in updates.items():
        if field in LEAD_TRACKER_CHECKBOX_FIELDS:
            old_value = getattr(cc, field)
            if bool(old_value) != bool(new_value):
                setattr(cc, field, bool(new_value))
                label = LEAD_TRACKER_CHECKBOX_LABELS.get(field, field.replace("_", " ").title())
                log_timeline_event(
                    db,
                    campaign_contact_id=cc.id,
                    user_id=user_id,
                    event_type=field,
                    description=label if new_value else f"{label} (unchecked)",
                    metadata={"field": field, "old_value": bool(old_value), "new_value": bool(new_value)},
                    _flush=False,
                )
                if new_value and field in NOTIFY_ON_CHECKED:
                    checked_milestones.append(field)
                if new_value and field in AUTO_TASK_RULES:
                    auto_task_fields.append(field)
        elif field == "tracker_notes":
            if new_value and new_value != cc.tracker_notes:
                log_timeline_event(
                    db,
                    campaign_contact_id=cc.id,
                    user_id=user_id,
                    event_type="note_added",
                    description="Note added",
                    metadata={"note": str(new_value)[:200]},
                    _flush=False,
                )
            cc.tracker_notes = new_value
        else:
            setattr(cc, field, new_value)

    cc.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(cc)

    from app.services import google_sheets_service
    google_sheets_service.push_tracker_row(cc)

    if cc.assigned_user_id:
        for field in checked_milestones:
            label = LEAD_TRACKER_CHECKBOX_LABELS.get(field, field.replace("_", " ").title())
            notification_service.notify(
                db,
                user_id=cc.assigned_user_id,
                type=f"LEAD_{field.upper()}",
                title=f"{label}",
                body=f"Lead #{cc.id} marked '{label}'.",
                link=f"/business-development/leads/tracker",
            )

    for field in auto_task_fields:
        if field == "followup_3_sent" and cc.status == CampaignContactStatus.REPLIED.value:
            continue  # they replied — no need for a "no reply" check-in task
        title, description, delay_days = AUTO_TASK_RULES[field]
        task = BDTask(
            title=f"{title} (Lead #{cc.id})",
            description=description,
            priority=TaskPriority.MEDIUM.value,
            status=TaskStatus.TODO.value,
            due_date=datetime.now(timezone.utc) + timedelta(days=delay_days),
            entity_type="campaign_contact",
            entity_id=cc.id,
            owner_id=cc.assigned_user_id,
        )
        db.add(task)
    if auto_task_fields:
        db.commit()

    return cc


def log_timeline_event(
    db: Session,
    campaign_contact_id: int,
    user_id: Optional[int],
    event_type: str,
    description: str,
    metadata: Optional[dict] = None,
    _flush: bool = True,
) -> CampaignContactTimeline:
    event = CampaignContactTimeline(
        campaign_contact_id=campaign_contact_id,
        user_id=user_id,
        event_type=event_type,
        description=description,
        event_metadata=metadata or {},
    )
    db.add(event)
    if _flush:
        db.commit()
        db.refresh(event)
    else:
        db.flush()
    return event


def get_timeline(db: Session, campaign_contact_id: int, limit: int = 100) -> List[CampaignContactTimeline]:
    return (
        db.query(CampaignContactTimeline)
        .filter(CampaignContactTimeline.campaign_contact_id == campaign_contact_id)
        .order_by(CampaignContactTimeline.created_at.desc())
        .limit(limit)
        .all()
    )


def get_team_progress(db: Session, campaign_id: Optional[int] = None) -> Dict[str, Any]:
    """Aggregate milestone completion per assigned user."""
    query = db.query(CampaignContact)
    if campaign_id:
        query = query.filter(CampaignContact.campaign_id == campaign_id)
    rows = query.all()

    sent_statuses = {
        CampaignContactStatus.SENT.value,
        CampaignContactStatus.REPLIED.value,
        CampaignContactStatus.COMPLETED.value,
    }

    by_user: Dict[Optional[int], Dict[str, Any]] = {}
    for cc in rows:
        key = cc.assigned_user_id
        bucket = by_user.setdefault(key, {"total": 0, "email_sent": 0, **{f: 0 for f in LEAD_TRACKER_CHECKBOX_FIELDS}})
        bucket["total"] += 1
        if cc.status in sent_statuses:
            bucket["email_sent"] += 1
        for f in LEAD_TRACKER_CHECKBOX_FIELDS:
            if getattr(cc, f):
                bucket[f] += 1

    user_ids = [uid for uid in by_user.keys() if uid]
    users_by_id = {}
    if user_ids:
        for u in db.query(User).filter(User.id.in_(user_ids)).all():
            users_by_id[u.id] = u

    members = []
    for uid, bucket in sorted(by_user.items(), key=lambda kv: (kv[0] is None, kv[0] or 0)):
        total = bucket["total"] or 1
        completed = bucket["opportunity_closed"]
        user = users_by_id.get(uid)
        members.append({
            "user_id": uid,
            "display_name": user.name if user else "Unassigned",
            "total_leads": bucket["total"],
            "completed": completed,
            "meeting_scheduled": bucket["meeting_scheduled"],
            "opportunity_closed": bucket["opportunity_closed"],
            "completion_rate": round(completed / total * 100, 1),
            "email_sent": bucket["email_sent"],
            "linkedin_connection_sent": bucket["linkedin_connection_sent"],
            "linkedin_connection_accepted": bucket["linkedin_connection_accepted"],
            "linkedin_first_message_sent": bucket["linkedin_first_message_sent"],
            "linkedin_reply_received": bucket["linkedin_reply_received"],
            "followup_1_sent": bucket["followup_1_sent"],
            "followup_2_sent": bucket["followup_2_sent"],
            "followup_3_sent": bucket["followup_3_sent"],
        })

    total_leads = sum(m["total_leads"] for m in members)
    total_completed = sum(m["completed"] for m in members)
    return {
        "total_members": len(members),
        "total_leads": total_leads,
        "total_completed": total_completed,
        "members": members,
    }
