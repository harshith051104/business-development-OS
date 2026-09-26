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


def test_1_bd_user_can_create_opportunity(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "primary_contact_id": 1,
            "project_id": 1,
            "name": "ELLY Platform Acute Care Deployment",
            "description": "Deployment of bed management across 5 hospital branches.",
            "stage": "Discussion",
            "priority": "High",
            "estimated_value": 150000.0,
            "currency": "USD",
            "probability": 75,
            "next_action": "Schedule executive presentation with CFO",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "ELLY Platform Acute Care Deployment"
    assert data["organization_id"] == 1
    assert data["organization_name"] is not None
    assert data["primary_contact_id"] == 1
    assert data["primary_contact_name"] == "Sangita Reddy"
    assert data["stage"] == "Discussion"
    assert data["priority"] == "High"
    assert data["estimated_value"] == 150000.0
    assert data["has_next_action"] is True


def test_2_bd_user_can_view_opportunity_details(client: TestClient):
    token = get_bd_token(client)
    # First create
    create_res = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 2,
            "primary_contact_id": 2,
            "name": "Fortis Clinical Analytics Pilot",
            "stage": "Meeting",
            "priority": "Medium",
            "next_action": "Send technical architecture deck",
        },
    )
    assert create_res.status_code == 201
    opp_id = create_res.json()["id"]

    # View Details
    res = client.get(
        f"/api/business-development/opportunities/{opp_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == opp_id
    assert data["name"] == "Fortis Clinical Analytics Pilot"
    assert "activities" in data
    assert "meetings" in data
    assert "followups" in data
    assert len(data["activities"]) >= 1  # opportunity_created activity recorded


def test_3_bd_user_can_edit_opportunity(client: TestClient):
    token = get_bd_token(client)
    create_res = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "name": "Apollo Bed Management Evaluation",
            "stage": "Connected",
            "priority": "Low",
        },
    )
    assert create_res.status_code == 201
    opp_id = create_res.json()["id"]

    # Update
    update_res = client.patch(
        f"/api/business-development/opportunities/{opp_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Apollo Bed Management Expansion",
            "priority": "High",
            "estimated_value": 80010.0,
            "probability": 50,
            "next_action": "Conduct on-site demo",
        },
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["name"] == "Apollo Bed Management Expansion"
    assert updated["priority"] == "High"
    assert updated["estimated_value"] == 80010.0
    assert updated["probability"] == 50
    assert updated["next_action"] == "Conduct on-site demo"


def test_4_bd_user_can_delete_opportunity_soft_delete(client: TestClient):
    token = get_bd_token(client)
    create_res = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "name": "Opportunity To Delete",
            "stage": "Potential",
        },
    )
    opp_id = create_res.json()["id"]

    # Delete
    del_res = client.delete(
        f"/api/business-development/opportunities/{opp_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Verify not found on subsequent get
    get_res = client.get(
        f"/api/business-development/opportunities/{opp_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 404


def test_5_bd_user_can_change_stage(client: TestClient):
    token = get_bd_token(client)
    create_res = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 2,
            "name": "Fortis Stage Progression Opportunity",
            "stage": "Connected",
        },
    )
    opp_id = create_res.json()["id"]

    stage_res = client.patch(
        f"/api/business-development/opportunities/{opp_id}/stage",
        headers={"Authorization": f"Bearer {token}"},
        json={"stage": "Discussion", "note": "Moved forward following successful demo."},
    )
    assert stage_res.status_code == 200
    assert stage_res.json()["stage"] == "Discussion"


def test_6_bd_user_can_assign_owner_and_add_note(client: TestClient):
    token = get_bd_token(client)
    create_res = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "name": "Apollo Ownership & Note Opportunity",
            "stage": "Interested",
        },
    )
    opp_id = create_res.json()["id"]

    # Assign owner
    owner_res = client.patch(
        f"/api/business-development/opportunities/{opp_id}/owner",
        headers={"Authorization": f"Bearer {token}"},
        json={"owner_id": 1, "note": "Assigned to primary BD lead."},
    )
    assert owner_res.status_code == 200
    assert owner_res.json()["owner_id"] == 1

    # Add Note
    note_res = client.post(
        f"/api/business-development/opportunities/{opp_id}/notes",
        headers={"Authorization": f"Bearer {token}"},
        json={"note": "Client requested commercial contract draft by Friday."},
    )
    assert note_res.status_code == 200
    assert "Client requested commercial contract draft" in note_res.json()["notes"]


