"""Per-Gmail-account deliverability health, rolled up from existing
CampaignContact send/bounce/reply data — no new tracking infra, just an
aggregation over data the app already records.
"""
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignContact, CampaignContactStatus, GmailAccount

SENT_LIKE = {
    CampaignContactStatus.SENT.value,
    CampaignContactStatus.REPLIED.value,
    CampaignContactStatus.COMPLETED.value,
    CampaignContactStatus.BOUNCED.value,
}


def _health_score(sent: int, bounced: int, replied: int) -> int:
    if sent == 0:
        return 100
    bounce_rate = bounced / sent
    reply_rate = replied / sent
    score = 100 - (bounce_rate * 200) + (reply_rate * 20)
    return max(0, min(100, round(score)))


def get_account_health(db: Session, account: GmailAccount) -> Dict[str, Any]:
    campaign_ids = [c.id for c in db.query(Campaign.id).filter(Campaign.gmail_account_id == account.id).all()]
    if not campaign_ids:
        return {
            "account_id": account.id,
            "email": account.email,
            "sent": 0,
            "bounced": 0,
            "replied": 0,
            "bounce_rate": 0.0,
            "reply_rate": 0.0,
            "health_score": 100,
            "status": "healthy",
        }

    contacts = db.query(CampaignContact).filter(CampaignContact.campaign_id.in_(campaign_ids)).all()
    sent = sum(1 for c in contacts if c.status in SENT_LIKE)
    bounced = sum(1 for c in contacts if c.status == CampaignContactStatus.BOUNCED.value)
    replied = sum(1 for c in contacts if c.status == CampaignContactStatus.REPLIED.value)

    bounce_rate = round((bounced / sent * 100), 1) if sent else 0.0
    reply_rate = round((replied / sent * 100), 1) if sent else 0.0
    score = _health_score(sent, bounced, replied)
    status = "healthy" if score >= 80 else "at_risk" if score >= 50 else "poor"

    return {
        "account_id": account.id,
        "email": account.email,
        "sent": sent,
        "bounced": bounced,
        "replied": replied,
        "bounce_rate": bounce_rate,
        "reply_rate": reply_rate,
        "health_score": score,
        "status": status,
    }


def get_all_accounts_health(db: Session, user_id: int = None) -> List[Dict[str, Any]]:
    query = db.query(GmailAccount).filter(GmailAccount.is_active == True)  # noqa: E712
    if user_id:
        query = query.filter(GmailAccount.user_id == user_id)
    return [get_account_health(db, acc) for acc in query.all()]
