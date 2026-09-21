"""
Deep website research engine using ScrapeGraphAI.
Given an organization URL, extracts structured business intelligence.
"""
import json
import logging
import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from app.core.config import settings
from app.services.research.research_schemas import (
    OrganizationResearch, ResearchSource, ResearchSignal,
)

logger = logging.getLogger(__name__)

# Cache: domain -> (research_dict, timestamp)
_research_cache: Dict[str, tuple] = {}
CACHE_TTL_SECONDS = getattr(settings, "RESEARCH_CACHE_TTL_HOURS", 24) * 3600

# Rate-control: last request timestamp for minimum delay enforcement
_last_request_time: float = 0.0


def _get_cache_key(url: str) -> str:
    """Normalize URL to domain for cache key."""
    return (
        url.strip().lower()
        .replace("https://", "")
        .replace("http://", "")
        .replace("www.", "")
        .split("/")[0]
    )


def _check_cache(url: str) -> Optional[Dict[str, Any]]:
    key = _get_cache_key(url)
    if key in _research_cache:
        data, ts = _research_cache[key]
        if time.time() - ts < CACHE_TTL_SECONDS:
            return data
        del _research_cache[key]
    return None


def _set_cache(url: str, data: Dict[str, Any]):
    key = _get_cache_key(url)
    _research_cache[key] = (data, time.time())


def _wait_for_rate_limit():
    """Enforce minimum delay between ScrapeGraphAI requests."""
    global _last_request_time
    delay = getattr(settings, "RESEARCH_DELAY_BETWEEN_REQUESTS", 1.5)
    elapsed = time.time() - _last_request_time
    if elapsed < delay:
        time.sleep(delay - elapsed)
    _last_request_time = time.time()


def _run_with_timeout(func, timeout: int = 60):
    """Run a function with a timeout using ThreadPoolExecutor."""
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(func)
        try:
            return future.result(timeout=timeout)
        except FuturesTimeoutError:
            raise TimeoutError(f"Operation timed out after {timeout}s")


def research_organization(url: str, force_refresh: bool = False) -> Dict[str, Any]:
    """
    Research an organization by scraping its website.
    Returns structured research data with sources and signals.
    """
    if not force_refresh:
        cached = _check_cache(url)
        if cached:
            return cached

    config = _build_config()
    if not config:
        return {"research_status": "failed", "error": "ScrapeGraph not configured"}

    timeout = getattr(settings, "RESEARCH_TIMEOUT", 60)

    try:
        _wait_for_rate_limit()

        from scrapegraphai.graphs import SmartScraperGraph

        prompt = (
            "Research this organization thoroughly and extract:\n"
            "1) Official company name\n"
            "2) What they do (detailed description)\n"
            "3) Industry and organization type\n"
            "4) Headquarters location\n"
            "5) All known locations/branches\n"
            "6) Approximate size (employees, beds, locations)\n"
            "7) Key services offered\n"
            "8) Specialties and focus areas\n"
            "9) Business model description\n"
            "10) Market presence and reach\n"
            "11) Any recent expansion or growth news\n"
            "12) Strategic initiatives mentioned\n"
            "13) Technology adoption: AI, digital transformation, "
            "cloud adoption, automation, data platforms\n"
            "14) Any partnership announcements\n"
            "15) Leadership team if mentioned\n\n"
            "Return as JSON with keys: official_name, what_they_do, "
            "industry, organization_type, headquarters, locations, "
            "approximate_scale, services, specialties, business_model, "
            "market_presence, recent_expansion, strategic_initiatives, "
            "technology_initiatives, ai_adoption, digital_transformation, "
            "cloud_adoption, automation."
        )

        def _scrape():
            graph = SmartScraperGraph(
                prompt=prompt,
                source=url,
                config=config,
            )
            return graph.run()

        raw = _run_with_timeout(_scrape, timeout=timeout)

        if not isinstance(raw, dict):
            raw = {}

        # Unwrap {"content": {...}} wrapper from ScrapeGraphAI
        if "content" in raw and isinstance(raw["content"], dict):
            raw = raw["content"]

        # Detect Access Denied / blocked pages — all values "NA"
        non_na_values = [v for v in raw.values() if v and str(v).strip() != "NA"]
        if len(non_na_values) <= 1:
            # ScrapeGraphAI failed — try Stagehand browser fallback
            stagehand_result = _try_stagehand_fallback(url)
            if stagehand_result:
                return stagehand_result
            return {
                "research_status": "blocked",
                "error": "Website blocked scraping or returned no useful content",
                "website": url,
            }

        # Build structured result
        result = _normalize_research(raw, url)
        _set_cache(url, result)
        return result

    except TimeoutError as e:
        logger.warning("Research timed out for %s: %s", url, e)
        # ScrapeGraphAI timed out — try Stagehand browser fallback
        stagehand_result = _try_stagehand_fallback(url)
        if stagehand_result:
            return stagehand_result
        return {"research_status": "timeout", "error": str(e), "website": url}
    except Exception as e:
        logger.warning(f"Research failed for {url}: {e}")
        # ScrapeGraphAI failed — try Stagehand browser fallback
        stagehand_result = _try_stagehand_fallback(url)
        if stagehand_result:
            return stagehand_result
        return {"research_status": "failed", "error": str(e)}


