from datetime import datetime, timezone, timedelta
import pytest
from starlette.testclient import TestClient
from app.models.user import UserRole
from app.models.partnership import Partnership, PartnershipType, PartnershipStatus, PartnershipPriority
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.opportunity import Opportunity, OpportunityStage
from app.models.project import Project


def get_bd_token(client: TestClient) -> str:
    res = client.post("/auth/login", json={"email": "bd@test.local", "password": "password123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def get_non_bd_token(client: TestClient) -> str:
    res = client.post("/auth/login", json={"email": "healthcare@test.local", "password": "password123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def create_test_setup(client: TestClient, token: str):
    # 1. Create Org
    org_res = client.post(
        "/api/business-development/organizations",
        json={"name": "Apollo Partnership Health", "organization_type": "Hospital Group", "city": "Hyderabad", "allow_duplicate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert org_res.status_code in [200, 201]
    org = org_res.json()

    # 2. Create Contact
    contact_res = client.post(
        "/api/business-development/contacts",
        json={"organization_id": org["id"], "first_name": "Dr. Sarah", "last_name": "Jenkins", "email": "sarah.j@apollo.test", "designation": "Chief Strategy Officer", "allow_duplicate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert contact_res.status_code in [200, 201]
    contact = contact_res.json()

    # 3. Create Opportunity
    opp_res = client.post(
        "/api/business-development/opportunities",
        json={"organization_id": org["id"], "primary_contact_id": contact["id"], "name": "Apollo Platform Expansion", "stage": "Discussion", "priority": "High"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert opp_res.status_code in [200, 201]
    opp = opp_res.json()

    # 4. Get Project
    proj_res = client.get("/api/business-development/showcase", headers={"Authorization": f"Bearer {token}"})
    items = proj_res.json()["items"]
    proj = items[0] if items else None

    return org, contact, opp, proj


def test_1_bd_user_can_create_partnership(client: TestClient):
    token = get_bd_token(client)
    org, contact, opp, proj = create_test_setup(client, token)

    payload = {
        "organization_id": org["id"],
        "opportunity_id": opp["id"],
        "primary_contact_id": contact["id"],
        "project_id": proj["id"] if proj else None,
        "name": "Apollo Strategic Innovation Partnership",
        "partnership_type": "Strategic Partnership",
        "status": "Active",
        "priority": "High",
        "objectives": "Deploy enterprise AI integration across 5 regional clusters",
        "description": "Long-term co-development and integration alliance",
        "next_action": "Schedule quarterly business review",
    }

    res = client.post(
        "/api/business-development/partnerships",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == payload["name"]
    assert data["organization_id"] == org["id"]
    assert data["organization_name"] == org["name"]
    assert data["primary_contact_id"] == contact["id"]
    assert data["partnership_type"] == "Strategic Partnership"
    assert data["status"] == "Active"
    assert data["priority"] == "High"


def test_2_bd_user_can_view_partnership(client: TestClient):
    token = get_bd_token(client)
    org, contact, _, _ = create_test_setup(client, token)

    create_res = client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org["id"], "primary_contact_id": contact["id"], "name": "Apollo View Test", "partnership_type": "Technology Partnership"},
        headers={"Authorization": f"Bearer {token}"},
    )
    p_id = create_res.json()["id"]

    res = client.get(f"/api/business-development/partnerships/{p_id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["id"] == p_id
    assert res.json()["organization_name"] == org["name"]


def test_3_bd_user_can_edit_partnership(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    create_res = client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org["id"], "name": "Initial Partnership Name", "partnership_type": "Business Partnership"},
        headers={"Authorization": f"Bearer {token}"},
    )
    p_id = create_res.json()["id"]

    update_res = client.patch(
        f"/api/business-development/partnerships/{p_id}",
        json={"name": "Updated Partnership Alliance", "priority": "High", "objectives": "Expanded scope"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Partnership Alliance"
    assert update_res.json()["priority"] == "High"
    assert update_res.json()["objectives"] == "Expanded scope"


def test_4_bd_user_can_update_partnership_status(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    create_res = client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org["id"], "name": "Status Test Partnership", "partnership_type": "Service Partnership"},
        headers={"Authorization": f"Bearer {token}"},
    )
    p_id = create_res.json()["id"]

    # Transition to On Hold
    status_res = client.patch(
        f"/api/business-development/partnerships/{p_id}/status",
        json={"status": "On Hold", "notes": "Paused pending annual budget allocation"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "On Hold"

    # Transition to Completed
    status_res2 = client.patch(
        f"/api/business-development/partnerships/{p_id}/status",
        json={"status": "Completed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status_res2.status_code == 200
    assert status_res2.json()["status"] == "Completed"


def test_5_bd_user_can_assign_owner(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    create_res = client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org["id"], "name": "Owner Assignment Partnership", "partnership_type": "Integration Partnership"},
        headers={"Authorization": f"Bearer {token}"},
    )
    p_id = create_res.json()["id"]

    owner_res = client.patch(
        f"/api/business-development/partnerships/{p_id}/owner",
        json={"owner_id": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert owner_res.status_code == 200
    assert owner_res.json()["owner_id"] == 1


def test_6_bd_user_can_delete_archive_partnership(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    create_res = client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org["id"], "name": "Delete Test Partnership"},
        headers={"Authorization": f"Bearer {token}"},
    )
    p_id = create_res.json()["id"]

    del_res = client.delete(f"/api/business-development/partnerships/{p_id}", headers={"Authorization": f"Bearer {token}"})
    assert del_res.status_code == 200

    # Verify not found in active listings
    get_res = client.get(f"/api/business-development/partnerships/{p_id}", headers={"Authorization": f"Bearer {token}"})
    assert get_res.status_code == 404


def test_7_opportunity_can_convert_to_partnership(client: TestClient):
    token = get_bd_token(client)
    org, contact, opp, proj = create_test_setup(client, token)

    convert_res = client.post(
        f"/api/business-development/opportunities/{opp['id']}/convert-to-partnership",
        json={
            "name": "Apollo Converted Alliance",
            "partnership_type": "Technology Partnership",
            "priority": "High",
            "update_organization_status": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert convert_res.status_code == 201
    p_data = convert_res.json()
    assert p_data["name"] == "Apollo Converted Alliance"
    assert p_data["opportunity_id"] == opp["id"]
    assert p_data["status"] == "Active"

    # Verify Opportunity stage is now Partnership
    opp_verify = client.get(f"/api/business-development/opportunities/{opp['id']}", headers={"Authorization": f"Bearer {token}"})
    assert opp_verify.status_code == 200
    assert opp_verify.json()["stage"] == "Partnership"

    # Verify Organization status is now Partnership
    org_verify = client.get(f"/api/business-development/organizations/{org['id']}", headers={"Authorization": f"Bearer {token}"})
    assert org_verify.status_code == 200
    assert org_verify.json()["status"] == "Partnership"


def test_8_organization_relationship_is_valid(client: TestClient):
    token = get_bd_token(client)

    # Invalid organization ID
    res = client.post(
        "/api/business-development/partnerships",
        json={"organization_id": 999999, "name": "Invalid Org Partnership"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
    assert "Organization not found" in res.json()["detail"]


def test_9_contact_must_belong_to_organization(client: TestClient):
    token = get_bd_token(client)
    org1, _, _, _ = create_test_setup(client, token)

    # Create second org and contact
    org2_res = client.post(
        "/api/business-development/organizations",
        json={"name": "Separate Network", "organization_type": "Clinic", "allow_duplicate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    org2 = org2_res.json()
    contact2_res = client.post(
        "/api/business-development/contacts",
        json={"organization_id": org2["id"], "first_name": "Foreign", "last_name": "Contact", "allow_duplicate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    contact2 = contact2_res.json()

    # Attempt to link org1 with contact2
    res = client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org1["id"], "primary_contact_id": contact2["id"], "name": "Mismatch Partnership"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
    assert "Primary contact does not belong" in res.json()["detail"]


def test_10_project_relationship_is_valid(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    res = client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org["id"], "project_id": 999999, "name": "Invalid Proj Partnership"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
    assert "Showcase project not found" in res.json()["detail"]


def test_11_duplicate_partnership_detection_works(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    # First creation
    res1 = client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org["id"], "name": "Unique Alliance", "allow_duplicate": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res1.status_code == 201

    # Second creation with same name
    res2 = client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org["id"], "name": "Unique Alliance", "allow_duplicate": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_12_date_validation_works(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    now = datetime.now(timezone.utc)
    start = now + timedelta(days=30)
    end = now + timedelta(days=10)  # End before start

    res = client.post(
        "/api/business-development/partnerships",
        json={
            "organization_id": org["id"],
            "name": "Invalid Date Partnership",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code in [400, 422]


def test_13_next_action_logic_works(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    now = datetime.now(timezone.utc)
    # Partnership ending in 15 days, no next action -> should be ending soon and need attention
    res = client.post(
        "/api/business-development/partnerships",
        json={
            "organization_id": org["id"],
            "name": "Ending Soon Partnership",
            "end_date": (now + timedelta(days=15)).isoformat(),
            "next_action": None,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["is_ending_soon"] is True
    assert data["needs_attention"] is True


def test_14_organization_profile_shows_partnerships(client: TestClient):
    token = get_bd_token(client)
    org, _, _, _ = create_test_setup(client, token)

    client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org["id"], "name": "Org Check Alliance"},
        headers={"Authorization": f"Bearer {token}"},
    )

    list_res = client.get(f"/api/business-development/partnerships?organization_id={org['id']}", headers={"Authorization": f"Bearer {token}"})
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1


def test_15_contact_profile_shows_partnerships(client: TestClient):
    token = get_bd_token(client)
    org, contact, _, _ = create_test_setup(client, token)

    client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org["id"], "primary_contact_id": contact["id"], "name": "Contact Partnership"},
        headers={"Authorization": f"Bearer {token}"},
    )

    p_res = client.get(f"/api/business-development/partnerships?search={contact['first_name']}", headers={"Authorization": f"Bearer {token}"})
    assert p_res.status_code == 200
    assert p_res.json()["total"] >= 1


def test_16_partnership_activity_is_recorded(client: TestClient):
    token = get_bd_token(client)
    org, contact, _, _ = create_test_setup(client, token)

    create_res = client.post(
        "/api/business-development/partnerships",
        json={"organization_id": org["id"], "primary_contact_id": contact["id"], "name": "Activity Logging Partnership"},
        headers={"Authorization": f"Bearer {token}"},
    )
    p_id = create_res.json()["id"]

    # Verify contact activities includes partnership_created
    contact_res = client.get(f"/api/business-development/contacts/{contact['id']}", headers={"Authorization": f"Bearer {token}"})
    assert contact_res.status_code == 200
    activities = contact_res.json().get("activities", [])
    assert any(a["activity_type"] == "partnership_created" for a in activities)


def test_17_unauthenticated_user_receives_401(client: TestClient):
    res = client.get("/api/business-development/partnerships")
    assert res.status_code == 401


def test_18_non_bd_user_receives_403(client: TestClient):
    token = get_non_bd_token(client)
    res = client.get("/api/business-development/partnerships", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
