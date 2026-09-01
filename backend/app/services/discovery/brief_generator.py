"""
Research brief generator.
Creates Account Intelligence Briefs from research data.
"""
from typing import Dict, Any, Optional, List
from app.models.discovery import DiscoveredOrganization
from app.services.discovery.project_matcher import match_projects


def generate_research_brief(
    disc_org: DiscoveredOrganization,
    research_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Generate an Account Intelligence Brief for a discovered organization."""
    if not research_data:
        research_data = {}

    signals = []
    for s in research_data.get("signals", []):
        if isinstance(s, dict):
            signals.append(s.get("description", ""))
        elif isinstance(s, str):
            signals.append(s)

    tech_signals = [s for s in signals if any(t in s.lower() for t in ["technology", "digital", "ai", "cloud", "automation", "platform", "integration"])]
    biz_signals = [s for s in signals if s not in tech_signals]

    sources = []
    for src in research_data.get("sources", []):
        if isinstance(src, dict):
            sources.append(src.get("url", ""))
        elif isinstance(src, str):
            sources.append(src)

    fit_score = disc_org.potential_fit_score or 50
    if fit_score >= 80:
        priority = "HIGH"
    elif fit_score >= 55:
        priority = "MEDIUM"
    else:
        priority = "LOW"

    why_contact = _build_why_contact(disc_org, research_data)
    opportunity = _build_opportunity(disc_org, research_data)
    approach = _build_approach(disc_org, research_data)
    risks = _build_risks(disc_org, research_data)

    return {
        "organization_name": disc_org.name,
        "fit_score": fit_score,
        "priority": priority,
        "company_overview": research_data.get("what_they_do") or disc_org.description or "",
        "what_they_do": research_data.get("what_they_do") or disc_org.description or "",
        "why_contact": why_contact,
        "potential_elly_opportunity": opportunity,
        "best_contact_role": _suggest_best_role(disc_org.organization_type),
        "recommended_approach": approach,
        "business_signals": biz_signals[:5],
        "technology_signals": tech_signals[:5],
        "recommended_showcase_projects": [],
        "risks_and_unknowns": risks,
        "sources": sources[:10],
    }


def _build_why_contact(disc_org, research):
    parts = []
    org_type = disc_org.organization_type or "organization"
    city = disc_org.city or disc_org.country or ""
    if city:
        parts.append(f"{disc_org.name} is a {org_type.lower()} based in {city}")
    else:
        parts.append(f"{disc_org.name} is a {org_type.lower()}")

    for s in research.get("signals", [])[:2]:
        desc = s.get("description", "") if isinstance(s, dict) else str(s)
        if desc:
            parts.append(desc)

    if not parts[0].endswith("."):
        parts[0] += "."
    return " ".join(parts)


def _build_opportunity(disc_org, research):
    obj = disc_org.discovery_objective or "technology partnership"
    return f"Potential {obj} opportunity with {disc_org.name}."


def _build_approach(disc_org, research):
    org_type = (disc_org.organization_type or "").lower()
    if "hospital" in org_type:
        return "Lead with operational intelligence and workflow optimization."
    if "technology" in org_type or "saas" in org_type:
        return "Lead with platform integration and technical architecture alignment."
    if "manufacturing" in org_type or "industrial" in org_type:
        return "Lead with operational efficiency and digital transformation value."
    return "Lead with business value and strategic alignment."


def _build_risks(disc_org, research):
    risks = []
    if not research:
        risks.append("No web research completed")
    if not disc_org.website:
        risks.append("No website available for research")
    if not research.get("digital_transformation"):
        risks.append("No public evidence of digital transformation initiatives")
    return risks[:3]


def _suggest_best_role(org_type):
    org_type = (org_type or "").lower()
    if "hospital" in org_type or "healthcare" in org_type:
        return "Chief Digital Officer or Head of Partnerships"
    if "technology" in org_type or "saas" in org_type or "software" in org_type:
        return "CTO or Head of Partnerships"
    if "manufacturing" in org_type or "industrial" in org_type:
        return "COO or VP of Business Development"
    if "fintech" in org_type or "financial" in org_type:
        return "CTO or Head of Innovation"
    return "Head of Business Development or CTO"