def test_7_contact_must_belong_to_organization_validation(client: TestClient):
    token = get_bd_token(client)
    # Contact 2 belongs to Org 2, NOT Org 1
    res = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "primary_contact_id": 2,  # Belongs to org 2!
            "name": "Invalid Contact Organization Mismatch",
            "stage": "Discussion",
        },
    )
    assert res.status_code == 400
    assert "Selected contact does not belong to the specified organization" in res.json()["detail"]


def test_8_project_relationship_validation(client: TestClient):
    token = get_bd_token(client)
    # Nonexistent project
    res = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "project_id": 9999,  # Does not exist
            "name": "Invalid Project Opportunity",
            "stage": "Discussion",
        },
    )
    assert res.status_code == 400
    assert "Associated showcase project does not exist" in res.json()["detail"]


def test_9_duplicate_opportunity_detection(client: TestClient):
    token = get_bd_token(client)
    # Create first
    res1 = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "name": "Duplicate Test Opportunity",
            "stage": "Potential",
        },
    )
    assert res1.status_code == 201

    # Try duplicate with same name & org
    res2 = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "name": "duplicate test opportunity",  # Case-insensitive duplicate
            "stage": "Potential",
        },
    )
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_10_invalid_probability_rejected(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "name": "Invalid Probability Opp",
            "probability": 150,  # Invalid > 100
        },
    )
    assert res.status_code == 422  # Pydantic validation


def test_11_search_and_filter_opportunities(client: TestClient):
    token = get_bd_token(client)
    # Search
    search_res = client.get(
        "/api/business-development/opportunities?search=Acute Care",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert search_res.status_code == 200
    data = search_res.json()
    assert data["total"] >= 1
    assert any("Acute Care" in item["name"] for item in data["items"])

    # Filter by stage
    stage_res = client.get(
        "/api/business-development/opportunities?stage=Discussion",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert stage_res.status_code == 200
    assert all(item["stage"] == "Discussion" for item in stage_res.json()["items"])


def test_12_no_next_action_identification(client: TestClient):
    token = get_bd_token(client)
    # Create opportunity with no next action
    client.post(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 2,
            "name": "Opportunity With No Next Action",
            "stage": "Interested",
            "next_action": None,
        },
    )

    # Filter with no_next_action=true
    res = client.get(
        "/api/business-development/opportunities?no_next_action=true",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["no_next_action_count"] >= 1
    for item in data["items"]:
        assert item["has_next_action"] is False


def test_13_unauthenticated_and_non_bd_user_rejected(client: TestClient):
    # Unauthenticated
    unauth_res = client.get("/api/business-development/opportunities")
    assert unauth_res.status_code == 401

    # Non-BD user (e.g. Healthcare role)
    non_bd_token = get_non_bd_token(client)
    forbidden_res = client.get(
        "/api/business-development/opportunities",
        headers={"Authorization": f"Bearer {non_bd_token}"},
    )
    assert forbidden_res.status_code == 403


def test_14_kanban_connections_pipeline(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/connections/pipeline",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "columns" in data
    assert len(data["columns"]) == 7
    stages = [col["stage"] for col in data["columns"]]
    assert stages == [
        "Potential",
        "Contacted",
        "Connected",
        "Interested",
        "Meeting",
        "Discussion",
        "Partnership",
    ]
    assert data["total_organizations"] >= 95


def test_15_move_organization_stage(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/connections/move-stage",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "organization_id": 1,
            "new_stage": "Meeting",
            "note": "Moved to Meeting after successful pitch call.",
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert res.json()["new_stage"] == "Meeting"
