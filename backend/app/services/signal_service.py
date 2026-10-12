"""Rule-based buying-signal detection over existing engagement data only
(no new discovery/scraping). Runs as a daily APScheduler job; writes Signal
rows + notifies the lead's assigned user, same pattern as task_sweep_service.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.campaign import Campaign, CampaignContact, CampaignContactStatus
from app.models.signal import Signal
from app.services import notification_service

import logging

logger = logging.getLogger(__name__)

DEDUP_WINDOW_DAYS = 7
NO_ACTIVITY_DAYS = 14
MULTI_CONTACT_THRESHOLD = 2


def _recent_duplicate(db: Session, signal_type: str, campaign_contact_id: Optional[int]) -> bool:
    if not campaign_contact_id:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(days=DEDUP_WINDOW_DAYS)
    return (
        db.query(Signal)
        .filter(
            Signal.signal_type == signal_type,
            Signal.campaign_contact_id == campaign_contact_id,
            Signal.created_at >= cutoff,
        )
        .first()
        is not None
    )


def _create_signal(
    db: Session,
    signal_type: str,
    description: str,
    score: int,
    organization_id: Optional[int] = None,
    contact_id: Optional[int] = None,
    campaign_contact_id: Optional[int] = None,
    metadata: Optional[dict] = None,
    notify_user_id: Optional[int] = None,
) -> Signal:
    sig = Signal(
        organization_id=organization_id,
        contact_id=contact_id,
        campaign_contact_id=campaign_contact_id,
        signal_type=signal_type,
        description=description,
        score=score,
        signal_metadata=metadata,
    )
    db.add(sig)
    db.commit()
    db.refresh(sig)

    if notify_user_id:
        try:
            notification_service.notify(
                db,
                user_id=notify_user_id,
                type="SIGNAL_DETECTED",
                title="New buying signal",
                body=description,
                link="/business-development/signals",
            )
        except Exception:
            logger.exception("Failed to notify on signal %s", sig.id)

    return sig


def scan_signals() -> int:
    """Daily scan. Returns count of new signals created."""
    db = SessionLocal()
    created = 0
    try:
        contacts = db.query(CampaignContact).all()

        # Rule 1: opened 3+ times, never replied/bounced.
        for cc in contacts:
            if cc.open_count >= 3 and cc.status not in (
                CampaignContactStatus.REPLIED.value,
                CampaignContactStatus.BOUNCED.value,
            ):
                if _recent_duplicate(db, "high_open_no_reply", cc.id):
                    continue
                _create_signal(
                    db,
                    signal_type="high_open_no_reply",
                    description=f"Contact opened email {cc.open_count}x with no reply yet.",
                    score=min(100, cc.open_count * 15),
                    organization_id=cc.organization_id,
                    contact_id=cc.contact_id,
                    campaign_contact_id=cc.id,
                    metadata={"open_count": cc.open_count},
                    notify_user_id=cc.assigned_user_id,
                )
                created += 1

        # Rule 2: LinkedIn connection accepted 14+ days ago, no reply/meeting since.
        cutoff = datetime.now(timezone.utc) - timedelta(days=NO_ACTIVITY_DAYS)
        for cc in contacts:
            if not cc.linkedin_connection_accepted:
                continue
            if cc.status in (CampaignContactStatus.REPLIED.value, CampaignContactStatus.COMPLETED.value):
                continue
            if cc.meeting_scheduled or cc.opportunity_closed:
                continue
            reference = cc.last_action_at or cc.updated_at or cc.created_at
            if reference is None:
                continue
            ref = reference if reference.tzinfo else reference.replace(tzinfo=timezone.utc)
            if ref > cutoff:
                continue
            if _recent_duplicate(db, "stalled_after_connection", cc.id):
                continue
            days_idle = (datetime.now(timezone.utc) - ref).days
            _create_signal(
                db,
                signal_type="stalled_after_connection",
                description=f"No activity for {days_idle} days since LinkedIn connection accepted.",
                score=60,
                organization_id=cc.organization_id,
                contact_id=cc.contact_id,
                campaign_contact_id=cc.id,
                metadata={"days_idle": days_idle},
                notify_user_id=cc.assigned_user_id,
            )
            created += 1

        # Rule 3: multiple contacts at the same org engaging (opened or replied).
        engaged_by_org: dict = defaultdict(list)
        for cc in contacts:
            if cc.organization_id and (cc.open_count > 0 or cc.status == CampaignContactStatus.REPLIED.value):
                engaged_by_org[cc.organization_id].append(cc)

        for org_id, ccs in engaged_by_org.items():
            if len(ccs) < MULTI_CONTACT_THRESHOLD:
                continue
            anchor = max(ccs, key=lambda c: c.id)
            if _recent_duplicate(db, "multi_contact_engagement", anchor.id):
                continue
            _create_signal(
                db,
                signal_type="multi_contact_engagement",
                description=f"{len(ccs)} contacts at this organization are engaging with outreach.",
                score=min(100, len(ccs) * 25),
                organization_id=org_id,
                contact_id=anchor.contact_id,
                campaign_contact_id=anchor.id,
                metadata={"contact_count": len(ccs)},
                notify_user_id=anchor.assigned_user_id,
            )
            created += 1

        return created
    except Exception:
        logger.exception("signal scan failed")
        return created
    finally:
        db.close()


def list_active(db: Session, limit: int = 100) -> List[Signal]:
    return (
        db.query(Signal)
        .filter(Signal.dismissed == False)  # noqa: E712
        .order_by(Signal.score.desc(), Signal.created_at.desc())
        .limit(limit)
        .all()
    )


def dismiss(db: Session, signal_id: int) -> Optional[Signal]:
    sig = db.query(Signal).filter(Signal.id == signal_id).first()
    if not sig:
        return None
    sig.dismissed = True
    db.commit()
    db.refresh(sig)
    return sig
