"""
LLM-based qualification with hybrid deterministic + LLM scoring.

Architecture:
  deterministic_score (7 factors, weights sum to 100)
  + llm_fit_score (from LLM with research evidence)
  + llm_confidence
  = final_score (documented combination)

The LLM receives ONLY:
  - Product context / ICP
  - Organization information
  - Research evidence / signals
  - Public source information

It must return structured JSON. Free-form output does NOT control DB writes.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

QUALIFICATION_PROMPT = """You are a B2B qualification analyst for ELLY.

Analyze the following organization and determine fit for ELLY's technology partnership platform.

## Product Context
{product_context}

## Target ICP
{target_icp}

## Business Objective
{discovery_objective}

## Organization Information
{org_info}

## Research Evidence
{research_evidence}

## Research Signals
{research_signals}

## Public Source Information
{source_info}

Return ONLY a JSON object with these exact fields:
{{
  "score": <number 0-100>,
  "confidence": <number 0.0-1.0>,
  "reasons": ["<reason1>", "<reason2>", ...],
  "positive_signals": ["<signal1>", "<signal2>", ...],
  "negative_signals": ["<signal1>", ...],
  "missing_information": ["<info1>", ...],
  "recommended_contact_roles": ["<role1>", "<role2>", ...],
  "recommended_ellly_capabilities": ["<capability1>", ...]
}}

