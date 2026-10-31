import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.services import notification_service


def get_token(client: TestClient, email: str = "bd@test.local", password: str = "password123") -> str:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def _bd_user_id(db_session: Session):
    from app.models.user import User
    return db_session.query(User).filter(User.email == "bd@test.local").first().id


def test_list_notifications_empty(client: TestClient, db_session: Session):
    token = get_token(client)
    res = client.get(
        "/api/business-development/notifications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json() == []


def test_notify_then_list_and_unread_count(client: TestClient, db_session: Session):
    user_id = _bd_user_id(db_session)
    notification_service.notify(
        db_session, user_id=user_id, type="TEST_EVENT", title="Hello", body="World", link="/x"
    )

    token = get_token(client)
    res = client.get(
        "/api/business-development/notifications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["type"] == "TEST_EVENT"
    assert items[0]["is_read"] is False

    res = client.get(
        "/api/business-development/notifications/unread-count",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["unread_count"] == 1


def test_mark_read_and_mark_all_read(client: TestClient, db_session: Session):
    user_id = _bd_user_id(db_session)
    n1 = notification_service.notify(db_session, user_id=user_id, type="A", title="A")
    n2 = notification_service.notify(db_session, user_id=user_id, type="B", title="B")

    token = get_token(client)
    res = client.post(
        f"/api/business-development/notifications/{n1.id}/read",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["is_read"] is True

    res = client.post(
        "/api/business-development/notifications/read-all",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["marked_read"] >= 1

    res = client.get(
        "/api/business-development/notifications/unread-count",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.json()["unread_count"] == 0

    db_session.refresh(n2)
    assert n2.is_read is True


def test_mark_read_not_found(client: TestClient, db_session: Session):
    token = get_token(client)
    res = client.post(
        "/api/business-development/notifications/999999/read",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


def test_notifications_require_auth(client: TestClient):
    res = client.get("/api/business-development/notifications")
    assert res.status_code in (401, 403)


def test_notification_scoped_to_owning_user(client: TestClient, db_session: Session):
    """A BD user's notifications must not leak another user's rows."""
    from app.models.user import User
    other_id = db_session.query(User).filter(User.email == "admin@test.local").first().id
    notification_service.notify(db_session, user_id=other_id, type="ADMIN_ONLY", title="Admin event")

    token = get_token(client, "bd@test.local", "password123")
    res = client.get(
        "/api/business-development/notifications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert all(item["type"] != "ADMIN_ONLY" for item in res.json())
