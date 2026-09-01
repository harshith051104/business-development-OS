"""
Stagehand fallback — self-hosted browser scraping for JS-heavy sites.
Used only when primary scraping (httpx/ScrapeGraphAI) fails.

No Browserbase, no paid proxies. Local Chrome via CDP only.
"""
import asyncio
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy singleton: browser launched on first use, reused across requests
_browser = None
_stagehand = None
_last_request_time: float = 0.0
_MIN_DELAY_SECONDS = 2.0  # rate-limit: min gap between browser requests


async def _get_browser():
    """Launch local Chrome browser if not already running."""
    global _browser
    if _browser is not None:
        return _browser
    try:
        from stagehand import local_browser
        _browser = await local_browser.launch(headless=True)
        logger.info("Stagehand: local Chrome browser launched")
        return _browser
    except Exception as e:
        logger.warning("Stagehand: failed to launch browser: %s", e)
        _browser = None
        return None


async def _get_stagehand(browser):
    """Create Stagehand instance if not already running."""
    global _stagehand
    if _stagehand is not None:
        return _stagehand
    try:
        from stagehand import Stagehand
        # Stagehand needs an LLM for act/observe/extract, but we only use
        # page.goto() and page.content() — no LLM needed for basic scraping.
        # Pass a dummy key to satisfy the constructor; we won't use AI features.
        _stagehand = await Stagehand.create(
            browser=browser,
            model="openai/gpt-4.1-nano",
            model_api_key="dummy",
        )
        return _stagehand
    except Exception as e:
        logger.warning("Stagehand: failed to create instance: %s", e)
        _stagehand = None
        return None


def _wait_for_rate_limit():
    """Enforce minimum delay between requests."""
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_DELAY_SECONDS:
        time.sleep(_MIN_DELAY_SECONDS - elapsed)
    _last_request_time = time.time()


async def _fetch_with_stagehand(url: str, timeout: int = 30) -> Optional[str]:
    """
    Fetch rendered page content using Stagehand's local browser.
    Returns page text content or None on failure.
    """
    browser = await _get_browser()
    if browser is None:
        return None

    try:
        stagehand = await _get_stagehand(browser)
        if stagehand is None:
            return None

        pages = await browser.context.pages()
        page = pages[0] if pages else await browser.context.new_page()

        # Navigate with timeout
        await asyncio.wait_for(page.goto(url), timeout=timeout)

        # Wait for JavaScript to settle (network idle)
        try:
            await page.wait_for_load_state("networkidle", timeout=10)
        except Exception:
            pass  # Best effort — some pages never reach networkidle

        # Get rendered content
        content = await page.content()
        if not content or len(content) < 100:
            return None

        # Strip HTML tags for text content
        import re
        text = re.sub(r'<[^>]+>', ' ', content)
        text = re.sub(r'\s+', ' ', text).strip()

        return text if len(text) > 50 else None

    except asyncio.TimeoutError:
        logger.warning("Stagehand: timeout fetching %s", url)
        return None
    except Exception as e:
        logger.warning("Stagehand: error fetching %s: %s", url, str(e)[:100])
        return None


def fetch_rendered_content(url: str, timeout: int = 30) -> Optional[str]:
    """
    Synchronous wrapper. Fetch rendered page content via Stagehand.
    Returns page text or None on failure.

    Use ONLY when httpx/ScrapeGraphAI fails or site is JS-heavy.
    """
    _wait_for_rate_limit()

    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # We're inside an async context — run in new thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, _fetch_with_stagehand(url, timeout))
                return future.result(timeout=timeout + 10)
        elif loop:
            return loop.run_until_complete(_fetch_with_stagehand(url, timeout))
        else:
            return asyncio.run(_fetch_with_stagehand(url, timeout))
    except Exception as e:
        logger.warning("Stagehand: sync wrapper failed for %s: %s", url, str(e)[:100])
        return None


async def shutdown():
    """Clean shutdown of browser instance."""
    global _browser, _stagehand
    try:
        if _stagehand:
            await _stagehand.close()
            _stagehand = None
        if _browser:
            await _browser.close()
            _browser = None
        logger.info("Stagehand: browser shut down")
    except Exception as e:
        logger.warning("Stagehand: shutdown error: %s", e)
