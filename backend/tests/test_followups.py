import pytest
from datetime import datetime, timezone


def get_bd_token(client):
    res = client.post("/auth/login", json={"email": "bd@test.local", "password": "password123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def get_healthcare_token(client):
    res = client.post("/auth/login", json={"email": "healthcare@test.local", "password": "password123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_1_authorized_bd_user_can_list_followups(client):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/followups",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 2


def test_2_authorized_bd_user_can_get_grouped_followups(client):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/followups/grouped",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "overdue" in data
    assert "today" in data
    assert "upcoming" in data
    assert "completed" in data
    assert len(data["overdue"]) >= 1
    assert data["overdue"][0]["is_overdue"] is True


def test_3_authorized_bd_user_can_create_followup(client):
    token = get_bd_token(client)
    payload = {
        "organization_id": 1,
        "contact_id": 1,
        "title": "Send custom deployment timeline",
        "description": "Prepare 3-week onboarding plan",
        "due_at": "2026-08-30T17:00:00Z",
        "priority": "High",
    }
    res = client.post(
        "/api/business-development/followups",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Send custom deployment timeline"
    assert data["status"] == "Pending"
    assert data["priority"] == "High"


def test_4_authorized_bd_user_can_complete_followup(client):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/followups/1/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Completed"
    assert data["completed_at"] is not None


def test_5_authorized_bd_user_can_cancel_followup(client):
    token = get_bd_token(client)
    # Create followup to cancel
    create_res = client.post(
        "/api/business-development/followups",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 2,
            "title": "Follow-up to cancel",
            "due_at": "2026-08-30T17:00:00Z",
        },
    )
    assert create_res.status_code == 201
    fol_id = create_res.json()["id"]

    res = client.post(
        f"/api/business-development/followups/{fol_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
        json={"reason": "Customer opted for different timeframe."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Cancelled"
    assert "timeframe" in data["cancellation_reason"]


def test_6_unauthorized_user_receives_401_on_followups(client):
    res = client.get("/api/business-development/followups")
    assert res.status_code == 401


def test_7_non_bd_user_receives_403_on_followups(client):
    token = get_healthcare_token(client)
    res = client.get(
        "/api/business-development/followups",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_8_followup_not_found_returns_404(client):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/followups/99999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
