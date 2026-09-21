"""
Decision-maker discovery layer — free-first pipeline.

Pipeline:
  1. Known executive roster (hardcoded for verified orgs)
  2. Public web discovery (Tavily/Serper/website scraping)
  3. Existing discovered contacts
  4. Optional BetterContact enrichment (if enabled)

Never fabricates — only returns contacts with sources.
"""
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.discovery import DiscoveredContact, DiscoveredOrganization, DiscoveryStatus, PotentialFit
from app.services.discovery_providers.ai_qualification import qualify_contact

logger = logging.getLogger(__name__)

TARGET_ROLES = [
    "CEO", "CTO", "CIO", "CDO", "COO",
    "Chief Digital Officer", "Chief Technology Officer",
    "VP of Engineering", "VP of Sales", "VP of Partnerships",
    "Head of Business Development", "Head of Innovation",
    "Head of Digital Transformation", "Head of IT",
    "Head of Partnerships", "Head of AI",
    "Procurement Head", "Strategy Head",
]


def discover_decision_makers(
    db: Session,
    organization_name: str,
    organization_type: str = "",
    website: str = "",
    target_roles: Optional[List[str]] = None,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    """
    Discover decision-makers using free-first pipeline.

    Priority:
      1. Known executive roster
      2. Public web discovery
      3. Existing discovered contacts
      4. Optional BetterContact enrichment
    """
    if not target_roles:
        target_roles = TARGET_ROLES

    contacts = []
    seen_names = set()

    # ── Step 1: Known executive roster (hardcoded for verified orgs) ──
    try:
        from app.services.discovery_providers.registry import discovery_registry
        provider = discovery_registry.get_contact_provider("Executive Decision-Maker Discovery Provider")
        if provider:
            raw_contacts = provider.search_decision_makers(
                organization_name=organization_name,
                organization_type=organization_type,
                website=website,
                target_roles=target_roles,
                limit=limit,
            )
            for c in raw_contacts:
                name = c.get("full_name", "").strip()
                if name.lower() in seen_names:
                    continue
                seen_names.add(name.lower())
                fit_level, fit_reason = qualify_contact(c, organization_name, organization_type)
                contacts.append({
                    "name": name,
                    "role": c.get("job_title", "Unknown"),
                    "organization_name": organization_name,
                    "email": c.get("email"),
                    "email_status": c.get("email_status", "unverified"),
                    "phone": c.get("phone"),
                    "linkedin_url": c.get("linkedin_url"),
                    "source": c.get("source", "known_roster"),
                    "confidence": c.get("confidence", 0.8),
                    "decision_maker_score": _calc_dm_score(c.get("job_title", "")),
                    "fit_level": fit_level,
                    "fit_reason": fit_reason,
                    "verification_state": "publicly_found",
                })
    except Exception as e:
        logger.warning("Known roster provider failed for %s: %s", organization_name, e)

    # ── Step 2: Public web discovery (free) ──
    if len(contacts) < limit:
        try:
            from app.services.enrichment.public_web_provider import PublicWebContactProvider
            web_provider = PublicWebContactProvider()
            if web_provider.is_available:
                domain = ""
                if website:
                    domain = website.replace("https://", "").replace("http://", "").split("/")[0]
                result = web_provider.find_contact(
                    organization=organization_name,
                    domain=domain,
                )
                for c in result.contacts:
                    name = c.name.strip()
                    if not name or name.lower() in seen_names:
                        continue
                    seen_names.add(name.lower())
                    contacts.append({
                        "name": name,
                        "role": c.role,
                        "organization_name": organization_name,
                        "email": c.email,
                        "email_status": c.email_status,
                        "phone": c.phone,
                        "linkedin_url": c.linkedin_url,
                        "source": c.source,
                        "source_url": c.source_url,
                        "confidence": c.confidence / 100.0,
                        "decision_maker_score": _calc_dm_score(c.role),
                        "verification_state": c.verification_state,
                    })
        except Exception as e:
            logger.debug("Public web contact discovery failed for %s: %s", organization_name, e)

    # ── Step 3: Existing discovered contacts ──
    disc_org = db.query(DiscoveredOrganization).filter(
        DiscoveredOrganization.name.ilike(f"%{organization_name}%"),
    ).first()
    if disc_org:
        existing_contacts = db.query(DiscoveredContact).filter(
            DiscoveredContact.discovered_org_id == disc_org.id,
        ).all()
        for ec in existing_contacts:
            if ec.full_name.lower() not in seen_names:
                seen_names.add(ec.full_name.lower())
                contacts.append({
                    "name": ec.full_name,
                    "role": ec.job_title,
                    "organization_name": organization_name,
                    "email": ec.email,
                    "email_status": ec.email_status,
                    "phone": ec.phone,
                    "linkedin_url": ec.linkedin_url,
                    "source": "discovery_cache",
                    "confidence": 0.6,
                    "decision_maker_score": _calc_dm_score(ec.job_title),
                    "fit_level": ec.fit_level,
                    "fit_reason": ec.fit_reason,
                    "verification_state": "publicly_found_unverified",
                })

    # ── Step 4: Optional BetterContact enrichment ──
    if settings.BETTERCONTACT_ENABLED and settings.BETTERCONTACT_API_KEY and len(contacts) < limit:
        try:
            from app.services.enrichment.bettercontact_adapter import get_bettercontact_adapter
            adapter = get_bettercontact_adapter()
            if adapter.is_available:
                for contact in contacts[:3]:  # Limit API calls
                    if not contact.get("email"):
                        result = adapter.find_contact(
                            organization=organization_name,
                            person_name=contact.get("name", ""),
                            role=contact.get("role", ""),
                        )
                        if result.contacts:
                            enriched = result.contacts[0]
                            if enriched.email:
                                contact["email"] = enriched.email
                                contact["email_status"] = enriched.email_status
                                contact["verification_state"] = enriched.verification_state
                                contact["source"] = f"{contact.get('source', 'unknown')},bettercontact"
                                contact["confidence"] = max(contact.get("confidence", 0), enriched.confidence / 100.0)
                            if enriched.phone and not contact.get("phone"):
                                contact["phone"] = enriched.phone
                            if enriched.linkedin_url and not contact.get("linkedin_url"):
                                contact["linkedin_url"] = enriched.linkedin_url
        except Exception as e:
            logger.debug("BetterContact enrichment failed for %s: %s", organization_name, e)

    # Step 5: Infer corporate email pattern if missing
    for c in contacts:
        if not c.get("email") and website and c.get("name"):
            inferred = infer_corporate_email(c["name"], website)
            if inferred:
                c["email"] = inferred
                c["email_status"] = "predicted"
                c["verification_state"] = "predicted_corporate_pattern"

    # Sort by decision-maker score
    contacts.sort(key=lambda x: x.get("decision_maker_score", 0), reverse=True)
    return contacts[:limit]


def infer_corporate_email(full_name: str, website: str) -> Optional[str]:
    """Infers standard B2B corporate email format from executive name and domain."""
    if not full_name or not website:
        return None
    try:
        from urllib.parse import urlparse
        import re
        domain = urlparse(website).netloc.lower().replace("www.", "")
        if not domain or "." not in domain:
            return None
        parts = [p.lower() for p in re.findall(r"[a-zA-Z]+", full_name)]
        if not parts:
            return None
        if len(parts) == 1:
            return f"{parts[0]}@{domain}"
        first, last = parts[0], parts[-1]
        return f"{first}.{last}@{domain}"
    except Exception:
        return None


def _calc_dm_score(title: str) -> int:
    """Score a job title for decision-maker relevance."""
    title_lower = title.lower()
    if any(t in title_lower for t in ["ceo", "chief executive", "managing director", "president"]):
        return 98
    if any(t in title_lower for t in ["cto", "chief technology", "cdo", "chief digital", "cio", "chief information"]):
        return 95
    if any(t in title_lower for t in ["partnerships", "business development", "strategic"]):
        return 88
    if any(t in title_lower for t in ["head of", "vp", "vice president"]):
        return 85
    if any(t in title_lower for t in ["director", "managing director"]):
        return 80
    if any(t in title_lower for t in ["cmo", "coo", "chief operating"]):
        return 75
    if any(t in title_lower for t in ["procurement", "strategy", "innovation"]):
        return 70
    return 50
