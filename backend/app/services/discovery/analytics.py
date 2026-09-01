"""
Discovery intelligence analytics.
Tracks metrics for discovery pipeline performance.
"""
from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.discovery import DiscoveredOrganization, DiscoveredContact, DiscoveryStatus, DiscoverySearchHistory
from app.models.organization import Organization


def get_discovery_analytics(db: Session) -> Dict[str, Any]:
    """Get discovery intelligence metrics."""
    total_discovered = db.query(DiscoveredOrganization).filter(
        DiscoveredOrganization.is_deleted.is_(False) if hasattr(DiscoveredOrganization, 'is_deleted') else True
    ).count()

    total_added = db.query(DiscoveredOrganization).filter(
        DiscoveredOrganization.status == DiscoveryStatus.ADDED.value
    ).count()

    total_saved = db.query(DiscoveredOrganization).filter(
        DiscoveredOrganization.status == DiscoveryStatus.SAVED.value
    ).count()

    total_skipped = db.query(DiscoveredOrganization).filter(
        DiscoveredOrganization.status == DiscoveryStatus.SKIPPED.value
    ).count()

    high_fit = db.query(DiscoveredOrganization).filter(
        DiscoveredOrganization.potential_fit == "High"
    ).count()

    total_contacts = db.query(DiscoveredContact).count()
    verified_contacts = db.query(DiscoveredContact).filter(
        DiscoveredContact.email_status == "enriched"
    ).count()

    # Source performance
    source_stats = db.query(
        DiscoveredOrganization.source_name,
        func.count(DiscoveredOrganization.id),
    ).group_by(DiscoveredOrganization.source_name).all()

    source_performance = {}
    for source_name, count in source_stats:
        high_in_source = db.query(DiscoveredOrganization).filter(
            DiscoveredOrganization.source_name == source_name,
            DiscoveredOrganization.potential_fit == "High",
        ).count()
        source_performance[source_name] = {
            "total": count,
            "high_fit": high_in_source,
        }

    # Average qualification score
    avg_score = db.query(func.avg(DiscoveredOrganization.potential_fit_score)).scalar()
    avg_score = float(avg_score) if avg_score else 0.0

    conversion_rate = (total_added / total_discovered * 100) if total_discovered > 0 else 0.0
    duplicate_rate = 0.0
    total_crm_orgs = db.query(Organization).filter(Organization.is_deleted.is_(False)).count()
    if total_crm_orgs > 0:
        duplicates = db.query(DiscoveredOrganization).filter(
            DiscoveredOrganization.matched_existing_org_id.isnot(None)
        ).count()
        duplicate_rate = (duplicates / total_discovered * 100) if total_discovered > 0 else 0.0

    return {
        "leads_discovered": total_discovered,
        "leads_qualified": total_discovered,
        "high_fit_leads": high_fit,
        "research_completed": 0,
        "decision_makers_found": total_contacts,
        "verified_contacts": verified_contacts,
        "leads_added_to_crm": total_added,
        "leads_rejected": total_skipped,
        "duplicate_rate": round(duplicate_rate, 1),
        "source_performance": source_performance,
        "average_qualification_score": round(avg_score, 1),
        "conversion_rate": round(conversion_rate, 1),
    }


def get_source_comparison(db: Session) -> List[Dict[str, Any]]:
    """Compare discovery source performance."""
    source_stats = db.query(
        DiscoveredOrganization.source_name,
        func.count(DiscoveredOrganization.id).label("total"),
        func.avg(DiscoveredOrganization.potential_fit_score).label("avg_score"),
    ).group_by(DiscoveredOrganization.source_name).all()

    results = []
    for source_name, total, avg_score in source_stats:
        high_fit = db.query(DiscoveredOrganization).filter(
            DiscoveredOrganization.source_name == source_name,
            DiscoveredOrganization.potential_fit == "High",
        ).count()
        added = db.query(DiscoveredOrganization).filter(
            DiscoveredOrganization.source_name == source_name,
            DiscoveredOrganization.status == DiscoveryStatus.ADDED.value,
        ).count()
        results.append({
            "source": source_name,
            "leads_discovered": total,
            "high_fit_leads": high_fit,
            "leads_added": added,
            "average_score": round(float(avg_score) if avg_score else 0, 1),
            "conversion_rate": round((added / total * 100) if total > 0 else 0, 1),
        })
    return results
