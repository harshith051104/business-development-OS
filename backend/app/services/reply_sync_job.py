"""Scheduled wrapper around GmailService.sync_inbox_replies — promotes the
existing manual "sync replies" button to an automatic 5-min poll."""
import logging

from app.core.database import SessionLocal
from app.services.gmail_service import GmailService

logger = logging.getLogger("elly.reply_sync")


def sync_all_inboxes():
    db = SessionLocal()
    try:
        result = GmailService.sync_inbox_replies(db=db)
        if result.get("replies_detected"):
            logger.info("Reply sync: %d new reply/replies detected", result["replies_detected"])
    finally:
        db.close()
