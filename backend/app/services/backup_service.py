"""Nightly SQLite backup: copy the DB file into backend/backups/ with
rotation. No external backup infra needed at this team size.
"""
import logging
import os
import shutil
from datetime import datetime

from app.core.config import settings

logger = logging.getLogger("elly.backup")

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKUP_DIR = os.path.join(BACKEND_ROOT, "backups")
MAX_BACKUPS = 14


def _db_file_path():
    url = settings.DATABASE_URL
    if not url.startswith("sqlite"):
        return None
    # sqlite:///./bd_portal.db -> ./bd_portal.db, resolved against backend/ root
    rel = url.split("///", 1)[-1]
    return os.path.abspath(os.path.join(BACKEND_ROOT, rel))


def run_backup():
    db_path = _db_file_path()
    if not db_path or not os.path.exists(db_path):
        logger.warning("Backup skipped: sqlite db not found at %s", db_path)
        return None

    os.makedirs(BACKUP_DIR, exist_ok=True)

    existing = sorted(f for f in os.listdir(BACKUP_DIR) if f.startswith("bd_portal_") and f.endswith(".db"))
    if existing:
        latest = os.path.join(BACKUP_DIR, existing[-1])
        if os.path.getmtime(db_path) <= os.path.getmtime(latest):
            logger.info("Backup skipped: db unchanged since last backup (%s)", existing[-1])
            return None

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = os.path.join(BACKUP_DIR, f"bd_portal_{stamp}.db")
    shutil.copy2(db_path, dest)
    logger.info("Database backed up to %s", dest)

    _rotate()
    return dest


def _rotate():
    backups = sorted(f for f in os.listdir(BACKUP_DIR) if f.startswith("bd_portal_") and f.endswith(".db"))
    excess = len(backups) - MAX_BACKUPS
    for old in backups[:max(excess, 0)]:
        try:
            os.remove(os.path.join(BACKUP_DIR, old))
        except OSError:
            logger.warning("Failed to prune old backup %s", old)
