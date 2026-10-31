"""
P1 regression tests: deterministic website profiler + provenance/history.

Covers:
  - site profiler extracts observable signals with evidence URLs
  - profiler failure => unknown (never false) and never raises
  - qualification consumes profiler findings deterministically;
    unknown findings never create false qualification signals
  - signal provenance: confidence / evidence URL / observation timestamp
  - research history preserved instead of overwritten
"""
import json
from datetime import datetime, timedelta, timezone

import pytest

from app.services.research.site_profiler import profile_website
from app.services.discovery.qualification import ExplainableQualification


class FakeResp:
    def __init__(self, status_code=200, text=""):
        self.status_code = status_code
        self.text = text


HOMEPAGE = """
<html><head>
<script src="https://cdn.shopify.com/s/files/x.js"></script>
<script src="https://js.hs-scripts.com/123.js"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-99"></script>
<script>fbq('init','1');</script>
<script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>
</head><body>
<a href="/careers">Careers</a><a href="/contact">Contact</a>
<h3>Senior Backend Engineer</h3>
<form action="https://acme.com/contact/submit" method="post"><input></form>
<p>Designed by <a href="https://agency.example">Pixel Forge Studio</a></p>
</body></html>
"""

CAREERS = """
<html><body>
<h3>DevOps Engineer</h3><h3>Product Marketing Manager</h3>
</body></html>
"""

ROBOTS = "User-agent: *\nAllow: /\nSitemap: https://acme.com/sitemap.xml\n"

SITEMAP = """<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://acme.com/</loc><lastmod>2026-01-05</lastmod></url>
<url><loc>https://acme.com/blog/post-1</loc><lastmod>2020-02-01</lastmod></url>
</urlset>
"""


def _fake_httpx(pages):
    """Patch helper: pages maps URL suffix -> FakeResp (or Exception)."""
    def getter(url, **kwargs):
        for suffix, resp in pages.items():
            if url.startswith(suffix):
                if isinstance(resp, Exception):
                    raise resp
                return resp
        return FakeResp(404, "")
    return getter


class TestSiteProfiler:
    def test_detects_observable_signals(self, monkeypatch):
        import app.services.research.site_profiler as sp
        pages = {
            "https://acme.com/careers": FakeResp(200, CAREERS),
            "https://acme.com/contact": FakeResp(200, "<html><body>Contact us</body></html>"),
            "https://acme.com/robots.txt": FakeResp(200, ROBOTS),
            "https://acme.com/sitemap.xml": FakeResp(200, SITEMAP),
            "https://acme.com": FakeResp(200, HOMEPAGE),
        }
        monkeypatch.setattr(sp.httpx, "get", _fake_httpx(pages))

        profile = profile_website("https://acme.com")
        assert "Shopify" in profile["tech_stack"]
        assert "HubSpot" in profile["tech_stack"]
        assert "meta_pixel" in profile["ad_pixels"]
        assert "Organization" in profile["schema_types"]
        assert profile["blog_present"] is True
        assert profile["blog_newest"] == "2020-02-01"
        assert profile["blog_stale"] is True          # older than 365 days
        assert profile["agency_credit"]["label"] == "Pixel Forge Studio"
        assert profile["contact_form_url"] == "https://acme.com/contact/submit"
        assert any("DevOps Engineer" == r for r in profile["hiring_roles"])
        # Evidence maps determined fields to proving URLs.
        assert profile["evidence"]["tech_stack"] == "https://acme.com"
        assert profile["unknown"] == []

    def test_total_failure_is_unknown_not_false(self, monkeypatch):
        import app.services.research.site_profiler as sp
        monkeypatch.setattr(sp.httpx, "get",
                            _fake_httpx({"https": ConnectionError("no network")}))
        profile = profile_website("https://dead-site.com")
        # Never raises; nothing is asserted as false.
        assert profile["tech_stack"] is None
        assert profile["ad_pixels"] is None
        assert profile["schema_types"] is None
        assert profile["blog_stale"] is None
        assert profile["blog_present"] is None
        assert profile["agency_credit"] is None
        assert profile["hiring_roles"] is None
        assert "tech_stack" in profile["unknown"]
        assert "blog_stale" in profile["unknown"]
        assert profile["errors"]

    def test_no_url_returns_unknown_without_raising(self):
        for bad in (None, "", "   "):
            profile = profile_website(bad)
            assert profile["tech_stack"] is None
            assert "tech_stack" in profile["unknown"]

    def test_observed_absence_is_not_unknown(self, monkeypatch):
        # Homepage fetched OK but no tech/pixels found = real observation.
        import app.services.research.site_profiler as sp
        pages = {
            "https://acme.com/robots.txt": FakeResp(404, ""),
            "https://acme.com/sitemap.xml": FakeResp(404, ""),
            "https://acme.com": FakeResp(200, "<html><body>plain</body></html>"),
        }
        monkeypatch.setattr(sp.httpx, "get", _fake_httpx(pages))
        profile = profile_website("https://acme.com")
        assert profile["tech_stack"] == []
        assert profile["ad_pixels"] == []
        assert profile["blog_present"] is False or profile["blog_present"] is None


