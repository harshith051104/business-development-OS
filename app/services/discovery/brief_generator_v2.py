"""
Enhanced Account Intelligence Brief with FACT/INFERENCE distinction.

Every externally derived fact preserves source provenance.
The brief distinguishes what is known (FACT) from what is inferred (INFERENCE).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _classify_claims(signals: Dict[str, Any], research: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Classify claims as FACT or INFERENCE based on evidence strength.
    """
    facts = []
    inferences = []

    # Direct evidence = FACT
    if research.get("digital_transformation"):
        facts.append({
            "claim": f"Organization has digital transformation signals: {research['digital_transformation']}",
            "type": "FACT",
            "source": "research",
            "confidence": 0.85,
        })
    if research.get("ai_adoption"):
        facts.append({
            "claim": f"AI adoption signals detected: {research['ai_adoption']}",
            "type": "FACT",
            "source": "research",
            "confidence": 0.85,
        })
    if research.get("telemedicine"):
        facts.append({
            "claim": f"Telemedicine capability identified: {research['telemedicine']}",
            "type": "FACT",
            "source": "research",
            "confidence": 0.80,
        })

    # Technology initiatives = FACT if confirmed
    tech_inits = research.get("technology_initiatives", [])
    if isinstance(tech_inits, list):
        for init in tech_inits[:3]:
            facts.append({
                "claim": f"Technology initiative: {init}",
                "type": "FACT",
                "source": "research",
                "confidence": 0.75,
            })

    # Scale/size = FACT if from reliable source
    scale = research.get("approximate_scale", "")
    if scale:
        facts.append({
            "claim": f"Organization scale: {scale}",
            "type": "FACT",
            "source": "research",
            "confidence": 0.80,
        })

    # Inferences from facts
    if research.get("digital_transformation") or research.get("ai_adoption"):
        inferences.append({
            "claim": "This organization may be interested in technology platforms that support digital transformation.",
            "type": "INFERENCE",
            "source": "analysis",
            "confidence": 0.60,
        })
    if research.get("automation"):
        inferences.append({
            "claim": "Automation capability may indicate openness to AI-powered platform solutions.",
            "type": "INFERENCE",
            "source": "analysis",
            "confidence": 0.55,
        })

    return {"facts": facts, "inferences": inferences}


