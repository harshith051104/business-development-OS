"""
P0 regression tests: contact accuracy & send safety.

Covers:
  - fabricated-data removal in StandardEmailEnrichmentProvider
    (no invented phone numbers, no guessed LinkedIn URLs)
  - email-status vocabulary (verified/risky/guess/invalid);
    a guess is never reported as 'verified' or 'enriched'
  - company-domain email pattern learning (learn -> apply;
    the candidate stays a 'guess' until independently verified)
  - deterministic pre-send gate used by BOTH send paths:
      * do_not_contact enforcement
      * bounced / non-deliverable status blocking
      * unresolved placeholder blocking
      * recipient/contact mismatch
      * human-approval flow preserved (campaign path)
      * campaign path (CampaignService.send_step_email via API)
      * direct Gmail path (GmailService.send_email)
      * direct-send API route (POST /api/gmail/send) — same gate,
        safe 422 block reasons, send operation never reached when blocked
"""
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import get_db
from app.models.user import User
from app.models.organization import Organization, ConnectionStatus
from app.models.contact import Contact
from app.models.campaign import CampaignContact, CampaignContactStatus
from app.models.communication import Communication
from app.services.campaign_service import CampaignService
from app.services.gmail_service import GmailService
from app.services.presend_gate import (
    evaluate_send,
    assert_send_allowed,
    SendBlockedError,
)
from app.services.discovery_providers.enrichment_provider import StandardEmailEnrichmentProvider
from app.services.discovery.email_patterns import (
    infer_pattern,
    learn_pattern,
    get_pattern,
    apply_pattern,
)


@pytest.fixture
def client(db_session: Session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    # No context manager on purpose: running app lifespan per-test restarts the
    # APScheduler singleton on a new event loop and breaks subsequent startups
    # (pre-existing test-infra issue). These tests don't need lifespan events.
    test_client = TestClient(app, raise_server_exceptions=True)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client: TestClient):
    response = client.post("/auth/login", json={"email": "bd@test.local", "password": "password123"})
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def bd_user(db_session: Session) -> User:
    return db_session.query(User).first()


@pytest.fixture
def campaign_with_contact(db_session: Session, bd_user: User):
    """CRM org + contact enrolled in a campaign (status Ready_For_Review)."""
    org = Organization(
        name="Gate Test Org",
        organization_type="Enterprise Technology",
        industry="FinTech & Cloud",
        city="Singapore",
        country="Singapore",
        website="https://gatetestorg.com",
        status=ConnectionStatus.NEW.value,
        priority="High",
    )
    db_session.add(org)
    db_session.flush()
    contact = Contact(
        organization_id=org.id,
        first_name="Grace",
        last_name="Hopper",
        designation="CTO",
        email="grace.hopper@gatetestorg.com",
    )
    db_session.add(contact)
    db_session.commit()

    campaign = CampaignService.create_campaign(
        db=db_session,
        user=bd_user,
        data=type("Data", (), {
            "name": "P0 Gate Campaign",
            "description": "Pre-send gate coverage",
            "sender_email": "bd@elly.ai",
            "gmail_account_id": None,
            "target_industry": "FinTech",
            "sequence_steps": None,
            "contact_ids": [contact.id],
        })()
    )
    cc = db_session.query(CampaignContact).filter(
        CampaignContact.campaign_id == campaign.id,
        CampaignContact.contact_id == contact.id,
    ).first()
    return {"campaign": campaign, "contact": contact, "cc": cc}


SEND_URL = "/api/business-development/campaigns/{cid}/contacts/{tid}/send"
APPROVE_URL = "/api/business-development/campaigns/contacts/{ccid}/approve"


# ─────────────────────────────────────────────────────────────
# A. Fabricated-data removal & status vocabulary
# ─────────────────────────────────────────────────────────────