class TestQualificationProfilerWiring:
    BASE_ORG = {
        "name": "Acme",
        "organization_type": "Enterprise",
        "employee_count": 600,
        "relevance_score": 80,
    }

    def _score(self, org):
        result = ExplainableQualification().qualify(org, "AI platform", "enterprise AI", "partnership")
        return result.score

    def test_tech_signals_raise_score_deterministically(self):
        baseline = self._score(dict(self.BASE_ORG))
        with_profile = dict(self.BASE_ORG)
        with_profile["research"] = {
            "research_status": "completed",
            "site_profile": {
                "tech_stack": ["HubSpot", "Shopify"],
                "blog_stale": None,
                "unknown": ["blog_stale"],
            },
        }
        assert self._score(with_profile) > baseline

    def test_unknown_profile_never_falsifies_score(self):
        baseline = self._score(dict(self.BASE_ORG))
        failed_profile = dict(self.BASE_ORG)
        failed_profile["research"] = {
            "research_status": "failed",
            "site_profile": {
                "tech_stack": None,          # profiler could not fetch
                "unknown": ["tech_stack", "blog_stale"],
                "errors": ["GET https://x -> ConnectError"],
            },
        }
        assert self._score(failed_profile) == baseline

    def test_failed_extractions_surface_as_missing_information(self):
        # P2: incomplete extractions are recorded explicitly, not silently dropped.
        org = dict(self.BASE_ORG)
        org["research"] = {
            "research_status": "failed",
            "site_profile": {"tech_stack": None, "unknown": ["tech_stack", "blog_stale"]},
        }
        result = ExplainableQualification().qualify(org, "AI platform", "enterprise AI", "partnership")
        assert any("Website data unavailable" in m for m in result.missing_information)
        # No profile at all -> no invented missing entries (existing behavior).
        clean = ExplainableQualification().qualify(dict(self.BASE_ORG), "AI platform", "enterprise AI", "partnership")
        assert not any("Website data unavailable" in m for m in clean.missing_information)


class TestSignalProvenance:
    def test_signal_stores_confidence_evidence_and_observed_at(self, db_session):
        from app.services.signal_service import _create_signal
        observed_before = datetime.now(timezone.utc)
        sig = _create_signal(
            db_session, "hiring_signal", "Engineering hiring detected", 30,
            metadata={
                "confidence": 0.72,
                "evidence_url": "https://acme.com/careers",
                "source": "site_profiler",
            },
        )
        assert sig.confidence == 0.72
        assert sig.evidence_url == "https://acme.com/careers"
        assert sig.observed_at is not None
        assert sig.observed_at.replace(tzinfo=timezone.utc) >= observed_before - timedelta(seconds=5)

    def test_signal_without_metadata_defaults_observed_at(self, db_session):
        from app.services.signal_service import _create_signal
        sig = _create_signal(db_session, "open_signal", "Email opened", 10)
        assert sig.observed_at is not None
        assert sig.confidence is None
        assert sig.evidence_url is None


class TestResearchHistory:
    @staticmethod
    def _store(db, organization, tag):
        from app.services.discovery.research_cache import store_research
        return store_research(
            db, organization=organization, domain=f"{tag}.org",
            signals={f"{tag}_signal": {"description": tag, "confidence": 0.5,
                                       "source_url": "https://acme.com"}},
            qualification={"score": 70},
            decision_makers=[{"name": tag}],
            provider_used="test",
        )

    def test_reresearch_preserves_previous_observation(self, db_session):
        self._store(db_session, "History Org", "first")
        self._store(db_session, "History Org", "second")

        from app.models.research import OrganizationResearchRecord
        rec = db_session.query(OrganizationResearchRecord).filter(
            OrganizationResearchRecord.organization_name == "History Org").first()
        assert rec is not None
        assert "second_signal" in rec.signals          # latest observation
        history = json.loads(rec.history_json or "[]")
        assert len(history) == 1                       # prior observation kept
        assert "first_signal" in history[0]["signals"]
        assert history[0]["observed_at"]

    def test_cached_research_returns_latest(self, db_session):
        from app.services.discovery.research_cache import get_cached_research
        self._store(db_session, "Cache Org", "v1")
        self._store(db_session, "Cache Org", "v2")
        cached = get_cached_research(db_session, organization="Cache Org")
        assert cached is not None
        assert "v2_signal" in cached["signals"]


class TestResearchSignalObservationTimestamp:
    def test_research_signal_carries_provenance_fields(self):
        from app.services.research.research_schemas import ResearchSignal
        sig = ResearchSignal(type="digital_transformation", description="CRM rollout",
                             source_url="https://acme.com/news", confidence=0.8)
        data = sig.model_dump()
        assert data["source_url"] == "https://acme.com/news"
        assert data["confidence"] == 0.8
        assert data["observed_at"]  # observation timestamp present


class TestDiscoveryResearchRecordPersistence:
    """The discovery search router stores the orchestrator's research payload in
    OrganizationResearchRecord.research_data (a Text column). Regression: the
    raw dict used to be bound directly, crashing /discover/search with sqlite
    "type 'dict' is not supported". It must be stored as JSON text."""

    def test_research_payload_persists_as_json_text_and_round_trips(self, db_session):
        from app.models.research import OrganizationResearchRecord
        payload = {"research_status": "completed", "what_they_do": "AI healthcare platform",
                   "blog_newest": "https://acme.com/sitemap.xml"}

        # Same write pattern as routers/discovery.py
        rec = OrganizationResearchRecord(
            organization_name="Serialize Test Org",
            research_data=json.dumps(payload, default=str),
            qualification_score=70,
            research_version="orchestrator-v1",
            provider_used="scrapegraph",
        )
        db_session.add(rec)
        db_session.commit()  # would raise ProgrammingError before the fix

        stored = db_session.query(OrganizationResearchRecord).filter(
            OrganizationResearchRecord.organization_name == "Serialize Test Org",
        ).first()
        assert stored is not None
        assert isinstance(stored.research_data, str)
        # Same read pattern as services/copilot/tools.py
        rd = json.loads(stored.research_data) if isinstance(stored.research_data, str) else stored.research_data
        assert rd["what_they_do"] == "AI healthcare platform"
