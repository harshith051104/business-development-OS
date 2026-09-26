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


def test_1_authorized_bd_user_can_list_meetings(client):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/meetings",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert any(m["title"] == "ELLY Platform Executive Showcase" for m in data["items"])


def test_2_authorized_bd_user_can_schedule_meeting(client):
    token = get_bd_token(client)
    payload = {
        "organization_id": 1,
        "primary_contact_id": 1,
        "contact_ids": [1],
        "title": "Hospital Leadership AI Consultation",
        "meeting_type": "Business Discussion",
        "scheduled_at": "2026-08-26T14:30:00Z",
        "duration_minutes": 60,
        "location": "Boardroom 3",
        "agenda": "1. Review hospital workflow pain points\n2. Discuss platform compatibility",
    }
    res = client.post(
        "/api/business-development/meetings",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Hospital Leadership AI Consultation"
    assert data["organization_id"] == 1
    assert data["status"] == "Scheduled"
    assert len(data["attendees"]) >= 1


def test_3_authorized_bd_user_can_view_meeting_details(client):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/meetings/1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == 1
    assert "ELLY" in data["title"]
    assert "attendees" in data
    assert len(data["attendees"]) >= 1


def test_4_authorized_bd_user_can_edit_meeting(client):
    token = get_bd_token(client)
    payload = {
        "title": "ELLY Platform Executive Showcase - Updated",
        "duration_minutes": 90,
    }
    res = client.put(
        "/api/business-development/meetings/1",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "ELLY Platform Executive Showcase - Updated"
    assert data["duration_minutes"] == 90


def test_5_authorized_bd_user_can_complete_meeting(client):
    token = get_bd_token(client)
    payload = {
        "notes": "Leadership was very positive about hospital intelligence forecasting.",
        "decisions": "Proceed to security and network architecture review.",
        "next_actions": "Send technical architecture document.",
        "followup_title": "Send Technical Architecture Brief",
        "followup_due_at": "2026-08-29T17:00:00Z",
        "followup_priority": "High",
        "advance_org_status": "Discussion",
    }
    res = client.post(
        "/api/business-development/meetings/1/complete",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Completed"
    assert "positive" in data["notes"]
    assert "security" in data["decisions"]


def test_6_authorized_bd_user_can_reschedule_meeting(client):
    token = get_bd_token(client)
    # Create another meeting to reschedule
    create_res = client.post(
        "/api/business-development/meetings",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 2,
            "title": "Meeting to Reschedule",
            "scheduled_at": "2026-08-27T10:00:00Z",
            "meeting_type": "Introduction",
        },
    )
    assert create_res.status_code == 201
    mtg_id = create_res.json()["id"]

    res = client.post(
        "/api/business-development/meetings/{}/reschedule".format(mtg_id),
        headers={"Authorization": f"Bearer {token}"},
        json={
            "scheduled_at": "2026-08-30T16:00:00Z",
            "duration_minutes": 45,
            "note": "Stakeholder conflict shifted time.",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Rescheduled"


def test_7_authorized_bd_user_can_cancel_meeting(client):
    token = get_bd_token(client)
    # Create meeting to cancel
    create_res = client.post(
        "/api/business-development/meetings",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 2,
            "title": "Meeting to Cancel",
            "scheduled_at": "2026-08-27T11:00:00Z",
            "meeting_type": "Introduction",
        },
    )
    assert create_res.status_code == 201
    mtg_id = create_res.json()["id"]

    res = client.post(
        "/api/business-development/meetings/{}/cancel".format(mtg_id),
        headers={"Authorization": f"Bearer {token}"},
        json={"reason": "Customer cancelled due to emergency internal audit."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Cancelled"
    assert "audit" in data["cancellation_reason"]


def test_8_meeting_contact_must_belong_to_organization(client):
    token = get_bd_token(client)
    # Contact 2 belongs to Org 2, trying to associate with Org 1
    res = client.post(
        "/api/business-development/meetings",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "primary_contact_id": 2,
            "contact_ids": [2],
            "title": "Invalid Contact Association",
            "scheduled_at": "2026-08-27T11:00:00Z",
        },
    )
    assert res.status_code == 400
    assert "belong to the selected organization" in res.json()["detail"]


def test_9_unauthorized_user_receives_401_on_meetings(client):
    res = client.get("/api/business-development/meetings")
    assert res.status_code == 401


def test_10_non_bd_user_receives_403_on_meetings(client):
    token = get_healthcare_token(client)
    res = client.get(
        "/api/business-development/meetings",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_11_meeting_not_found_returns_404(client):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/meetings/99999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