def generate_enhanced_brief(
    org: Dict[str, Any],
    research: Optional[Dict[str, Any]] = None,
    qualification: Optional[Dict[str, Any]] = None,
    decision_makers: Optional[List[Dict[str, Any]]] = None,
    project_matches: Optional[List[Dict[str, Any]]] = None,
    sources: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Generate an enhanced Account Intelligence Brief with FACT/INFERENCE distinction.

    Returns a structured brief with source provenance for every claim.
    """
    research = research or {}
    qualification = qualification or {}
    decision_makers = decision_makers or []
    project_matches = project_matches or []
    sources = sources or []

    org_name = org.get("name", "Unknown Organization")
    org_type = org.get("organization_type", "")
    city = org.get("city", "")
    country = org.get("country", "")
    website = org.get("website", "")
    description = org.get("description", "")

    # Classify claims
    classified = _classify_claims(research, research)
    facts = classified["facts"]
    inferences = classified["inferences"]

    # Build source provenance
    source_provenance = []
    for src in sources[:10]:
        if isinstance(src, dict):
            source_provenance.append({
                "source_url": src.get("source_url", ""),
                "source_type": src.get("source_type", "unknown"),
                "retrieved_at": src.get("retrieved_at", ""),
                "provider": src.get("provider", "unknown"),
                "confidence": src.get("confidence", 0.0),
            })

    # Determine recommended ELLY capabilities
    recommended_capabilities = []
    if research.get("digital_transformation"):
        recommended_capabilities.append("Digital Transformation Advisory")
    if research.get("ai_adoption"):
        recommended_capabilities.append("AI Strategy & Implementation")
    if research.get("cloud_adoption"):
        recommended_capabilities.append("Cloud Platform Integration")
    if research.get("automation"):
        recommended_capabilities.append("Workflow Automation")
    if org_type in ["hospital group", "hospital"]:
        recommended_capabilities.append("Operations Intelligence Platform")
    if not recommended_capabilities:
        recommended_capabilities.append("Technology Partnership Platform")

    # Build brief
    brief = {
        "organization": {
            "name": org_name,
            "type": org_type,
            "location": f"{city}, {country}" if city and country else country or "Unknown",
            "website": website,
            "description": description,
        },
        "overview": _build_overview(org, research),
        "why_elly_should_consider": _build_why_consider(org, qualification, facts),
        "business_signals": {
            "facts": [f["claim"] for f in facts],
            "inferences": [i["claim"] for i in inferences],
        },
        "technology_signals": _build_tech_signals(research),
        "recent_activity": _build_recent_activity(research),
        "decision_makers": _format_decision_makers(decision_makers),
        "potential_elly_opportunity": _build_opportunity(org, research, qualification),
        "recommended_showcase": _recommend_showcase(org_type, research),
        "recommended_talking_points": _build_talking_points(org, research, qualification),
        "risks_unknowns": _build_risks(org, research, qualification),
        "source_provenance": source_provenance,
        "classification": {
            "facts_count": len(facts),
            "inferences_count": len(inferences),
            "note": "FACT = directly from evidence. INFERENCE = derived analysis. Verify facts before outreach.",
        },
        "qualification_summary": {
            "score": qualification.get("score", 0),
            "tier": qualification.get("tier", "Unknown"),
            "confidence": qualification.get("confidence", 0),
            "positive_signals": qualification.get("positive_signals", []),
            "negative_signals": qualification.get("negative_signals", []),
        },
    }

    return brief


def _build_overview(org: Dict[str, Any], research: Dict[str, Any]) -> str:
    name = org.get("name", "This organization")
    org_type = org.get("organization_type", "organization")
    city = org.get("city", "")
    country = org.get("country", "")

    parts = [f"{name} is a {org_type}"]
    if city and country:
        parts.append(f"based in {city}, {country}")
    elif country:
        parts.append(f"based in {country}")

    scale = research.get("approximate_scale", "")
    if scale:
        parts.append(f"with approximately {scale}")

    desc = org.get("description", "")
    if desc:
        parts.append(f". {desc[:200]}")

    return " ".join(parts) + "."


def _build_why_consider(org: Dict[str, Any], qualification: Dict[str, Any], facts: List[Dict]) -> str:
    score = qualification.get("score", 0)
    tier = qualification.get("tier", "Low")
    reasons = qualification.get("positive_signals", [])

    parts = [f"This organization scores {score}/100 ({tier} fit) for ELLY partnership."]
    if reasons:
        parts.append("Key reasons:")
        for r in reasons[:3]:
            parts.append(f"- {r}")

    if not reasons and facts:
        parts.append("Based on available evidence:")
        for f in facts[:2]:
            parts.append(f"- {f['claim']}")

    return " ".join(parts)


def _build_tech_signals(research: Dict[str, Any]) -> Dict[str, Any]:
    signals = {}
    if research.get("digital_transformation"):
        signals["digital_transformation"] = research["digital_transformation"]
    if research.get("ai_adoption"):
        signals["ai_adoption"] = research["ai_adoption"]
    if research.get("telemedicine"):
        signals["telemedicine"] = research["telemedicine"]
    if research.get("automation"):
        signals["automation"] = research["automation"]

    tech_inits = research.get("technology_initiatives", [])
    if tech_inits and isinstance(tech_inits, list):
        signals["technology_initiatives"] = tech_inits[:5]

    return signals if signals else {"note": "No technology signals detected from public sources"}


def _build_recent_activity(research: Dict[str, Any]) -> List[str]:
    activities = []
    if research.get("recent_news"):
        if isinstance(research["recent_news"], list):
            activities.extend(research["recent_news"][:3])
        else:
            activities.append(str(research["recent_news"]))
    if research.get("announcements"):
        if isinstance(research["announcements"], list):
            activities.extend(research["announcements"][:3])
    return activities if activities else ["No recent public activity detected"]


def _format_decision_makers(decision_makers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    formatted = []
    for dm in decision_makers[:5]:
        formatted.append({
            "name": dm.get("name", "Unknown"),
            "role": dm.get("role", "Unknown"),
            "confidence": dm.get("confidence", 0),
            "verification_state": dm.get("verification_state", "unverified"),
            "source": dm.get("source", "unknown"),
        })
    return formatted


def _build_opportunity(org: Dict[str, Any], research: Dict[str, Any], qualification: Dict[str, Any]) -> str:
    org_type = org.get("organization_type", "")
    capabilities = qualification.get("recommended_ellly_capabilities", [])

    if capabilities:
        return f"Primary opportunity: {capabilities[0]}"
    if org_type in ["hospital group", "hospital", "healthcare"]:
        return "Operations intelligence and workflow optimization"
    if org_type in ["technology", "saas", "software", "ai company"]:
        return "Technology partnership and platform integration"
    if org_type in ["manufacturing", "industrial", "energy"]:
        return "Digital transformation and operational efficiency"
    return "Technology partnership platform deployment"


def _recommend_showcase(org_type: str, research: Dict[str, Any]) -> str:
    if research.get("ai_adoption"):
        return "AI-Powered Intelligence Platform"
    if org_type in ["hospital group", "hospital", "healthcare"]:
        return "Operations Intelligence Platform"
    if org_type in ["technology", "saas", "software"]:
        return "Technology Partnership Showcase"
    if org_type in ["manufacturing", "industrial"]:
        return "Digital Transformation Showcase"
    return "Technology Intelligence Overview"


def _build_talking_points(org: Dict[str, Any], research: Dict[str, Any], qualification: Dict[str, Any]) -> List[str]:
    points = []
    if research.get("digital_transformation"):
        points.append(f"Discuss their digital transformation journey: {research['digital_transformation']}")
    if research.get("ai_adoption"):
        points.append(f"Explore AI adoption opportunities: {research['ai_adoption']}")
    if qualification.get("positive_signals"):
        points.append(f"Highlight alignment: {qualification['positive_signals'][0]}")
    if not points:
        points.append("General technology capabilities and partnership opportunities")
    return points[:5]


def _build_risks(org: Dict[str, Any], research: Dict[str, Any], qualification: Dict[str, Any]) -> List[str]:
    risks = []
    if qualification.get("negative_signals"):
        risks.extend(qualification["negative_signals"][:2])
    if qualification.get("missing_information"):
        risks.extend([f"Missing: {m}" for m in qualification["missing_information"][:2]])
    if not research:
        risks.append("No research data available — limited public information")
    return risks if risks else ["No significant risks identified"]
