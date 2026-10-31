from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.organization import Organization, ConnectionStatus
from app.models.contact import Contact
from app.models.campaign import Campaign, CampaignContact, CampaignContactStatus
from app.models.signal import Signal
from app.services import signal_service
from tests.conftest import TestingSessionLocal


@pytest.fixture(autouse=True)
def redirect_signal_scan_session(monkeypatch):
    """scan_signals() opens its own SessionLocal() (it's a cron job, not a
    request handler) -- point it at the test DB like the other background-job
    session redirects in this suite, or it silently scans the dev DB."""
    monkeypatch.setattr(signal_service, "SessionLocal", TestingSessionLocal)


def get_token(client: TestClient, email: str = "bd@test.local", password: str = "password123") -> str:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def _make_campaign_contact(db_session: Session, **overrides) -> CampaignContact:
    org = Organization(name="Signal Org", organization_type="SMB", status=ConnectionStatus.NEW.value)
    db_session.add(org)
    db_session.flush()

    contact = Contact(organization_id=org.id, first_name="Sig", last_name="Nal", email="sig.nal@signalorg.test")
    db_session.add(contact)

    campaign = Campaign(name="Signal Campaign", category="client", status="Active")
    db_session.add(campaign)
    db_session.flush()

    defaults = dict(
        campaign_id=campaign.id,
        contact_id=contact.id,
        organization_id=org.id,
        current_step_number=1,
        status=CampaignContactStatus.PENDING.value,
    )
    defaults.update(overrides)
    cc = CampaignContact(**defaults)
    db_session.add(cc)
    db_session.commit()
    db_session.refresh(cc)
    return cc


def test_scan_signals_high_open_no_reply(db_session: Session):
    _make_campaign_contact(db_session, open_count=3, status=CampaignContactStatus.PENDING.value)

    created = signal_service.scan_signals()
    assert created >= 1

    sig = db_session.query(Signal).filter(Signal.signal_type == "high_open_no_reply").first()
    assert sig is not None
    assert sig.dismissed is False


def test_scan_signals_dedup_within_window(db_session: Session):
    _make_campaign_contact(db_session, open_count=5, status=CampaignContactStatus.PENDING.value)

    first = signal_service.scan_signals()
    second = signal_service.scan_signals()

    assert first >= 1
    assert second == 0


def test_scan_signals_stalled_after_connection(db_session: Session):
    old = datetime.now(timezone.utc) - timedelta(days=20)
    _make_campaign_contact(
        db_session,
        linkedin_connection_accepted=True,
        last_action_at=old,
        status=CampaignContactStatus.PENDING.value,
    )

    signal_service.scan_signals()
    sig = db_session.query(Signal).filter(Signal.signal_type == "stalled_after_connection").first()
    assert sig is not None


def test_list_active_excludes_dismissed(db_session: Session):
    cc = _make_campaign_contact(db_session, open_count=4)
    signal_service.scan_signals()

    active_before = signal_service.list_active(db_session)
    assert len(active_before) >= 1

    for sig in active_before:
        signal_service.dismiss(db_session, sig.id)

    active_after = signal_service.list_active(db_session)
    assert all(s.id not in [a.id for a in active_before] for s in active_after)


def test_signals_endpoint_requires_bd_or_admin(client: TestClient):
    token = get_token(client, "user@test.local", "password123")
    res = client.get(
        "/api/business-development/signals",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_signals_endpoint_list_and_dismiss(client: TestClient, db_session: Session):
    _make_campaign_contact(db_session, open_count=4)
    signal_service.scan_signals()

    token = get_token(client)
    res = client.get(
        "/api/business-development/signals",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    signals = res.json()
    assert len(signals) >= 1

    signal_id = signals[0]["id"]
    res = client.post(
        f"/api/business-development/signals/{signal_id}/dismiss",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["dismissed"] is True


def test_dismiss_signal_not_found(client: TestClient):
    token = get_token(client)
    res = client.post(
        "/api/business-development/signals/999999/dismiss",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
