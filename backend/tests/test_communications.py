import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient


def get_bd_token(client: TestClient) -> str:
    res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def get_non_bd_token(client: TestClient) -> str:
    res = client.post(
        "/auth/login",
        json={"email": "healthcare@test.local", "password": "password123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_1_bd_user_can_create_communication(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/communications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "contact_id": 1,
            "channel": "Email",
            "direction": "Outgoing",
            "subject": "Introduction to ELLY Hospital Intelligence",
            "summary": "Executive summary email sent to Joint Managing Director.",
            "content": "Detailed overview of clinical decision support and bed management modules.",
            "status": "Completed",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["subject"] == "Introduction to ELLY Hospital Intelligence"
    assert data["organization_id"] == 1
    assert data["organization_name"] is not None
    assert data["contact_id"] == 1
    assert data["channel"] == "Email"
    assert data["direction"] == "Outgoing"
    assert data["status"] == "Completed"


def test_2_bd_user_can_view_communication_details(client: TestClient):
    token = get_bd_token(client)
    # Create first
    create_res = client.post(
        "/api/business-development/communications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 2,
            "contact_id": 2,
            "channel": "Phone",
            "direction": "Incoming",
            "subject": "Call from Dr. Raghuvanshi",
            "summary": "Inquired about acute bed vacancy forecasting.",
        },
    )
    assert create_res.status_code == 201
    comm_id = create_res.json()["id"]

    # View details
    res = client.get(
        f"/api/business-development/communications/{comm_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == comm_id
    assert data["subject"] == "Call from Dr. Raghuvanshi"
    assert data["channel"] == "Phone"
    assert data["direction"] == "Incoming"


def test_3_bd_user_can_edit_communication(client: TestClient):
    token = get_bd_token(client)
    create_res = client.post(
        "/api/business-development/communications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "channel": "LinkedIn",
            "direction": "Outgoing",
            "subject": "Initial LinkedIn Outreach",
            "status": "Pending",
        },
    )
    assert create_res.status_code == 201
    comm_id = create_res.json()["id"]

    # Update
    update_res = client.patch(
        f"/api/business-development/communications/{comm_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "subject": "LinkedIn Message Accepted",
            "status": "Completed",
            "summary": "Contact accepted connection request and requested product deck.",
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["subject"] == "LinkedIn Message Accepted"
    assert updated["status"] == "Completed"
    assert "requested product deck" in updated["summary"]


def test_4_bd_user_can_delete_communication_soft_delete(client: TestClient):
    token = get_bd_token(client)
    create_res = client.post(
        "/api/business-development/communications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "channel": "Other",
            "direction": "Outgoing",
            "subject": "Temporary Log To Delete",
        },
    )
    assert create_res.status_code == 201
    comm_id = create_res.json()["id"]

    # Delete
    del_res = client.delete(
        f"/api/business-development/communications/{comm_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Verify 404
    get_res = client.get(
        f"/api/business-development/communications/{comm_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 404


def test_5_communication_associated_with_opportunity(client: TestClient):
    token = get_bd_token(client)
    # Create opportunity
    opp_res = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "name": "Phase 8 Comm Opportunity Test",
            "stage": "Discussion",
        },
    )
    assert opp_res.status_code == 201
    opp_id = opp_res.json()["id"]

    # Create communication linked to opportunity
    comm_res = client.post(
        "/api/business-development/communications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "opportunity_id": opp_id,
            "channel": "Email",
            "direction": "Outgoing",
            "subject": "Follow up regarding proposal commercial terms",
        },
    )
    assert comm_res.status_code == 201
    data = comm_res.json()
    assert data["opportunity_id"] == opp_id
    assert data["opportunity_name"] == "Phase 8 Comm Opportunity Test"


def test_6_communication_referencing_meeting_and_followup(client: TestClient):
    token = get_bd_token(client)
    # Meeting 1 and FollowUp 1 exist in seed
    comm_res = client.post(
        "/api/business-development/communications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "contact_id": 1,
            "meeting_id": 1,
            "followup_id": 1,
            "channel": "Video Call",
            "direction": "Outgoing",
            "subject": "Showcase recap and whitepaper delivery",
        },
    )
    assert comm_res.status_code == 201
    data = comm_res.json()
    assert data["meeting_id"] == 1
    assert data["followup_id"] == 1
    assert data["meeting_title"] is not None
    assert data["followup_title"] is not None


def test_7_invalid_contact_organization_relationship_rejected(client: TestClient):
    token = get_bd_token(client)
    # Contact 2 belongs to Org 2, NOT Org 1
    res = client.post(
        "/api/business-development/communications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "contact_id": 2,  # Belongs to org 2!
            "channel": "Email",
            "direction": "Outgoing",
            "subject": "Invalid Mismatched Contact Comm",
        },
    )
    assert res.status_code == 400
    assert "Selected contact does not belong to the specified organization" in res.json()["detail"]


def test_8_invalid_opportunity_organization_relationship_rejected(client: TestClient):
    token = get_bd_token(client)
    # Create Opp for Org 2
    opp_res = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 2,
            "name": "Org 2 Opportunity",
            "stage": "Meeting",
        },
    )
    opp_id = opp_res.json()["id"]

    # Try linking Opp to Org 1
    res = client.post(
        "/api/business-development/communications",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,  # Org 1
            "opportunity_id": opp_id,  # Belongs to Org 2!
            "channel": "Email",
            "direction": "Outgoing",
            "subject": "Invalid Mismatched Opp Comm",
        },
    )
    assert res.status_code == 400
    assert "Selected opportunity does not belong to the specified organization" in res.json()["detail"]


def test_9_search_communications(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/communications?search=whitepaper delivery",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert any("whitepaper delivery" in item["subject"].lower() for item in data["items"])


def test_10_filter_communications_by_channel_and_direction(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/communications?channel=Email&direction=Outgoing",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    for item in data["items"]:
        assert item["channel"] == "Email"
        assert item["direction"] == "Outgoing"


def test_11_relationship_timeline_endpoint(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/communications/timeline?organization_id=1",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "events" in data
    assert data["total_events"] >= 1
    # Check timeline events are ordered newest first
    timestamps = [datetime.fromisoformat(ev["timestamp"]) for ev in data["events"]]
    for i in range(len(timestamps) - 1):
        assert timestamps[i] >= timestamps[i + 1]


def test_12_unauthenticated_user_receives_401(client: TestClient):
    res = client.get("/api/business-development/communications")
    assert res.status_code == 401


def test_13_non_bd_user_receives_403(client: TestClient):
    token = get_non_bd_token(client)
    res = client.get(
        "/api/business-development/communications",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_14_nonexistent_communication_returns_404(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/communications/99999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
