import logging
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Lazy import to avoid loading scrapegraphai at module level
_graph_config = None


def _get_config() -> dict:
    global _graph_config
    if _graph_config is not None:
        return _graph_config

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — scrapegraph enrichment disabled")
        return {}

    _graph_config = {
        "llm": {
            "model": "google_genai/gemini-3.8-flash",
            "api_key": api_key,
            "model_tokens": 100000,
            "temperature": 0,
        },
        "verbose": False,
        "headless": True,
    }
    return _graph_config


def scrape_organization(url: str) -> Dict[str, Any]:
    """
    Scrapes a single organization website and extracts structured B2B data.
    Returns dict with: name, description, organization_type, phone, email, city, country.
    """
    config = _get_config()
    if not config:
        return {}

    timeout = getattr(settings, "RESEARCH_TIMEOUT", 60)

    try:
        from scrapegraphai.graphs import SmartScraperGraph

        prompt = (
            "Extract from this organization page: "
            "1) organization name (official legal name), "
            "2) what they do (1-2 sentence description), "
            "3) organization type (SaaS, fintech, healthcare, manufacturing, AI company, etc.), "
            "4) phone number, "
            "5) email address (general/contact), "
            "6) city and country, "
            "7) industry or sector. "
            "Return as JSON with keys: name, description, organization_type, phone, email, city, country, industry."
        )

        def _run():
            graph = SmartScraperGraph(
                prompt=prompt,
                source=url,
                config=config,
            )
            return graph.run()

        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_run)
            result = future.result(timeout=timeout)

        return result if isinstance(result, dict) else {}
    except FuturesTimeoutError:
        logger.warning("Scrapegraph timed out for %s after %ds", url, timeout)
        return {}
    except Exception as e:
        logger.warning(f"Scrapegraph failed for {url}: {e}")
        return {}


def enrich_scraped_data(scraped: Dict[str, Any], original: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merges scraped data into original result, keeping original values
    when scraped data is empty (scraped supplements, doesn't replace).
    """
    result = dict(original)
    for key in ["name", "description", "organization_type", "phone", "email", "city", "country", "industry"]:
        scraped_val = scraped.get(key)
        if scraped_val and isinstance(scraped_val, str) and scraped_val.strip():
            # Only overwrite if original is empty or placeholder
            orig_val = result.get(key)
            if not orig_val or orig_val in ("Unknown", ""):
                result[key] = scraped_val.strip()
    return result