Rules:
- Score is the LLM's assessment of fit (0-100)
- Confidence is how confident the LLM is in its own score (0.0-1.0)
- Reasons must be specific and evidence-based
- Do NOT fabricate information
- If research is incomplete, note what is missing
- Do NOT output anything except the JSON object
"""


def _build_org_info(org: Dict[str, Any]) -> str:
    lines = []
    for key in ["name", "organization_type", "city", "country", "website", "description", "approximate_scale"]:
        val = org.get(key, "")
        if val:
            lines.append(f"- {key}: {val}")
    return "\n".join(lines) if lines else "No organization information available"


def _build_research_evidence(research: Dict[str, Any]) -> str:
    if not research:
        return "No research available"
    lines = []
    for key in ["summary", "digital_transformation", "ai_adoption", "automation", "cloud_adoption", "technology_initiatives"]:
        val = research.get(key)
        if val:
            lines.append(f"- {key}: {val}")
    tech_inits = research.get("technology_initiatives", [])
    if tech_inits and isinstance(tech_inits, list):
        lines.append(f"- technology_initiatives: {', '.join(str(t) for t in tech_inits[:5])}")
    return "\n".join(lines) if lines else "Limited research signals"


def _build_research_signals(signals: Any) -> str:
    if not signals:
        return "No signals"
    if isinstance(signals, list):
        return "\n".join(f"- {s}" for s in signals[:10])
    if isinstance(signals, dict):
        return "\n".join(f"- {k}: {v}" for k, v in list(signals.items())[:10])
    return str(signals)[:500]


def _build_source_info(sources: Any) -> str:
    if not sources:
        return "No source information"
    if isinstance(sources, list):
        return "\n".join(f"- {s.get('source_url', s.get('source', 'unknown'))}" if isinstance(s, dict) else f"- {s}" for s in sources[:5])
    return str(sources)[:300]


def _parse_llm_response(content: str) -> Dict[str, Any]:
    """Parse LLM JSON response, handling markdown code blocks."""
    if not content:
        return {}

    # Try direct JSON parse first
    content = content.strip()
    if content.startswith("{"):
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass

    # Try extracting from markdown code block
    import re
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Try finding first { to last }
    first = content.find("{")
    last = content.rfind("}")
    if first != -1 and last > first:
        try:
            return json.loads(content[first:last + 1])
        except json.JSONDecodeError:
            pass

    logger.warning("Failed to parse LLM qualification response")
    return {}


def llm_qualify(
    org: Dict[str, Any],
    research: Optional[Dict[str, Any]] = None,
    signals: Any = None,
    sources: Any = None,
    product_description: str = "",
    target_icp: str = "",
    discovery_objective: str = "",
    deterministic_score: float = 0.0,
    deterministic_tier: str = "Low",
    deterministic_confidence: float = 0.7,
) -> Dict[str, Any]:
    """
    Run LLM qualification and combine with deterministic score.

    Returns:
        {
            "deterministic_score": float,
            "deterministic_tier": str,
            "llm_score": int,
            "llm_confidence": float,
            "final_score": float,
            "confidence": float,
            "reasons": list,
            "positive_signals": list,
            "negative_signals": list,
            "missing_information": list,
            "recommended_contact_roles": list,
            "recommended_ellly_capabilities": list,
            "source": "llm",
            "error": str or None,
        }
    """
    from app.core.config import settings
    from app.services.copilot.llm_router import LLMRouter

    research = research or {}
    product_ctx = product_description or "ELLY technology partnership platform for digital transformation and technology partnership development."
    icp = target_icp or "Enterprise organizations seeking technology partnerships and digital transformation solutions"
    objective = discovery_objective or "Identify technology partnership opportunities"

    prompt = QUALIFICATION_PROMPT.format(
        product_context=product_ctx,
        target_icp=icp,
        discovery_objective=objective,
        org_info=_build_org_info(org),
        research_evidence=_build_research_evidence(research),
        research_signals=_build_research_signals(signals),
        source_info=_build_source_info(sources),
    )

    router = LLMRouter()
    llm_response = router.call(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=1000,
    )

    if llm_response.error:
        # LLM failed — return deterministic-only result
        return {
            "deterministic_score": deterministic_score,
            "deterministic_tier": deterministic_tier,
            "llm_score": None,
            "llm_confidence": None,
            "final_score": deterministic_score,
            "confidence": deterministic_confidence,
            "reasons": [],
            "positive_signals": [],
            "negative_signals": [],
            "missing_information": [],
            "recommended_contact_roles": [],
            "recommended_ellly_capabilities": [],
            "source": "deterministic",
            "error": f"LLM unavailable: {llm_response.error}",
        }

    parsed = _parse_llm_response(llm_response.content or "")

    llm_score = parsed.get("score", 50)
    llm_confidence = parsed.get("confidence", 0.5)

    # Validate bounds
    llm_score = max(0, min(100, int(llm_score)) if isinstance(llm_score, (int, float)) else 50)
    llm_confidence = max(0.0, min(1.0, float(llm_confidence)) if isinstance(llm_confidence, (int, float)) else 0.5)

    # Hybrid combination: weighted average based on LLM confidence
    # deterministic weight = (1 - llm_confidence), llm weight = llm_confidence
    final_score = deterministic_score * (1 - llm_confidence) + llm_score * llm_confidence
    final_score = max(0, min(100, round(final_score, 1)))

    # Combined confidence: if both agree, higher; if they diverge, lower
    score_diff = abs(deterministic_score - llm_score)
    confidence_penalty = min(0.2, score_diff / 200)
    combined_confidence = max(0.1, min(1.0, deterministic_confidence * 0.4 + llm_confidence * 0.6 - confidence_penalty))

    if final_score >= 80:
        final_tier = "High"
    elif final_score >= 55:
        final_tier = "Medium"
    else:
        final_tier = "Low"

    return {
        "deterministic_score": deterministic_score,
        "deterministic_tier": deterministic_tier,
        "llm_score": llm_score,
        "llm_confidence": llm_confidence,
        "final_score": final_score,
        "final_tier": final_tier,
        "confidence": round(combined_confidence, 2),
        "reasons": parsed.get("reasons", []),
        "positive_signals": parsed.get("positive_signals", []),
        "negative_signals": parsed.get("negative_signals", []),
        "missing_information": parsed.get("missing_information", []),
        "recommended_contact_roles": parsed.get("recommended_contact_roles", []),
        "recommended_ellly_capabilities": parsed.get("recommended_ellly_capabilities", []),
        "source": "hybrid",
        "error": None,
    }
