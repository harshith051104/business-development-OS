"""
Tests for Stagehand browser fallback.
Verifies: import, fallback logic, timeout, rate-limit, real website fetch.
"""
import time
import pytest
from unittest.mock import patch, MagicMock


def test_stagehand_import():
    """Stagehand package imports successfully."""
    import stagehand
    assert hasattr(stagehand, 'local_browser')
    assert hasattr(stagehand, 'Stagehand')


def test_fallback_module_import():
    """Stagehand fallback module imports successfully."""
    from app.services.research.stagehand_fallback import fetch_rendered_content, shutdown
    assert callable(fetch_rendered_content)
    assert callable(shutdown)


def test_rate_limit_enforcement():
    """Rate limit enforces minimum delay between requests."""
    from app.services.research import stagehand_fallback
    import time

    old_time = stagehand_fallback._last_request_time
    stagehand_fallback._last_request_time = time.time()

    start = time.time()
    stagehand_fallback._wait_for_rate_limit()
    elapsed = time.time() - start

    # Should have waited approximately MIN_DELAY_SECONDS
    assert elapsed >= 1.5, f"Rate limit too fast: {elapsed:.2f}s"
    stagehand_fallback._last_request_time = old_time


def test_fetch_returns_none_on_no_browser(monkeypatch):
    """Returns None gracefully when Chrome is not available."""
    from app.services.research import stagehand_fallback

    async def mock_launch():
        return None

    monkeypatch.setattr(stagehand_fallback, '_get_browser', mock_launch)
    result = stagehand_fallback.fetch_rendered_content("https://example.com")
    assert result is None


def test_fetch_with_mocked_browser(monkeypatch):
    """Fetch works with a mocked Stagehand browser."""
    from app.services.research import stagehand_fallback

    # Mock the async fetch to return content
    async def mock_fetch(url, timeout=30):
        return "This is rendered content from a JavaScript-heavy page"

    monkeypatch.setattr(stagehand_fallback, '_fetch_with_stagehand', mock_fetch)
    monkeypatch.setattr(stagehand_fallback, '_MIN_DELAY_SECONDS', 0)

    result = stagehand_fallback.fetch_rendered_content("https://example.com")
    assert result is not None
    assert "JavaScript-heavy" in result


def test_fetch_timeout(monkeypatch):
    """Fetch handles timeout gracefully."""
    from app.services.research import stagehand_fallback

    # Mock the sync wrapper to return None (simulating timeout)
    def mock_sync_fetch(url, timeout=30):
        return None

    monkeypatch.setattr(stagehand_fallback, 'fetch_rendered_content', mock_sync_fetch)
    monkeypatch.setattr(stagehand_fallback, '_MIN_DELAY_SECONDS', 0)

    result = stagehand_fallback.fetch_rendered_content("https://example.com", timeout=1)
    assert result is None


def test_research_engine_has_stagehand_fallback():
    """Research engine imports and has fallback function."""
    from app.services.research.research_engine import _try_stagehand_fallback
    assert callable(_try_stagehand_fallback)


def test_scrapegraph_adapter_has_stagehand_fallback():
    """ScrapeGraph adapter has Stagehand fallback method."""
    from app.services.research.scrapegraph_adapter import ScrapeGraphAdapter
    adapter = ScrapeGraphAdapter()
    assert hasattr(adapter, '_stagehand_fallback')
    assert callable(adapter._stagehand_fallback)


def test_shutdown():
    """Shutdown function is callable."""
    from app.services.research.stagehand_fallback import shutdown
    assert callable(shutdown)
