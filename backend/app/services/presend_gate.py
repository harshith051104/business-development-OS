"""
Deterministic pre-send gate — one set of checks for every email send path.

Used by CampaignService.send_step_email (campaign path) and
GmailService.send_email (direct Gmail path). No LLM, no network:
the same input always yields the same verdict.

Blocked reasons (stable codes, used in logs/tests):
  invalid_recipient            - empty or malformed address
  unresolved_placeholders      - {{token}} / {token} left in subject or body
  do_not_contact               - recipient record opted out
  contact_deleted              - recipient record soft-deleted
  recipient_mismatch           - to_email does not match the recipient record
  non_deliverable_email_status - email_status in NON_DELIVERABLE_STATUSES
  bounced_recipient            - campaign contact previously bounced
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, List, Optional

from app.models.campaign import CampaignContactStatus
from app.services.campaign.placeholder_engine import PlaceholderEngine

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Addresses at these statuses are non-deliverable and must never be sent to.
# Everything else (verified / risky / guess / found / unverified ...) is
# deliverable-with-risk and stays allowed so existing flows keep working.
NON_DELIVERABLE_STATUSES = {"invalid", "unavailable", "not_found", "bounced"}


@dataclass
class GateResult:
    ok: bool
    reasons: List[str] = field(default_factory=list)

    def __str__(self) -> str:
        return "ok" if self.ok else ",".join(self.reasons)


class SendBlockedError(ValueError):
    """Raised when the pre-send gate blocks a send. Subclass of ValueError so it
    flows through the same error handling as the existing approval gate."""

    def __init__(self, reasons: List[str]):
        self.reasons = list(reasons)
        super().__init__(f"Pre-send gate blocked send: {', '.join(self.reasons)}")


def evaluate_send(
    to_email: Optional[str],
    subject: str = "",
    body_html: str = "",
    *,
    db: Any = None,
    contact: Any = None,
    campaign_contact: Any = None,
    campaign_contact_id: Optional[int] = None,
    email_status: Optional[str] = None,
) -> GateResult:
    """
    Evaluate one send without side effects.

    contact: CRM Contact (or any object with email/do_not_contact/email_status).
             When None and db is given, the record is looked up by email so the
             direct Gmail path gets the same opt-out protection.
    campaign_contact / campaign_contact_id: CampaignContact — adds bounce protection.
    email_status: explicit status when the caller knows it (overrides contact's).
    """
    reasons: List[str] = []

    email = (to_email or "").strip()
    if not email or not EMAIL_REGEX.match(email):
        reasons.append("invalid_recipient")

    # Unresolved template placeholders must never reach a prospect.
    unresolved: List[str] = []
    for text in (subject or "", body_html or ""):
        for token in PlaceholderEngine.get_unresolved(text):
            if token not in unresolved:
                unresolved.append(token)
    if unresolved:
        reasons.append("unresolved_placeholders")

    # Direct (no-campaign) path: resolve the recipient record by email so
    # opt-out and status checks still apply.
    if contact is None and db is not None and email and "invalid_recipient" not in reasons:
        from app.models.contact import Contact
        contact = db.query(Contact).filter(Contact.email == email).first()

    if contact is not None:
        if getattr(contact, "do_not_contact", False):
            reasons.append("do_not_contact")
        if getattr(contact, "is_deleted", False):
            reasons.append("contact_deleted")
        known = (getattr(contact, "email", None) or "").strip()
        if known and known.lower() != email.lower():
            reasons.append("recipient_mismatch")
        email_status = email_status or getattr(contact, "email_status", None)

    if email_status and str(email_status).strip().lower() in NON_DELIVERABLE_STATUSES:
        reasons.append("non_deliverable_email_status")

    if campaign_contact is None and campaign_contact_id is not None and db is not None:
        from app.models.campaign import CampaignContact
        campaign_contact = db.query(CampaignContact).filter(
            CampaignContact.id == campaign_contact_id).first()

    if campaign_contact is not None:
        if getattr(campaign_contact, "status", None) == CampaignContactStatus.BOUNCED.value:
            reasons.append("bounced_recipient")

    return GateResult(ok=not reasons, reasons=reasons)


def assert_send_allowed(to_email: Optional[str], subject: str = "", body_html: str = "", **kwargs) -> GateResult:
    """Run the gate and raise SendBlockedError when the send must not go out."""
    result = evaluate_send(to_email, subject, body_html, **kwargs)
    if not result.ok:
        raise SendBlockedError(result.reasons)
    return result
