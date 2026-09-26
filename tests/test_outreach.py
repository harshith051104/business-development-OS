import pytest
from datetime import datetime, timezone, timedelta
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


def create_test_setup(client: TestClient, token: str):
    # 1. Create Org
    org_res = client.post(
        "/api/business-development/organizations",
        json={"name": "Outreach Test Hospital", "organization_type": "Hospital", "city": "Bengaluru", "allow_duplicate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert org_res.status_code in [200, 201]
    org = org_res.json()

    # 2. Create Contact
    contact_res = client.post(
        "/api/business-development/contacts",
        json={"organization_id": org["id"], "first_name": "Dr. Outreach", "last_name": "Contact", "email": "outreach.lead@hospital.test", "designation": "Medical Director", "allow_duplicate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert contact_res.status_code in [200, 201]
    contact = contact_res.json()

    # 3. Create Opportunity
    opp_res = client.post(
        "/api/business-development/opportunities",
        json={"organization_id": org["id"], "primary_contact_id": contact["id"], "name": "Outreach Pilot Evaluation", "stage": "Potential", "priority": "High"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert opp_res.status_code in [200, 201]
    opp = opp_res.json()

    # 4. Get or Create Project
    proj_res = client.get("/api/business-development/showcase", headers={"Authorization": f"Bearer {token}"})
    items = proj_res.json()["items"]
    proj = items[0] if items else None

    return org, contact, opp, proj


def test_1_bd_user_can_create_draft(client: TestClient):
    token = get_bd_token(client)
    org, contact, opp, proj = create_test_setup(client, token)

    payload = {
        "organization_id": org["id"],
        "contact_id": contact["id"],
        "channel": "Email",
        "subject": "Introductory Outreach Draft",
        "message": "Hello, reaching out to connect.",
        "status": "Draft",
    }
    res = client.post(
        "/api/business-development/outreach/drafts",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["organization_id"] == org["id"]
    assert data["subject"] == "Introductory Outreach Draft"
    assert data["status"] == "Draft"


def test_2_bd_user_can_edit_draft(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    create_res = client.post(
        "/api/business-development/outreach/drafts",
        json={"organization_id": org["id"], "channel": "LinkedIn", "subject": "Draft v1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    draft_id = create_res.json()["id"]

    edit_res = client.patch(
        f"/api/business-development/outreach/drafts/{draft_id}",
        json={"subject": "Draft v2 Updated", "status": "Ready", "message": "Updated pitch message"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert edit_res.status_code == 200
    data = edit_res.json()
    assert data["subject"] == "Draft v2 Updated"
    assert data["status"] == "Ready"
    assert data["message"] == "Updated pitch message"


def test_3_bd_user_can_delete_draft(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    create_res = client.post(
        "/api/business-development/outreach/drafts",
        json={"organization_id": org["id"], "channel": "Phone", "call_purpose": "Discovery Call"},
        headers={"Authorization": f"Bearer {token}"},
    )
    draft_id = create_res.json()["id"]

    del_res = client.delete(
        f"/api/business-development/outreach/drafts/{draft_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 204

    # Verify not found
    get_res = client.get(
        f"/api/business-development/outreach/drafts/{draft_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 404


def test_4_draft_can_reference_organization_and_details(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    res = client.post(
        "/api/business-development/outreach/drafts",
        json={"organization_id": org["id"], "channel": "Email", "subject": "Org Reference Test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    assert res.json()["organization_name"] == org["name"]


def test_5_draft_can_reference_contact(client: TestClient):
    token = get_bd_token(client)
    org, contact, _, _ = create_test_setup(client, token)

    res = client.post(
        "/api/business-development/outreach/drafts",
        json={"organization_id": org["id"], "contact_id": contact["id"], "channel": "Email"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    assert res.json()["contact_name"] == contact["full_name"]


def test_6_draft_can_reference_opportunity(client: TestClient):
    token = get_bd_token(client)
    org, _, opp, _ = create_test_setup(client, token)

    res = client.post(
        "/api/business-development/outreach/drafts",
        json={"organization_id": org["id"], "opportunity_id": opp["id"], "channel": "Email"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    assert res.json()["opportunity_id"] == opp["id"]


def test_7_draft_can_reference_project(client: TestClient):
    token = get_bd_token(client)
    org, _, _, proj = create_test_setup(client, token)
    if not proj:
        pytest.skip("No project available")

    res = client.post(
        "/api/business-development/outreach/drafts",
        json={"organization_id": org["id"], "project_id": proj["id"], "channel": "Email"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    assert res.json()["project_id"] == proj["id"]


def test_8_templates_load_correctly(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/outreach/templates",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    templates = res.json()
    assert len(templates) >= 1
    first = templates[0]
    assert "name" in first
    assert "body" in first
    assert "channel" in first


def test_9_authorized_users_can_manage_templates(client: TestClient):
    token = get_bd_token(client)
    # Create template
    create_res = client.post(
        "/api/business-development/outreach/templates",
        json={
            "name": "Custom Strategic Pitch",
            "category": "Introduction",
            "channel": "Email",
            "subject": "Custom subject for {{organization_name}}",
            "body": "Hello {{contact_name}}, this is a custom pitch body.",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    tpl_id = create_res.json()["id"]

    # Edit template
    patch_res = client.patch(
        f"/api/business-development/outreach/templates/{tpl_id}",
        json={"subject": "Updated custom subject"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["subject"] == "Updated custom subject"

    # Delete template
    del_res = client.delete(
        f"/api/business-development/outreach/templates/{tpl_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 204


def test_10_communication_record_is_created_correctly_from_outreach(client: TestClient):
    token = get_bd_token(client)
    org, contact, _, _ = create_test_setup(client, token)

    # First save a draft
    draft_res = client.post(
        "/api/business-development/outreach/drafts",
        json={"organization_id": org["id"], "contact_id": contact["id"], "channel": "Email", "subject": "Test Outreach"},
        headers={"Authorization": f"Bearer {token}"},
    )
    draft_id = draft_res.json()["id"]

    # Record outreach
    record_payload = {
        "draft_id": draft_id,
        "organization_id": org["id"],
        "contact_id": contact["id"],
        "channel": "Email",
        "direction": "Outgoing",
        "subject": "Test Outreach Sent",
        "summary": "Sent platform overview via email",
        "notes": "Contact responded positively",
    }
    rec_res = client.post(
        "/api/business-development/outreach/record",
        json=record_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rec_res.status_code == 200
    data = rec_res.json()
    assert "communication_id" in data
    assert data["draft_id"] == draft_id

    # Verify draft is now marked Completed
    draft_check = client.get(
        f"/api/business-development/outreach/drafts/{draft_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert draft_check.json()["status"] == "Completed"


def test_11_existing_communication_service_is_reused(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    rec_res = client.post(
        "/api/business-development/outreach/record",
        json={
            "organization_id": org["id"],
            "channel": "LinkedIn",
            "summary": "Shared case study via LinkedIn InMail",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rec_res.status_code == 200
    comm_id = rec_res.json()["communication_id"]

    # Verify it exists in communications list
    comm_res = client.get(
        f"/api/business-development/communications/{comm_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert comm_res.status_code == 200
    assert comm_res.json()["summary"] == "Shared case study via LinkedIn InMail"


def test_12_followup_creation_integrates_correctly(client: TestClient):
    token = get_bd_token(client)
    org, contact, _, _ = create_test_setup(client, token)

    due_time = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    rec_res = client.post(
        "/api/business-development/outreach/record",
        json={
            "organization_id": org["id"],
            "contact_id": contact["id"],
            "channel": "Phone",
            "summary": "Intro call completed",
            "create_followup": True,
            "followup_title": "Send proposal after intro call",
            "followup_due_at": due_time,
            "followup_priority": "High",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rec_res.status_code == 200
    data = rec_res.json()
    assert data["followup_id"] is not None

    # Verify followup exists in followups endpoint
    fu_res = client.get(
        f"/api/business-development/followups/{data['followup_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert fu_res.status_code == 200
    assert fu_res.json()["title"] == "Send proposal after intro call"


def test_13_organization_status_update_requires_appropriate_user_action(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    # Case A: update_organization_status=False does not change org status
    rec_res = client.post(
        "/api/business-development/outreach/record",
        json={
            "organization_id": org["id"],
            "channel": "Email",
            "summary": "Check-in message",
            "update_organization_status": False,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rec_res.status_code == 200
    assert rec_res.json()["organization_status_updated"] is False

    # Case B: update_organization_status=True updates org status
    rec_res2 = client.post(
        "/api/business-development/outreach/record",
        json={
            "organization_id": org["id"],
            "channel": "Email",
            "summary": "First official outreach message",
            "update_organization_status": True,
            "new_organization_status": "Contacted",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert rec_res2.status_code == 200
    assert rec_res2.json()["organization_status_updated"] is True
    assert rec_res2.json()["new_organization_status"] == "Contacted"


def test_14_invalid_organization_contact_relationship_rejected(client: TestClient):
    token = get_bd_token(client)
    org1, _, _, _ = create_test_setup(client, token)

    # Create another org and contact
    org2_res = client.post(
        "/api/business-development/organizations",
        json={"name": "Separate Hospital Network", "organization_type": "Hospital", "allow_duplicate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    org2_id = org2_res.json()["id"]

    contact2_res = client.post(
        "/api/business-development/contacts",
        json={"organization_id": org2_id, "first_name": "Dr. Separate", "last_name": "Contact", "email": "separate@hospital.test", "allow_duplicate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    contact2_id = contact2_res.json()["id"]

    # Attempt to draft for org1 with contact from org2
    res = client.post(
        "/api/business-development/outreach/drafts",
        json={"organization_id": org1["id"], "contact_id": contact2_id, "channel": "Email"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
    assert "Contact does not belong" in res.json()["detail"]


def test_15_unauthorized_users_receive_403_on_outreach(client: TestClient):
    token = get_non_bd_token(client)
    res = client.get(
        "/api/business-development/outreach/drafts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_16_unauthenticated_users_receive_401_on_outreach(client: TestClient):
    res = client.get("/api/business-development/outreach/drafts")
    assert res.status_code == 401
