"""
Clean-room AI Qualification & Fit Reasoning Engine.
Evaluates B2B Organization & Decision-Maker alignment against Product Offering Context,
Target ICP, and Discovery Objectives without storing clinical data or fabricating contacts.
"""
from typing import Dict, Any, Optional, Tuple, List


def qualify_organization(
    org: Dict[str, Any],
    product_description: Optional[str] = None,
    target_icp: Optional[str] = None,
    discovery_objective: Optional[str] = None,
) -> Tuple[str, int, str]:
    """
    Qualifies an organization against the BD search criteria and produces:
    - fit_level: "High" | "Medium" | "Low"
    - score: 0 to 100
    - fit_reason: Concise, human-readable rationale
    """
    name = org.get("name", "")
    org_type = org.get("organization_type", "Unknown")
    desc = org.get("description", "")
    city = org.get("city", "")
    country = org.get("country", "Unknown")

    # Lowercase text for matching
    combined_text = f"{name} {org_type} {desc} {city} {country}".lower()
    p_desc = (product_description or "").lower()
    icp = (target_icp or "").lower()
    obj = (discovery_objective or "").lower()

    score = 65
    reasons = []

    # 1. Evaluate Organization Scale & Type Fit
    if org_type in ["Technology Company", "SaaS Company", "Software Company", "AI Company", "Fintech Company", "Financial Services"]:
        score += 15
        reasons.append(f"Technology-focused {org_type.lower()} with strong digital platform fit")
    elif org_type in ["Hospital Group", "Hospital", "Healthcare Technology", "Healthcare"]:
        score += 12
        reasons.append(f"Established {org_type.lower()} with relevant operational infrastructure")
    elif org_type in ["Manufacturing", "Industrial", "Energy", "Logistics"]:
        score += 10
        reasons.append(f"Enterprise {org_type.lower()} with digital transformation opportunity")
    elif org_type in ["Consulting", "Professional Services", "Retail", "E-commerce"]:
        score += 8
        reasons.append(f"Service-oriented {org_type.lower()}")
        reasons.append(f"Specialized {org_type.lower()} provider")

    # 2. Evaluate Objective Alignment
    if "ai" in p_desc or "ai" in obj or "technology" in p_desc or "technology" in obj:
        if any(term in combined_text for term in ["multi-location", "enterprise", "technology", "network", "advanced", "digital"]):
            score += 10
            reasons.append("Demonstrated capacity for technology adoption and advanced digital integration")
        else:
            reasons.append("Potential candidate for technology platform evaluation")

    if "partner" in obj or "alliance" in obj or "collaboration" in obj:
        if any(term in combined_text for term in ["network", "enterprise", "group", "leading", "integrated"]):
            score += 10
            reasons.append("Strong strategic footprint suitable for partnership agreements")

    # 3. Evaluate Location & Target ICP
    if icp:
        # Check if keywords in ICP match
        icp_keywords = [w for w in icp.replace(",", " ").split() if len(w) > 3]
        matches = [w for w in icp_keywords if w in combined_text]
        if len(matches) >= 2:
            score += 10
            reasons.append(f"Directly matches targeted profile criteria: {', '.join(matches[:3])}")

    # Cap score
    score = min(98, max(30, score))

    if score >= 80:
        fit_level = "High"
    elif score >= 60:
        fit_level = "Medium"
    else:
        fit_level = "Low"

    # Construct concise, professional reason
    if not reasons:
        reasons.append(f"{org_type} operating in {city or country} aligned with business outreach parameters.")

    fit_reason = ". ".join(reasons) + "."
    return fit_level, score, fit_reason


def qualify_contact(
    contact: Dict[str, Any],
    organization_name: str,
    organization_type: Optional[str] = None,
    product_description: Optional[str] = None,
    discovery_objective: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Qualifies a decision-maker contact for business development relevance.
    Returns (fit_level, fit_reason).
    """
    title = contact.get("job_title", "").lower()
    dept = contact.get("department", "").lower()
    p_desc = (product_description or "").lower()
    obj = (discovery_objective or "").lower()

    # Strategic leadership & executive management
    if any(term in title for term in ["managing director", "chief executive", "ceo", "president", "director"]):
        return (
            "High",
            f"Key executive decision-maker with oversight over strategic partnerships and institutional agreements at {organization_name}."
        )

    # Technology & Digital Innovation
    if any(term in title for term in ["chief technology", "cto", "chief digital", "cdo", "chief information", "cio", "digital transformation", "innovation"]):
        return (
            "High",
            f"Directly leads technology evaluation, digital modernization, and enterprise architecture decisions for {organization_name}."
        )

    # Business Development & Alliances
    if any(term in title for term in ["business development", "partnerships", "alliances", "strategic growth", "commercial"]):
        return (
            "High",
            f"Manages external commercial partnerships, vendor collaborations, and strategic initiatives at {organization_name}."
        )

    # Operations & Clinical Strategy
    if any(term in title for term in ["chief medical", "medical director", "operations", "coo"]):
        return (
            "Medium",
            f"Senior operational leader involved in evaluating operational enhancements and departmental initiatives at {organization_name}."
        )

    return (
        "Medium",
        f"Relevant professional stakeholder at {organization_name} within the {contact.get('department', 'Management')} department."
    )
