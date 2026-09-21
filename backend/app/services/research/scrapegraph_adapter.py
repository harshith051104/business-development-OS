"""
ScrapeGraphAI adapter — wraps SmartScraperGraph for organization research.
Separate from research_engine for clean dependency boundary.
Stagehand browser fallback for JS-heavy sites.
"""
import logging
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from app.core.config import settings

logger = logging.getLogger(__name__)


class ScrapeGraphAdapter:
    """Adapter for ScrapeGraphAI web scraping with Stagehand browser fallback."""

    def __init__(self):
        self._config = None

    def _get_config(self) -> Optional[dict]:
        if self._config is not None:
            return self._config

        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return None

        self._config = {
            "llm": {
                "model": "google_genai/gemini-3.8-flash",
                "api_key": api_key,
                "model_tokens": 100000,
                "temperature": 0,
            },
            "verbose": False,
            "headless": True,
        }
        return self._config

    def is_available(self) -> bool:
        return self._get_config() is not None

    def scrape(self, url: str, prompt: str) -> Dict[str, Any]:
        """Scrape a URL with a custom prompt. Returns raw dict.
        Falls back to Stagehand browser on failure.
        """
        config = self._get_config()
        if not config:
            return self._stagehand_fallback(url)

        timeout = getattr(settings, "RESEARCH_TIMEOUT", 60)

        try:
            from scrapegraphai.graphs import SmartScraperGraph

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

            if isinstance(result, dict):
                # Check for blocked/empty results
                non_na = [v for v in result.values() if v and str(v).strip() != "NA"]
                if len(non_na) > 1:
                    return result

            # ScrapeGraphAI returned empty/blocked — try Stagehand
            logger.info("ScrapeGraph: empty result for %s, trying Stagehand", url)
            return self._stagehand_fallback(url, prompt)

        except FuturesTimeoutError:
            logger.warning("ScrapeGraph scrape timed out for %s after %ds", url, timeout)
            return self._stagehand_fallback(url, prompt)
        except Exception as e:
            logger.warning(f"ScrapeGraph scrape failed for {url}: {e}")
            return self._stagehand_fallback(url, prompt)

    def _stagehand_fallback(self, url: str, prompt: str = "") -> Dict[str, Any]:
        """Fallback to Stagehand browser for JS-heavy or blocked sites."""
        try:
            from app.services.research.stagehand_fallback import fetch_rendered_content

            logger.info("Stagehand adapter fallback: fetching %s", url)
            content = fetch_rendered_content(url, timeout=30)
            if not content:
                return {}

            # Return raw content for the caller to process
            return {
                "content": content[:8000],
                "source": "stagehand_browser",
                "url": url,
            }
        except Exception as e:
            logger.warning("Stagehand adapter fallback failed for %s: %s", url, str(e)[:100])
            return {}

    def scrape_organization(self, url: str) -> Dict[str, Any]:
        """Scrape organization homepage for basic profile data."""
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
        return self.scrape(url, prompt)

    def scrape_deep_research(self, url: str) -> Dict[str, Any]:
        """Deep research scrape for full business intelligence."""
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
            "14) Any partnership announcements\n\n"
            "Return as JSON with keys: official_name, what_they_do, "
            "industry, organization_type, headquarters, locations, "
            "approximate_scale, services, specialties, business_model, "
            "market_presence, recent_expansion, strategic_initiatives, "
            "technology_initiatives, ai_adoption, digital_transformation, "
            "cloud_adoption, automation."
        )
        return self.scrape(url, prompt)


# Singleton
scrapegraph_adapter = ScrapeGraphAdapter()
