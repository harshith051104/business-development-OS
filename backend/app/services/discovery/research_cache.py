"""
Persistent research cache using the existing OrganizationResearchRecord table.

Provides:
  - get_cached_research(organization, domain) -> dict or None
  - store_research(organization, domain, research_data, ...)
  - invalidate_research(organization, domain)
  - is_cache_valid(timestamp, ttl_hours) -> bool

Research versioning prevents incompatible cached research reuse.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.research import OrganizationResearchRecord

logger = logging.getLogger(__name__)

RESEARCH_VERSION = "phase20-v1"


def is_cache_valid(timestamp: datetime, ttl_hours: Optional[int] = None) -> bool:
    """Check if cached research is still valid based on TTL."""
    if ttl_hours is None:
        ttl_hours = settings.RESEARCH_CACHE_TTL_HOURS
    if not timestamp:
        return False
    now = datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    return (now - timestamp) < timedelta(hours=ttl_hours)


def get_cached_research(
    db: Session,
    organization: str = "",
    domain: str = "",
) -> Optional[Dict[str, Any]]:
    """
    Retrieve cached research from the database.
    Returns None if cache miss, expired, or wrong version.
    """
    query = db.query(OrganizationResearchRecord)

    if organization:
        query = query.filter(OrganizationResearchRecord.organization_name == organization)
    elif domain:
        query = query.filter(OrganizationResearchRecord.domain == domain)
    else:
        return None

    record = query.order_by(OrganizationResearchRecord.research_date.desc()).first()
    if not record:
        return None

    # Version check
    if record.research_version and record.research_version != RESEARCH_VERSION:
        logger.info("Cache version mismatch: %s vs %s", record.research_version, RESEARCH_VERSION)
        return None

    # TTL check
    if not is_cache_valid(record.research_date):
        logger.info("Cache expired for %s", organization or domain)
        return None

    # Build result from record
    result = {
        "organization": record.organization_name,
        "domain": record.domain,
        "research_status": record.research_status,
        "research_date": record.research_date.isoformat() if record.research_date else None,
        "research_version": record.research_version,
        "source_urls": record.source_urls or [],
        "signals": record.signals if isinstance(record.signals, dict) else {},
        "qualification": record.qualification if isinstance(record.qualification, dict) else {},
        "decision_makers": record.decision_makers or [],
        "provider_used": record.provider_used,
        "error": record.error_message if hasattr(record, "error_message") else None,
    }

    # Also parse the JSON signals field if it's a string
    if isinstance(record.signals, str):
        try:
            result["signals"] = json.loads(record.signals)
        except (json.JSONDecodeError, TypeError):
            result["signals"] = {}

    return result


def store_research(
    db: Session,
    organization: str,
    domain: str = "",
    research_data: Optional[Dict[str, Any]] = None,
    source_urls: Optional[list] = None,
    signals: Optional[Dict[str, Any]] = None,
    qualification: Optional[Dict[str, Any]] = None,
    decision_makers: Optional[list] = None,
    provider_used: str = "",
    status: str = "SUCCESS",
    error_message: str = "",
) -> OrganizationResearchRecord:
    """
    Store research results in the database.

    Creates or updates the most recent research record for the organization.
    """
    # Find existing record
    existing = db.query(OrganizationResearchRecord).filter(
        OrganizationResearchRecord.organization_name == organization,
    ).order_by(OrganizationResearchRecord.research_date.desc()).first()

    now = datetime.now(timezone.utc)

    if existing:
        # Update existing record
        existing.domain = domain or existing.domain
        existing.research_status = status
        existing.research_date = now
        existing.research_version = RESEARCH_VERSION
        existing.source_urls = source_urls or existing.source_urls
        existing.signals = signals or existing.signals
        existing.qualification = qualification or existing.qualification
        existing.decision_makers = decision_makers or existing.decision_makers
        existing.provider_used = provider_used or existing.provider_used
        existing.error_message = error_message
        record = existing
    else:
        # Create new record
        record = OrganizationResearchRecord(
            organization_name=organization,
            domain=domain,
            research_status=status,
            research_date=now,
            research_version=RESEARCH_VERSION,
            source_urls=source_urls or [],
            signals=signals or {},
            qualification=qualification or {},
            decision_makers=decision_makers or [],
            provider_used=provider_used,
            error_message=error_message,
        )
        db.add(record)

    db.commit()
    db.refresh(record)
    return record


def invalidate_research(
    db: Session,
    organization: str = "",
    domain: str = "",
) -> int:
    """
    Invalidate cached research by marking it as expired.
    Returns number of records invalidated.
    """
    query = db.query(OrganizationResearchRecord)
    if organization:
        query = query.filter(OrganizationResearchRecord.organization_name == organization)
    elif domain:
        query = query.filter(OrganizationResearchRecord.domain == domain)
    else:
        return 0

    records = query.all()
    count = 0
    for record in records:
        # Set research_date far in the past to invalidate
        record.research_date = datetime(2000, 1, 1, tzinfo=timezone.utc)
        count += 1

    if count:
        db.commit()
    return count