def _build_config() -> Optional[dict]:
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return None
    return {
        "llm": {
            "model": "google_genai/gemini-3.8-flash",
            "api_key": api_key,
            "model_tokens": 100000,
            "temperature": 0,
        },
        "verbose": False,
        "headless": True,
    }


def _fetch_with_httpx(url: str, timeout: int = 15) -> Optional[str]:
    """Fallback to direct HTTP text extraction when browser cannot launch or fails."""
    try:
        import httpx
        import re
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = httpx.get(url, headers=headers, timeout=timeout, follow_redirects=True)
        if resp.status_code == 200 and resp.text:
            text = re.sub(r'<script[^>]*>[\s\S]*?</script>', ' ', resp.text, flags=re.I)
            text = re.sub(r'<style[^>]*>[\s\S]*?</style>', ' ', text, flags=re.I)
            text = re.sub(r'<[^>]+>', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()
            return text if len(text) > 50 else None
    except Exception as e:
        logger.debug("HTTP fallback failed for %s: %s", url, e)
    return None


def _try_stagehand_fallback(url: str) -> Optional[Dict[str, Any]]:
    """
    Stagehand browser fallback — renders JS-heavy sites with local Chrome.
    Only used when ScrapeGraphAI fails/blocks/times out.
    Returns structured research dict or None.
    """
    try:
        from app.services.research.stagehand_fallback import fetch_rendered_content
        from app.services.copilot.llm_router import LLMRouter

        logger.info("Stagehand fallback: fetching %s", url)
        content = fetch_rendered_content(url, timeout=30)
        if not content:
            logger.info("Stagehand browser unavailable — trying direct HTTP text fallback for %s", url)
            content = _fetch_with_httpx(url, timeout=15)
        if not content:
            return None

        # Truncate to avoid blowing up LLM context
        content = content[:8000]

        # Use our LLM to analyze the rendered content
        analysis_prompt = (
            "Analyze this website content and extract business intelligence.\n"
            "Return a JSON object with these keys:\n"
            "- official_name: Company legal name\n"
            "- what_they_do: What the company does (2-3 sentences)\n"
            "- industry: Primary industry\n"
            "- organization_type: Company type (SaaS, fintech, etc)\n"
            "- headquarters: HQ location\n"
            "- locations: List of known locations\n"
            "- services: List of key services/products\n"
            "- specialties: List of specialties\n"
            "- technology_initiatives: List of tech initiatives mentioned\n"
            "- ai_adoption: AI adoption notes if any\n"
            "- digital_transformation: Digital transformation notes if any\n"
            "- recent_expansion: Recent growth/expansion news if any\n\n"
            f"Website content:\n{content}"
        )

        router = LLMRouter()
        response = router.chat(
            messages=[{"role": "user", "content": analysis_prompt}],
            temperature=0,
            max_tokens=2000,
        )
        response = response.content if response else None

        if not response:
            return None

        # Parse LLM response as JSON
        text = response.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        raw = json.loads(text)
        if not isinstance(raw, dict):
            return None

        result = _normalize_research(raw, url)
        result["research_source"] = "stagehand_browser"
        _set_cache(url, result)
        logger.info("Stagehand fallback: success for %s", url)
        return result

    except json.JSONDecodeError:
        logger.warning("Stagehand fallback: LLM returned invalid JSON for %s", url)
        return None
    except Exception as e:
        logger.warning("Stagehand fallback: failed for %s: %s", url, str(e)[:100])
        return None


def _normalize_research(raw: Dict[str, Any], url: str) -> Dict[str, Any]:
    """Normalize raw scrape output into structured research."""
    source = ResearchSource(
        url=url,
        source_type="website",
        confidence=0.8,
        timestamp=datetime.now(timezone.utc),
    )

    # Extract signals
    signals = []
    tech_initiatives = raw.get("technology_initiatives", [])
    if isinstance(tech_initiatives, str):
        tech_initiatives = [tech_initiatives]

    for init in tech_initiatives:
        if isinstance(init, str) and init.strip():
            signals.append(ResearchSignal(
                type="technology_initiative",
                description=init.strip(),
                source_url=url,
                confidence=0.7,
                category="technology",
            ).model_dump())

    if raw.get("ai_adoption"):
        signals.append(ResearchSignal(
            type="ai_adoption",
            description=str(raw["ai_adoption"]),
            source_url=url,
            confidence=0.75,
            category="technology",
        ).model_dump())

    if raw.get("digital_transformation"):
        signals.append(ResearchSignal(
            type="digital_transformation",
            description=str(raw["digital_transformation"]),
            source_url=url,
            confidence=0.75,
            category="technology",
        ).model_dump())

    if raw.get("recent_expansion"):
        signals.append(ResearchSignal(
            type="expansion",
            description=str(raw["recent_expansion"]),
            source_url=url,
            confidence=0.7,
            category="business",
        ).model_dump())

    strategic = raw.get("strategic_initiatives", [])
    if isinstance(strategic, str):
        strategic = [strategic]
    for init in strategic:
        if isinstance(init, str) and init.strip():
            signals.append(ResearchSignal(
                type="strategic_initiative",
                description=init.strip(),
                source_url=url,
                confidence=0.65,
                category="business",
            ).model_dump())

    services = raw.get("services", [])
    if isinstance(services, str):
        services = [s.strip() for s in services.split(",") if s.strip()]

    specialties = raw.get("specialties", [])
    if isinstance(specialties, str):
        specialties = [s.strip() for s in specialties.split(",") if s.strip()]

    locations = raw.get("locations", [])
    if isinstance(locations, str):
        locations = [l.strip() for l in locations.split(",") if l.strip()]

    return {
        "organization_name": raw.get("official_name") or raw.get("name", "Unknown"),
        "website": url,
        "official_name": raw.get("official_name"),
        "industry": raw.get("industry"),
        "organization_type": raw.get("organization_type"),
        "headquarters": raw.get("headquarters"),
        "locations": locations,
        "approximate_scale": raw.get("approximate_scale"),
        "services": services,
        "specialties": specialties,
        "what_they_do": raw.get("what_they_do"),
        "business_model": raw.get("business_model"),
        "market_presence": raw.get("market_presence"),
        "recent_expansion": raw.get("recent_expansion"),
        "strategic_initiatives": strategic if isinstance(strategic, list) else [],
        "ai_adoption": raw.get("ai_adoption"),
        "digital_transformation": raw.get("digital_transformation"),
        "cloud_adoption": raw.get("cloud_adoption") or raw.get("telemedicine"),
        "automation": raw.get("automation"),
        "technology_initiatives": tech_initiatives,
        "sources": [source.model_dump()],
        "signals": signals,
        "research_timestamp": datetime.now(timezone.utc).isoformat(),
        "research_status": "completed",
    }


def clear_research_cache():
    """Clear all cached research results."""
    _research_cache.clear()
