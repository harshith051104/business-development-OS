"""
Prompt Parser for Single-Prompt Natural Language Lead Discovery.
Translates a single user prompt into structured discovery search parameters:
- keyword
- location
- organization_type
- product_description
- target_icp
- discovery_objective
- extracted_summary
"""
import json
import re
import logging
from typing import Dict, Any, Optional

from app.core.config import settings
from app.services.copilot.llm_router import LLMRouter

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are the ELLY Business Development Lead Discovery AI.
The user enters a single natural language request for business development lead discovery.
Your task is to analyze the prompt and output a STRICT JSON object with these exact keys:
- keyword: string (core search keyword, e.g. "FinTech payment infrastructure", "telemedicine platform")
- location: string (city, region, or country if specified, e.g. "London", "Hyderabad", "United States", or "")
- organization_type: string (e.g. "FinTech", "Hospital", "SaaS", "Enterprise", "Biotech", or "Company")
- product_description: string (what solution, service, or offering is being proposed, e.g. "SOC2 cloud infrastructure compliance")
- target_icp: string (ideal customer profile or target company attributes, e.g. "Series B FinTech companies with 50-200 employees")
- discovery_objective: string (commercial goal, e.g. "Commercial partnership", "Client acquisition", "Technical integration")
- extracted_summary: string (concise 1-sentence summary of the discovery mission)

Return ONLY valid JSON. No markdown formatting, no code blocks, no other text."""


def parse_discovery_prompt(prompt: str) -> Dict[str, Any]:
    """Parses a natural language discovery prompt using LLMRouter with NLP fallback."""
    clean_prompt = (prompt or "").strip()
    if not clean_prompt:
        return {
            "keyword": "",
            "location": "",
            "organization_type": "Company",
            "product_description": "",
            "target_icp": "",
            "discovery_objective": "Commercial Partnership",
            "extracted_summary": "General B2B lead discovery",
        }

    # Attempt LLM extraction via LLMRouter
    api_keys = {
        "groq": getattr(settings, "GROQ_API_KEY", "") or "",
        "nvidia": getattr(settings, "NVIDIA_NIM_API_KEY", "") or "",
        "gemini": getattr(settings, "GEMINI_API_KEY", "") or "",
    }

    if any(api_keys.values()):
        try:
            router = LLMRouter(api_keys=api_keys)
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": clean_prompt},
            ]
            response = router.chat(messages=messages, temperature=0.1, max_tokens=500)
            if response and response.content:
                raw = response.content.strip()
                # Remove code blocks if present
                if raw.startswith("```"):
                    raw = re.sub(r"^```(?:json)?\n?", "", raw)
                    raw = re.sub(r"\n?```$", "", raw)
                parsed = json.loads(raw.strip())
                return {
                    "keyword": parsed.get("keyword", "") or clean_prompt,
                    "location": parsed.get("location", "") or "",
                    "organization_type": parsed.get("organization_type", "Company") or "Company",
                    "product_description": parsed.get("product_description", "") or "",
                    "target_icp": parsed.get("target_icp", "") or clean_prompt,
                    "discovery_objective": parsed.get("discovery_objective", "Commercial Partnership") or "Commercial Partnership",
                    "extracted_summary": parsed.get("extracted_summary", clean_prompt) or clean_prompt,
                }
        except Exception as e:
            logger.warning("LLM prompt parsing failed, falling back to rule-based extractor: %s", e)

    # Deterministic Rule-Based Fallback
    return _rule_based_extract(clean_prompt)


def _rule_based_extract(prompt: str) -> Dict[str, Any]:
    """Fallback rule-based extraction for zero-latency / offline execution."""
    # 1. Location extraction: "in <Location>", "around <Location>", "near <Location>"
    loc_match = re.search(r"\b(?:in|around|near|across|based in)\s+([A-Z][a-zA-Z\s]+?)(?:(?=[\.,;]|\s+for|\s+that|\s+with|\s+who|\s+building|\s+needing|$))", prompt)
    location = loc_match.group(1).strip() if loc_match else ""

    # 2. Organization Type
    org_type = "Company"
    types_map = {
        r"\b(?:hospital|hospitals|healthcare|clinic|clinics|medical)\b": "Hospital",
        r"\b(?:fintech|fintechs|financial|bank|banking)\b": "FinTech",
        r"\b(?:saas|software|tech|technology|ai startup)\b": "SaaS",
        r"\b(?:logistics|supply chain|freight)\b": "Logistics",
        r"\b(?:manufacturing|factory|industrial)\b": "Manufacturing",
        r"\b(?:retail|e-commerce|ecommerce)\b": "Retail",
        r"\b(?:energy|cleantech|solar)\b": "Energy",
    }
    for pattern, t in types_map.items():
        if re.search(pattern, prompt, re.I):
            org_type = t
            break

    # 3. Objective
    objective = "Commercial Partnership"
    if re.search(r"\b(?:partner|partnership|allianc)\b", prompt, re.I):
        objective = "Strategic Partnership"
    elif re.search(r"\b(?:client|customer|sales|sell|buy)\b", prompt, re.I):
        objective = "Client Acquisition"
    elif re.search(r"\b(?:invest|investor|funding|vc)\b", prompt, re.I):
        objective = "Investment Outreach"
    elif re.search(r"\b(?:pilot|poc|trial|demo)\b", prompt, re.I):
        objective = "Technology Pilot / POC"

    # 4. Keyword
    # Remove leading command words
    kw = re.sub(r"^(?:find|discover|search for|look for|get|show me)\s+", "", prompt, flags=re.I).strip()
    if loc_match:
        kw = re.sub(r"\b(?:in|around|near|based in)\s+" + re.escape(location) + r"\b", "", kw, flags=re.I).strip()
    kw = re.sub(r"\s+", " ", kw).strip()

    return {
        "keyword": kw or prompt,
        "location": location,
        "organization_type": org_type,
        "product_description": f"Solutions aligned with: {prompt}",
        "target_icp": f"Organizations matching query: {prompt}",
        "discovery_objective": objective,
        "extracted_summary": f"Targeting {org_type} organizations{' in ' + location if location else ''} for {objective}.",
    }