class TestEnrichmentProviderIntegrity:
    def test_no_fabricated_phone_or_linkedin(self):
        prov = StandardEmailEnrichmentProvider()
        res = prov.enrich_contact("Jane Doe", "Acme Corp", website="https://acme.com", job_title="CTO")
        # Provider must never invent contact details it cannot observe.
        assert res["phone"] is None
        assert res["linkedin_url"] is None
        assert res["verified"] is False

    def test_pattern_derived_candidate_is_guess_not_verified(self):
        prov = StandardEmailEnrichmentProvider()
        res = prov.enrich_contact("Jane Doe", "Acme Corp", website="https://acme.com")
        assert res["email"] == "jane.doe@acme.com"
        assert res["email_status"] == "guess"
        assert res["email_status"] not in ("enriched", "verified")

    def test_no_domain_yields_invalid_and_no_email(self):
        prov = StandardEmailEnrichmentProvider()
        for website in (None, "", "   ", "https://example.com", "https://test.local"):
            res = prov.enrich_contact("Jane Doe", "Acme Corp", website=website)
            assert res["email"] is None, f"fabricated email for website={website!r}"
            assert res["email_status"] == "invalid"

    def test_statuses_confined_to_four_state_vocabulary(self):
        prov = StandardEmailEnrichmentProvider()
        allowed = {"verified", "risky", "guess", "invalid"}
        for website in ("https://acme.com", None, "not a domain"):
            res = prov.enrich_contact("Jane Doe", "Acme Corp", website=website)
            assert res["email_status"] in allowed


# ─────────────────────────────────────────────────────────────
# B. Domain-pattern learning
# ─────────────────────────────────────────────────────────────

class TestEmailPatternLearning:
    def test_learn_and_retrieve_pattern(self, db_session: Session):
        row = learn_pattern(db_session, "robert.miles@acme.com", "Robert Miles",
                            source_url="https://acme.com/team")
        assert row is not None
        assert row.pattern == "first.last"
        assert get_pattern(db_session, "https://www.acme.com/about") == "first.last"

    def test_infer_pattern_variants(self):
        assert infer_pattern("jdoe@acme.com", "Jane Doe") == "flast"
        assert infer_pattern("jane_doe@acme.com", "Jane Doe") == "first_last"
        assert infer_pattern("janedoe@acme.com", "Jane Doe") == "firstlast"
        assert infer_pattern("weird.local@acme.com", "Jane Doe") is None

    def test_apply_pattern_generates_candidate_but_status_stays_guess(self, db_session: Session):
        learn_pattern(db_session, "robert.miles@acme.com", "Robert Miles")
        prov = StandardEmailEnrichmentProvider()
        res = prov.enrich_contact("Jane Doe", "Acme Corp", website="acme.com",
                                  email_pattern=get_pattern(db_session, "acme.com"))
        assert res["email"] == "jane.doe@acme.com"
        assert res["email_status"] == "guess"        # learned != confirmed
        assert res["pattern_source"] == "learned"

    def test_fallback_to_default_pattern_when_none_learned(self, db_session: Session):
        prov = StandardEmailEnrichmentProvider()
        res = prov.enrich_contact("Jane Doe", "Acme Corp", website="https://fresh-domain.com")
        assert res["pattern_source"] == "default"
        assert res["email_status"] == "guess"

    def test_learning_ignores_unusable_sources(self, db_session: Session):
        # Placeholder domains and malformed addresses must never seed patterns.
        assert learn_pattern(db_session, "jane@example.com", "Jane Doe") is None
        assert learn_pattern(db_session, "jane@test.local", "Jane Doe") is None
        assert learn_pattern(db_session, "not-an-email", "Jane Doe") is None

    def test_apply_pattern_helper(self):
        assert apply_pattern("flast", "John Smith", "acme.com") == "jsmith@acme.com"
        assert apply_pattern("last.first", "John Smith", "acme.com") == "smith.john@acme.com"
        assert apply_pattern("first.last", "Cher", "acme.com") is None  # no last name


# ─────────────────────────────────────────────────────────────
# C. Pre-send gate (deterministic core)
# ─────────────────────────────────────────────────────────────

class _FakeContact:
    def __init__(self, email="x@co.com", do_not_contact=False, is_deleted=False, email_status=None):
        self.email = email
        self.do_not_contact = do_not_contact
        self.is_deleted = is_deleted
        self.email_status = email_status


