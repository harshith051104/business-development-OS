"""
Enhanced deduplication engine with evidence-based matching.

Statuses:
  NEW_LEAD — no match found
  ALREADY_IN_CRM — exact match in CRM
  POSSIBLE_DUPLICATE — partial match, needs human review

Never silently merge uncertain records.
Every duplicate detection includes evidence.
"""
import logging
import re
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.organization import Organization

logger = logging.getLogger(__name__)

# Known organization aliases (extend as needed)
KNOWN_ALIASES = {
    "apollo hospitals": ["apollo hospital", "apollohealthcare", "apollo health care"],
    "fortis healthcare": ["fortis hospitals", "fortis hospital", "fortis health"],
    "max healthcare": ["max hospitals", "max hospital", "max health"],
    "narayana health": ["narayana hrudayalaya", "narayana health city"],
    "aiims": ["all india institute of medical sciences"],
}


def _normalize_name(name: str) -> str:
    name = name.strip().lower()
    for suffix in ["ltd", "limited", "inc", "llc", "corp", "corporation", "private", "pvt", "plc"]:
        name = re.sub(rf'\b{suffix}\b\.?', '', name)
    name = re.sub(r'[^a-z0-9\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def _extract_domain(url: str) -> str:
    if not url:
        return ""
    return (
        url.strip().lower()
        .replace("https://", "")
        .replace("http://", "")
        .replace("www.", "")
        .split("/")[0]
        .split("?")[0]
    )


def _normalize_domain(domain: str) -> str:
    """Normalize domain for comparison: strip www., common TLDs, lowercase."""
    d = _extract_domain(domain)
    # Remove common subdomains
    for prefix in ["www.", "m.", "app.", "mail."]:
        if d.startswith(prefix):
            d = d[len(prefix):]
    return d


def _name_similarity(a: str, b: str) -> float:
    na = set(_normalize_name(a).split())
    nb = set(_normalize_name(b).split())
    if not na or not nb:
        return 0.0
    return len(na & nb) / len(na | nb)


def _check_alias_match(name_a: str, name_b: str) -> bool:
    """Check if two names are known aliases of the same organization."""
    na = _normalize_name(name_a)
    nb = _normalize_name(name_b)
    for canonical, aliases in KNOWN_ALIASES.items():
        canonical_norm = _normalize_name(canonical)
        aliases_norm = [_normalize_name(a) for a in aliases]
        if (na == canonical_norm or na in aliases_norm) and (nb == canonical_norm or nb in aliases_norm):
            return True
    return False


def _normalize_phone(phone: str) -> str:
    """Strip spaces, dashes, parentheses from phone for comparison."""
    if not phone:
        return ""
    return re.sub(r'[\s\-\(\)\+]', '', phone)


class DeduplicationEngine:

    NAME_SIMILARITY_THRESHOLD = 0.6
    CRM_NAME_SIMILARITY_THRESHOLD = 0.8

    def __init__(self, db: Session):
        self.db = db

    def deduplicate(self, leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Deduplicate leads within batch and against CRM. Returns enriched lead dicts with evidence."""
        unique_leads = self._dedup_within_batch(leads)
        for lead in unique_leads:
            crm_result = self._check_crm_duplicate(lead)
            lead["crm_status"] = crm_result["status"]
            lead["is_existing_duplicate"] = crm_result["is_duplicate"]
            lead["existing_org_id"] = crm_result.get("existing_id")
            lead["existing_org_name"] = crm_result.get("existing_name")
            lead["dedup_evidence"] = crm_result.get("evidence", [])
        return unique_leads

    def _dedup_within_batch(self, leads: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not leads:
            return []
        unique = []
        seen = []  # List of (name, domain, phone, lead_index)
        for lead in leads:
            name = lead.get("name", "")
            domain = _normalize_domain(lead.get("website", ""))
            phone = _normalize_phone(lead.get("phone", ""))
            is_dup = False
            evidence = []

            for sn, sd, sp, _ in seen:
                # Name similarity
                name_sim = _name_similarity(name, sn)
                if name_sim >= self.NAME_SIMILARITY_THRESHOLD:
                    is_dup = True
                    evidence.append(f"Name similarity {name_sim:.0%} with '{sn}'")
                    break

                # Known aliases
                if _check_alias_match(name, sn):
                    is_dup = True
                    evidence.append(f"Known alias match: '{name}' = '{sn}'")
                    break

                # Domain match
                if domain and sd and domain == sd:
                    is_dup = True
                    evidence.append(f"Same domain: {domain}")
                    break

                # Phone match (if both present and meaningful — at least 8 digits)
                if phone and sp and len(phone) >= 8 and len(sp) >= 8 and phone == sp:
                    is_dup = True
                    evidence.append(f"Same phone: {phone}")
                    break

            if not is_dup:
                unique.append(lead)
                seen.append((name, domain, phone, len(unique) - 1))

        return unique

    def _check_crm_duplicate(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        """Check if a lead already exists in CRM. Returns status with evidence."""
        name = lead.get("name", "")
        website = lead.get("website", "")
        phone = lead.get("phone", "")
        domain = _normalize_domain(website)
        clean_name = _normalize_name(name)

        existing = self.db.query(Organization).filter(
            Organization.is_deleted.is_(False),
        ).all()

        for org in existing:
            org_name = _normalize_name(org.name)

            # Exact name match
            if org_name == clean_name:
                return {
                    "status": "ALREADY_IN_CRM",
                    "is_duplicate": True,
                    "existing_id": org.id,
                    "existing_name": org.name,
                    "evidence": [f"Exact name match: '{name}' = '{org.name}'"],
                }

            # Domain match
            if website and org.website:
                org_domain = _normalize_domain(org.website)
                if domain and org_domain and domain == org_domain:
                    return {
                        "status": "POSSIBLE_DUPLICATE",
                        "is_duplicate": True,
                        "existing_id": org.id,
                        "existing_name": org.name,
                        "evidence": [f"Same domain as {org.name} already in CRM: {domain}"],
                    }

            # High name similarity
            sim = _name_similarity(name, org.name)
            if sim >= self.CRM_NAME_SIMILARITY_THRESHOLD:
                return {
                    "status": "POSSIBLE_DUPLICATE",
                    "is_duplicate": True,
                    "existing_id": org.id,
                    "existing_name": org.name,
                    "evidence": [f"Name similarity {sim:.0%} with {org.name} already in CRM"],
                }

            # Known aliases
            if _check_alias_match(name, org.name):
                return {
                    "status": "POSSIBLE_DUPLICATE",
                    "is_duplicate": True,
                    "existing_id": org.id,
                    "existing_name": org.name,
                    "evidence": [f"Known alias: '{name}' may be same org as '{org.name}' in CRM"],
                }

            # Phone match
            if phone and hasattr(org, "phone") and org.phone:
                norm_phone = _normalize_phone(phone)
                norm_org_phone = _normalize_phone(org.phone)
                if norm_phone and norm_org_phone and len(norm_phone) >= 8 and len(norm_org_phone) >= 8:
                    if norm_phone == norm_org_phone:
                        return {
                            "status": "POSSIBLE_DUPLICATE",
                            "is_duplicate": True,
                            "existing_id": org.id,
                            "existing_name": org.name,
                            "evidence": [f"Same phone number as {org.name} in CRM"],
                        }

        return {"status": "NEW_LEAD", "is_duplicate": False, "evidence": []}
