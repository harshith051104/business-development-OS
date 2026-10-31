import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.webhook import WebhookSubscription
from app.services import webhook_service


def get_token(client: TestClient, email: str = "bd@test.local", password: str = "password123") -> str:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def _sign(body: bytes) -> str:
    secret = settings.WEBHOOK_INBOUND_SECRET
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


# ── Inbound webhooks ──

def test_inbound_webhook_missing_signature_rejected(client: TestClient):
    res = client.post("/api/business-development/integrations/webhooks/testsource", json={"foo": "bar"})
    assert res.status_code == 401


def test_inbound_webhook_bad_signature_rejected(client: TestClient):
    body = json.dumps({"foo": "bar"}).encode("utf-8")
    res = client.post(
        "/api/business-development/integrations/webhooks/testsource",
        content=body,
        headers={"X-Signature": "deadbeef", "Content-Type": "application/json"},
    )
    assert res.status_code == 401


def test_inbound_webhook_valid_signature_lead_ingest(client: TestClient):
    payload = {
        "organization_name": "Inbound Webhook Co",
        "source_system": "testsource",
    }
    body = json.dumps(payload).encode("utf-8")
    res = client.post(
        "/api/business-development/integrations/webhooks/testsource",
        content=body,
        headers={"X-Signature": _sign(body), "Content-Type": "application/json"},
    )
    assert res.status_code == 202, res.text
    data = res.json()
    assert data["status"] == "ingested"
    assert data["organization_id"] is not None


def test_inbound_webhook_valid_signature_generic_event_notifies_bd(client: TestClient, db_session: Session):
    from app.models.notification import Notification

    payload = {"event": "something happened"}
    body = json.dumps(payload).encode("utf-8")
    res = client.post(
        "/api/business-development/integrations/webhooks/testsource",
        content=body,
        headers={"X-Signature": _sign(body), "Content-Type": "application/json"},
    )
    assert res.status_code == 202
    data = res.json()
    assert data["status"] == "received"
    assert data["notified_users"] >= 1

    notif = (
        db_session.query(Notification)
        .filter(Notification.type == "webhook.testsource")
        .first()
    )
    assert notif is not None


# ── Outbound webhook subscriptions ──

def test_create_list_delete_subscription(client: TestClient):
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/business-development/integrations/webhook-subscriptions",
        headers=headers,
        json={"url": "https://example.test/hook", "event_types": ["SIGNAL_DETECTED"], "secret": "s3cr3t"},
    )
    assert res.status_code == 201, res.text
    sub = res.json()
    assert sub["url"] == "https://example.test/hook"
    sub_id = sub["id"]

    res = client.get("/api/business-development/integrations/webhook-subscriptions", headers=headers)
    assert res.status_code == 200
    assert any(s["id"] == sub_id for s in res.json())

    res = client.delete(
        f"/api/business-development/integrations/webhook-subscriptions/{sub_id}", headers=headers
    )
    assert res.status_code == 200

    res = client.get("/api/business-development/integrations/webhook-subscriptions", headers=headers)
    assert all(s["id"] != sub_id for s in res.json())


def test_delete_subscription_not_found(client: TestClient):
    token = get_token(client)
    res = client.delete(
        "/api/business-development/integrations/webhook-subscriptions/999999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


def test_subscriptions_require_bd_or_admin(client: TestClient):
    token = get_token(client, "user@test.local", "password123")
    res = client.get(
        "/api/business-development/integrations/webhook-subscriptions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


# ── Outbound dispatch (unit-level, no real network) ──

def test_dispatch_outbound_matches_event_type_and_signs(db_session: Session, monkeypatch):
    sub = WebhookSubscription(url="https://example.test/hook", event_types=["MY_EVENT"], secret="topsecret")
    db_session.add(sub)
    db_session.commit()

    calls = []

    def fake_post(url, content, headers, timeout):
        calls.append((url, content, headers))
        class Resp:
            status_code = 200
        return Resp()

    monkeypatch.setattr(webhook_service.httpx, "post", fake_post)

    webhook_service.dispatch_outbound(db_session, event_type="MY_EVENT", payload={"a": 1})

    assert len(calls) == 1
    url, body, headers = calls[0]
    assert url == "https://example.test/hook"
    expected_sig = hmac.new(b"topsecret", body, hashlib.sha256).hexdigest()
    assert headers["X-Webhook-Signature"] == expected_sig
    assert json.loads(body)["event_type"] == "MY_EVENT"

    db_session.delete(sub)
    db_session.commit()


def test_dispatch_outbound_skips_non_matching_event(db_session: Session, monkeypatch):
    sub = WebhookSubscription(url="https://example.test/hook", event_types=["OTHER_EVENT"], secret="s")
    db_session.add(sub)
    db_session.commit()

    calls = []
    monkeypatch.setattr(webhook_service.httpx, "post", lambda *a, **k: calls.append(1))

    webhook_service.dispatch_outbound(db_session, event_type="MY_EVENT", payload={})
    assert calls == []

    db_session.delete(sub)
    db_session.commit()


def test_dispatch_outbound_never_raises_on_network_error(db_session: Session, monkeypatch):
    sub = WebhookSubscription(url="https://example.test/hook", event_types=["*"], secret="s")
    db_session.add(sub)
    db_session.commit()

    def raise_error(*a, **k):
        raise ConnectionError("boom")

    monkeypatch.setattr(webhook_service.httpx, "post", raise_error)

    webhook_service.dispatch_outbound(db_session, event_type="ANY", payload={})

    db_session.delete(sub)
    db_session.commit()