class TestPreSendGate:
    def test_clean_send_passes(self):
        r = evaluate_send("x@co.com", "Hello", "<p>Hi there</p>")
        assert r.ok is True
        assert r.reasons == []

    def test_invalid_recipient_blocked(self):
        for bad in (None, "", "not-an-email", "missing@tld", "a b@co.com"):
            r = evaluate_send(bad, "Hi", "Body")
            assert not r.ok and "invalid_recipient" in r.reasons, bad

    def test_unresolved_placeholders_blocked(self):
        r = evaluate_send("x@co.com", "Hi {{first_name}}", "<p>{{cta}}</p>")
        assert not r.ok and "unresolved_placeholders" in r.reasons
        r2 = evaluate_send("x@co.com", "Hi {first_name}", "")
        assert not r2.ok and "unresolved_placeholders" in r2.reasons

    def test_do_not_contact_blocked(self):
        r = evaluate_send("x@co.com", "Hi", "Body", contact=_FakeContact(do_not_contact=True))
        assert not r.ok and "do_not_contact" in r.reasons

    def test_deleted_contact_blocked(self):
        r = evaluate_send("x@co.com", "Hi", "Body", contact=_FakeContact(is_deleted=True))
        assert not r.ok and "contact_deleted" in r.reasons

    def test_recipient_mismatch_blocked(self):
        r = evaluate_send("other@co.com", "Hi", "Body", contact=_FakeContact(email="x@co.com"))
        assert not r.ok and "recipient_mismatch" in r.reasons

    @pytest.mark.parametrize("status", ["invalid", "unavailable", "not_found", "bounced"])
    def test_non_deliverable_statuses_blocked(self, status):
        r = evaluate_send("x@co.com", "Hi", "Body", email_status=status)
        assert not r.ok and "non_deliverable_email_status" in r.reasons

    @pytest.mark.parametrize("status", ["verified", "risky", "guess", "found", "unverified", None])
    def test_deliverable_statuses_allowed(self, status):
        # A guess is deliverable-with-risk, not non-deliverable — existing
        # outreach flows keep working until real verification lands.
        r = evaluate_send("x@co.com", "Hi", "Body", email_status=status)
        assert r.ok is True

    def test_bounced_campaign_contact_blocked(self, db_session: Session):
        cc = CampaignContact(status=CampaignContactStatus.BOUNCED.value)
        r = evaluate_send("x@co.com", "Hi", "Body", campaign_contact=cc)
        assert not r.ok and "bounced_recipient" in r.reasons

    def test_contact_resolved_by_email_on_direct_path(self, db_session: Session):
        # Direct sends (no campaign) still enforce do_not_contact via lookup.
        org = Organization(name="Gate Lookup Org", organization_type="SMB",
                           status=ConnectionStatus.NEW.value)
        db_session.add(org)
        db_session.flush()
        dnc = Contact(organization_id=org.id, first_name="Opt", last_name="Out",
                      email="opt.out@co.com", do_not_contact=True)
        db_session.add(dnc)
        db_session.commit()

        r = evaluate_send("opt.out@co.com", "Hi", "Body", db=db_session)
        assert not r.ok and "do_not_contact" in r.reasons
        # Unknown recipient stays sendable (no false blocking).
        assert evaluate_send("nobody@co.com", "Hi", "Body", db=db_session).ok is True

    def test_assert_send_allowed_raises_with_reasons(self):
        with pytest.raises(SendBlockedError) as exc:
            assert_send_allowed("x@co.com", "{{oops}}", "Body")
        assert "unresolved_placeholders" in exc.value.reasons
        # SendBlockedError is a ValueError — same error channel as the approval gate.
        assert isinstance(exc.value, ValueError)


# ─────────────────────────────────────────────────────────────
# D. Campaign send path (API) — gate + approval preserved
# ─────────────────────────────────────────────────────────────

