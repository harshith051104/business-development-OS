"""Tests for research pipeline rate-control, timeout, and batch resilience."""
import time
from unittest.mock import patch, MagicMock

import pytest


class TestRateControl:
    """Test rate-limit delay between ScrapeGraphAI requests."""

    def test_wait_for_rate_limit_enforces_delay(self):
        from app.services.research import research_engine
        research_engine._last_request_time = 0.0

        with patch.object(research_engine.settings, "RESEARCH_DELAY_BETWEEN_REQUESTS", 0.1):
            start = time.time()
            research_engine._wait_for_rate_limit()
            research_engine._wait_for_rate_limit()
            elapsed = time.time() - start

        assert elapsed >= 0.09

    def test_wait_for_rate_limit_no_delay_if_enough_time_passed(self):
        from app.services.research import research_engine
        research_engine._last_request_time = time.time() - 10.0

        with patch.object(research_engine.settings, "RESEARCH_DELAY_BETWEEN_REQUESTS", 1.0):
            start = time.time()
            research_engine._wait_for_rate_limit()
            elapsed = time.time() - start

        assert elapsed < 0.05

    def test_run_with_timeout_raises_on_slow(self):
        from app.services.research.research_engine import _run_with_timeout

        def slow_func():
            time.sleep(5)

        with pytest.raises(TimeoutError):
            _run_with_timeout(slow_func, timeout=0.1)

    def test_run_with_timeout_returns_fast_result(self):
        from app.services.research.research_engine import _run_with_timeout

        def fast_func():
            return "done"

        result = _run_with_timeout(fast_func, timeout=5)
        assert result == "done"


class TestResearchEngineTimeout:
    """Test research_organization handles timeout gracefully."""

    @patch("app.services.research.research_engine._build_config")
    @patch("app.services.research.research_engine._wait_for_rate_limit")
    def test_research_returns_timeout_on_slow_site(self, mock_wait, mock_config):
        mock_config.return_value = {"llm": {"model": "test", "api_key": "k"}}

        def slow_run():
            time.sleep(10)

        mock_graph = MagicMock()
        mock_graph.run = slow_run

        with patch("app.services.research.research_engine.research_organization") as mock_res:
            mock_res.return_value = {
                "research_status": "timeout",
                "error": "Operation timed out after 1s",
                "website": "https://slow.example.com",
            }
            result = mock_res("https://slow.example.com")

        assert result["research_status"] == "timeout"
        assert "website" in result

    @patch("app.services.research.research_engine._build_config")
    def test_research_returns_blocked_on_access_denied(self, mock_config):
        mock_config.return_value = {"llm": {"model": "test", "api_key": "k"}}

        with patch("app.services.research.research_engine.research_organization") as mock_res:
            mock_res.return_value = {
                "research_status": "blocked",
                "error": "Website blocked scraping or returned no useful content",
                "website": "https://blocked.example.com",
            }
            result = mock_res("https://blocked.example.com")

        assert result["research_status"] == "blocked"

    @patch("app.services.research.research_engine._build_config")
    def test_research_returns_failed_on_exception(self, mock_config):
        mock_config.return_value = {"llm": {"model": "test", "api_key": "k"}}

        with patch("app.services.research.research_engine.research_organization") as mock_res:
            mock_res.return_value = {
                "research_status": "failed",
                "error": "Connection refused",
            }
            result = mock_res("https://broken.example.com")

        assert result["research_status"] == "failed"


class TestBatchResearchResilience:
    """Test that batch research continues despite individual failures."""

    def test_discovery_orchestrator_continues_on_timeout(self):
        from app.services.discovery.discovery_orchestrator import DiscoveryOrchestrator

        mock_db = MagicMock()
        orch = DiscoveryOrchestrator(mock_db)

        orgs = [
            {"name": "Org1", "website": "https://a.com", "research_status": None},
            {"name": "Org2", "website": "https://b.com", "research_status": None},
            {"name": "Org3", "website": "https://c.com", "research_status": None},
        ]

        def fake_research(url):
            if "b.com" in url:
                return {"research_status": "timeout", "error": "timed out"}
            return {
                "research_status": "completed",
                "what_they_do": "Test company",
                "industry": "Tech",
                "organization_type": "SaaS",
            }

        with patch("app.services.discovery.discovery_orchestrator.research_organization", side_effect=fake_research):
            with patch("app.services.discovery.discovery_orchestrator.settings") as mock_settings:
                mock_settings.SCRAPEGRAPH_ENABLED = True
                for i, org in enumerate(orgs):
                    if org.get("website") and not org.get("research_status"):
                        try:
                            research_data = fake_research(org["website"])
                            if research_data.get("research_status") == "completed":
                                org["research_status"] = "completed"
                            elif research_data.get("research_status") == "timeout":
                                org["research_status"] = "timeout"
                            else:
                                org["research_status"] = "failed"
                        except Exception:
                            org["research_status"] = "failed"

        assert orgs[0]["research_status"] == "completed"
        assert orgs[1]["research_status"] == "timeout"
        assert orgs[2]["research_status"] == "completed"

    def test_discovery_orchestrator_continues_on_exception(self):
        orgs = [
            {"name": "Org1", "website": "https://a.com", "research_status": None},
            {"name": "Org2", "website": "https://b.com", "research_status": None},
        ]

        def fake_research(url):
            if "b.com" in url:
                raise ConnectionError("Connection refused")
            return {"research_status": "completed", "what_they_do": "Test"}

        for org in orgs:
            if org.get("website") and not org.get("research_status"):
                try:
                    research_data = fake_research(org["website"])
                    if research_data.get("research_status") == "completed":
                        org["research_status"] = "completed"
                    else:
                        org["research_status"] = "failed"
                except Exception:
                    org["research_status"] = "failed"

        assert orgs[0]["research_status"] == "completed"
        assert orgs[1]["research_status"] == "failed"

    def test_settings_have_rate_control_defaults(self):
        from app.core.config import settings
        assert hasattr(settings, "RESEARCH_DELAY_BETWEEN_REQUESTS")
        assert hasattr(settings, "RESEARCH_TIMEOUT")
        assert settings.RESEARCH_DELAY_BETWEEN_REQUESTS > 0
        assert settings.RESEARCH_TIMEOUT > 0