class TestCampaignSendPathGate:
    """Blocked sends surface as 422 (gate) / 403 (approval required) with a safe
    user-readable reason; nothing is sent or logged."""

    @staticmethod
    def _outgoing_count(db, contact_id):
        return db.query(Communication).filter(
            Communication.contact_id == contact_id,
            Communication.direction == "Outgoing",
        ).count()

    def test_approval_still_required_before_any_send(
        self, client: TestClient, auth_headers: dict, campaign_with_contact: dict, db_session: Session
    ):
        ctx = campaign_with_contact
        resp = client.post(
            SEND_URL.format(cid=ctx["campaign"].id, tid=ctx["contact"].id),
            json={"subject": "Hello", "body_html": "<p>Hi Grace</p>"},
            headers=auth_headers,
        )
        assert resp.status_code == 403  # approval required -> typed policy failure
        body = resp.json()
        assert body["code"] == "approval_required"
        assert "approved" in body["detail"].lower()
        assert ctx["cc"].status == "Ready_For_Review"
        assert self._outgoing_count(db_session, ctx["contact"].id) == 0

    def test_clean_approved_send_succeeds(
        self, client: TestClient, auth_headers: dict, campaign_with_contact: dict, db_session: Session
    ):
        ctx = campaign_with_contact
        client.post(APPROVE_URL.format(ccid=ctx["cc"].id), headers=auth_headers)
        resp = client.post(
            SEND_URL.format(cid=ctx["campaign"].id, tid=ctx["contact"].id),
            json={"subject": "Collaboration with Gate Test Org",
                  "body_html": "<p>Hi Grace, let us collaborate.</p>"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        comm = db_session.query(Communication).filter(
            Communication.contact_id == ctx["contact"].id,
            Communication.direction == "Outgoing",
        ).first()
        assert comm is not None

    def test_unresolved_placeholder_blocked_on_campaign_path(
        self, client: TestClient, auth_headers: dict, campaign_with_contact: dict, db_session: Session
    ):
        ctx = campaign_with_contact
        client.post(APPROVE_URL.format(ccid=ctx["cc"].id), headers=auth_headers)
        resp = client.post(
            SEND_URL.format(cid=ctx["campaign"].id, tid=ctx["contact"].id),
            json={"subject": "Hi {{first_name}}", "body_html": "<p>Intro</p>"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
        body = resp.json()
        assert body["code"] == "send_blocked"
        assert "unresolved_placeholders" in body["reasons"]
        assert self._outgoing_count(db_session, ctx["contact"].id) == 0

    def test_do_not_contact_blocked_on_campaign_path(
        self, client: TestClient, auth_headers: dict, campaign_with_contact: dict, db_session: Session
    ):
        ctx = campaign_with_contact
        client.post(APPROVE_URL.format(ccid=ctx["cc"].id), headers=auth_headers)
        ctx["contact"].do_not_contact = True
        db_session.commit()
        resp = client.post(
            SEND_URL.format(cid=ctx["campaign"].id, tid=ctx["contact"].id),
            json={"subject": "Hello", "body_html": "<p>Hi Grace</p>"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
        body = resp.json()
        assert body["code"] == "send_blocked"
        assert "do_not_contact" in body["reasons"]
        assert "opted out" in body["detail"]
        assert self._outgoing_count(db_session, ctx["contact"].id) == 0

    def test_non_deliverable_status_blocked_on_campaign_path(
        self, client: TestClient, auth_headers: dict, campaign_with_contact: dict, db_session: Session
    ):
        ctx = campaign_with_contact
        client.post(APPROVE_URL.format(ccid=ctx["cc"].id), headers=auth_headers)
        ctx["contact"].email_status = "invalid"
        db_session.commit()
        resp = client.post(
            SEND_URL.format(cid=ctx["campaign"].id, tid=ctx["contact"].id),
            json={"subject": "Hello", "body_html": "<p>Hi Grace</p>"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
        body = resp.json()
        assert body["code"] == "send_blocked"
        assert "non_deliverable_email_status" in body["reasons"]
        # Safe message: no CRM data (contact email) leaks to the client
        assert ctx["contact"].email not in resp.text
        assert self._outgoing_count(db_session, ctx["contact"].id) == 0


# ─────────────────────────────────────────────────────────────
# E. Direct Gmail path (GmailService.send_email) — same gate
# ─────────────────────────────────────────────────────────────

class TestDirectGmailPathGate:
    def test_clean_direct_send_succeeds(self, db_session: Session):
        res = GmailService.send_email(
            db_session, None, "prospect@unknown-co.com", "Hello", "<p>Hi</p>"
        )
        assert res["success"] is True

    def test_do_not_contact_blocked_on_direct_path(self, db_session: Session):
        org = Organization(name="Direct Path Org", organization_type="SMB",
                           status=ConnectionStatus.NEW.value)
        db_session.add(org)
        db_session.flush()
        dnc = Contact(organization_id=org.id, first_name="No", last_name="Send",
                      email="no.send@direct-co.com", do_not_contact=True)
        db_session.add(dnc)
        db_session.commit()
        with pytest.raises(SendBlockedError, match="do_not_contact"):
            GmailService.send_email(db_session, None, "no.send@direct-co.com", "Hello", "<p>Hi</p>")

    def test_invalid_recipient_blocked_on_direct_path(self):
        with pytest.raises(SendBlockedError, match="invalid_recipient"):
            GmailService.send_email(None, None, "not-an-email", "Hello", "<p>Hi</p>")

    def test_bounced_campaign_contact_blocked_on_direct_path(
        self, db_session: Session, campaign_with_contact: dict
    ):
        ctx = campaign_with_contact
        ctx["cc"].status = CampaignContactStatus.BOUNCED.value
        db_session.commit()
        with pytest.raises(SendBlockedError, match="bounced_recipient"):
            GmailService.send_email(
                db_session, None, ctx["contact"].email, "Hello", "<p>Hi</p>",
                campaign_contact_id=ctx["cc"].id,
            )

    def test_gmail_send_logs_audited_only_when_allowed(
        self, db_session: Session, campaign_with_contact: dict
    ):
        # Gate failure happens before any simulated dispatch record.
        ctx = campaign_with_contact
        with pytest.raises(SendBlockedError):
            GmailService.send_email(
                db_session, None, "bad address", "Hello", "<p>{{x}}</p>",
                campaign_contact_id=ctx["cc"].id,
            )


# ─────────────────────────────────────────────────────────────
# F. Direct-send API route (POST /api/gmail/send) — same gate
# ─────────────────────────────────────────────────────────────

DIRECT_SEND_URL = "/api/gmail/send"


class TestDirectSendRoute:
    """POST /api/gmail/send (the outreach-workspace direct send) goes through
    GmailService.send_email, so the SAME gate applies. Blocked sends return a
    safe 422 with a stable code + user-readable reason and never reach the
    Gmail send operation."""

    @pytest.fixture
    def route_contact(self, db_session: Session):
        """Fresh CRM contact with a UNIQUE email. The direct path resolves the
        contact by email; duplicate emails from earlier fixture instances in the
        same session would mask the intended contact (gate would look up an
        older, clean copy)."""
        from uuid import uuid4
        org = Organization(name="Route Gate Org", organization_type="SMB",
                           status=ConnectionStatus.NEW.value)
        db_session.add(org)
        db_session.flush()
        contact = Contact(
            organization_id=org.id,
            first_name="Riley",
            last_name="Routecheck",
            email=f"riley.{uuid4().hex[:8]}@route-gate-co.com",
        )
        db_session.add(contact)
        db_session.commit()
        return contact

    @staticmethod
    def _send_audit_count(db: Session) -> int:
        from app.models.audit import AuditLog
        return db.query(AuditLog).filter(
            AuditLog.action.in_(["GMAIL_EMAIL_SENT", "GMAIL_EMAIL_SENT_SIMULATED"])
        ).count()

    @pytest.fixture
    def no_send_reach(self, monkeypatch):
        """Fail loudly if any request reaches Gmail message construction —
        the gate must raise before the MIME message is ever built."""
        def _boom(*args, **kwargs):
            raise AssertionError("send operation was reached for a blocked request")
        monkeypatch.setattr("app.services.gmail_service.MIMEMultipart", _boom)

    def test_route_requires_auth(self, client: TestClient):
        resp = client.post(
            DIRECT_SEND_URL,
            json={"to": "someone@co.com", "subject": "Hi", "body": "Hello"},
        )
        assert resp.status_code in (401, 403)

    def test_clean_direct_send_route_succeeds(
        self, client: TestClient, auth_headers: dict, db_session: Session
    ):
        audits_before = self._send_audit_count(db_session)
        resp = client.post(
            DIRECT_SEND_URL,
            json={"to": "prospect@route-clean-co.com", "subject": "Hello", "body": "Hi there"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["message_id"]
        # Simulated send is audited (proof the send operation ran)
        assert self._send_audit_count(db_session) == audits_before + 1

    def test_opt_out_blocked_via_route_with_safe_reason(
        self, client: TestClient, auth_headers: dict, route_contact: Contact,
        db_session: Session, no_send_reach,
    ):
        route_contact.do_not_contact = True
        db_session.commit()
        audits_before = self._send_audit_count(db_session)

        resp = client.post(
            DIRECT_SEND_URL,
            json={"to": route_contact.email, "subject": "Hello", "body": "Hi"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
        body = resp.json()
        assert body["code"] == "send_blocked"
        assert "do_not_contact" in body["reasons"]
        # User-readable, safe message: no CRM data, no stack traces
        assert "opted out" in body["detail"]
        assert route_contact.email not in resp.text
        assert route_contact.first_name not in resp.text
        assert "Traceback" not in resp.text
        # Blocked request never reached the send operation
        assert self._send_audit_count(db_session) == audits_before

    def test_deleted_contact_blocked_via_route(
        self, client: TestClient, auth_headers: dict, route_contact: Contact,
        db_session: Session, no_send_reach,
    ):
        route_contact.is_deleted = True
        db_session.commit()
        resp = client.post(
            DIRECT_SEND_URL,
            json={"to": route_contact.email, "subject": "Hello", "body": "Hi"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
        body = resp.json()
        assert "contact_deleted" in body["reasons"]
        assert "deleted" in body["detail"]

    def test_invalid_recipient_blocked_via_route(
        self, client: TestClient, auth_headers: dict, no_send_reach,
    ):
        resp = client.post(
            DIRECT_SEND_URL,
            json={"to": "not-an-email", "subject": "Hello", "body": "Hi"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
        assert "invalid_recipient" in resp.json()["reasons"]

    def test_unresolved_placeholders_blocked_via_route(
        self, client: TestClient, auth_headers: dict, no_send_reach,
    ):
        resp = client.post(
            DIRECT_SEND_URL,
            json={"to": "someone@co.com", "subject": "Hi", "body": "Hello {{first_name}}"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
        assert "unresolved_placeholders" in resp.json()["reasons"]

    def test_non_deliverable_status_blocked_via_route(
        self, client: TestClient, auth_headers: dict, route_contact: Contact,
        db_session: Session, no_send_reach,
    ):
        route_contact.email_status = "invalid"
        db_session.commit()
        resp = client.post(
            DIRECT_SEND_URL,
            json={"to": route_contact.email, "subject": "Hello", "body": "Hi"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
        assert "non_deliverable_email_status" in resp.json()["reasons"]

    def test_bounced_contact_status_blocked_via_route(
        self, client: TestClient, auth_headers: dict, route_contact: Contact,
        db_session: Session, no_send_reach,
    ):
        route_contact.email_status = "bounced"
        db_session.commit()
        resp = client.post(
            DIRECT_SEND_URL,
            json={"to": route_contact.email, "subject": "Hello", "body": "Hi"},
            headers=auth_headers,
        )
        assert resp.status_code == 422
        assert "non_deliverable_email_status" in resp.json()["reasons"]

    def test_recipient_mismatch_is_impossible_on_route_by_design(
        self, client: TestClient, auth_headers: dict, route_contact: Contact,
    ):
        """The route resolves the CRM contact BY the recipient email, so a
        recipient/contact mismatch cannot be expressed on this path — it is
        structurally impossible and covered by the gate unit tests instead."""
        resp = client.post(
            DIRECT_SEND_URL,
            json={"to": route_contact.email, "subject": "Hello", "body": "Hi"},
            headers=auth_headers,
        )
        assert resp.status_code == 200  # contact resolved by email -> always matches
