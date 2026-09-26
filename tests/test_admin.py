import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.models.opportunity import Opportunity
from app.models.partnership import Partnership


def get_token(client: TestClient, email: str = "admin@test.local", password: str = "password123") -> str:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def test_1_admin_can_access_admin_dashboard(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "total_users" in data
    assert "active_bd_users" in data
    assert "active_organizations" in data
    assert "active_opportunities" in data
    assert "active_partnerships" in data
    assert "recent_system_activity" in data


def test_2_admin_can_create_user(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    email = "new_bd_rep@test.local"
    res = client.post(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Sarah Connor",
            "email": email,
            "password": "password123",
            "role": "BUSINESS_DEVELOPMENT",
            "is_active": True,
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Sarah Connor"
    assert data["email"] == email
    assert data["role"] == "BUSINESS_DEVELOPMENT"
    assert data["is_active"] is True
    assert "password" not in data
    assert "password_hash" not in data


def test_3_admin_can_edit_user(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.get("/api/admin/users?search=Sarah", headers={"Authorization": f"Bearer {token}"})
    user_id = res.json()["items"][0]["id"]

    edit_res = client.patch(
        f"/api/admin/users/{user_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Sarah Connor-Smith"},
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["name"] == "Sarah Connor-Smith"


def test_4_admin_can_deactivate_user(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.get("/api/admin/users?search=Sarah", headers={"Authorization": f"Bearer {token}"})
    user_id = res.json()["items"][0]["id"]

    stat_res = client.patch(
        f"/api/admin/users/{user_id}/status",
        headers={"Authorization": f"Bearer {token}"},
        json={"is_active": False},
    )
    assert stat_res.status_code == 200
    assert stat_res.json()["is_active"] is False


def test_5_admin_can_change_role(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.get("/api/admin/users?search=Sarah", headers={"Authorization": f"Bearer {token}"})
    user_id = res.json()["items"][0]["id"]

    role_res = client.patch(
        f"/api/admin/users/{user_id}/role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "ADMIN"},
    )
    assert role_res.status_code == 200
    assert role_res.json()["role"] == "ADMIN"


def test_6_business_development_cannot_access_admin_apis(client: TestClient):
    token = get_token(client, "bd@test.local", "password123")
    res = client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_7_unauthenticated_users_receive_401(client: TestClient):
    res = client.get("/api/admin/dashboard")
    assert res.status_code == 401


def test_8_wrong_role_receives_403(client: TestClient):
    token = get_token(client, "healthcare@test.local", "password123")
    res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_9_last_active_admin_cannot_be_deactivated(client: TestClient, db_session: Session):
    token = get_token(client, "admin@test.local", "password123")

    # Demote extra admins first so only 1 active admin exists
    admin_users = db_session.query(User).filter(User.role == UserRole.ADMIN.value).all()
    primary_admin = db_session.query(User).filter(User.email == "admin@test.local").first()
    for a in admin_users:
        if a.id != primary_admin.id:
            a.role = UserRole.BUSINESS_DEVELOPMENT.value
    db_session.commit()

    # Attempt to deactivate last active admin
    res = client.patch(
        f"/api/admin/users/{primary_admin.id}/status",
        headers={"Authorization": f"Bearer {token}"},
        json={"is_active": False},
    )
    assert res.status_code == 400
    assert "At least one active administrator is required" in res.json()["detail"]


def test_10_user_ownership_assignment_works(client: TestClient, db_session: Session):
    token = get_token(client, "admin@test.local", "password123")
    bd_user = db_session.query(User).filter(User.email == "bd@test.local").first()

    org = Organization(name="Ownership Test Hospital", organization_type="Hospital")
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    res = client.patch(
        f"/api/admin/organizations/{org.id}/owner",
        headers={"Authorization": f"Bearer {token}"},
        json={"owner_id": bd_user.id},
    )
    assert res.status_code == 200
    assert res.json()["owner_id"] == bd_user.id


def test_11_opportunity_ownership_assignment_works(client: TestClient, db_session: Session):
    token = get_token(client, "admin@test.local", "password123")
    bd_user = db_session.query(User).filter(User.email == "bd@test.local").first()

    org = db_session.query(Organization).first()
    opp = Opportunity(name="Ownership Test Opp", organization_id=org.id, stage="Potential")
    db_session.add(opp)
    db_session.commit()
    db_session.refresh(opp)

    res = client.patch(
        f"/api/admin/opportunities/{opp.id}/owner",
        headers={"Authorization": f"Bearer {token}"},
        json={"owner_id": bd_user.id},
    )
    assert res.status_code == 200
    assert res.json()["owner_id"] == bd_user.id


def test_12_partnership_ownership_assignment_works(client: TestClient, db_session: Session):
    token = get_token(client, "admin@test.local", "password123")
    bd_user = db_session.query(User).filter(User.email == "bd@test.local").first()

    org = db_session.query(Organization).first()
    part = Partnership(
        name="Ownership Test Partnership",
        organization_id=org.id,
        partnership_type="Business Partnership",
        status="Active",
    )
    db_session.add(part)
    db_session.commit()
    db_session.refresh(part)

    res = client.patch(
        f"/api/admin/partnerships/{part.id}/owner",
        headers={"Authorization": f"Bearer {token}"},
        json={"owner_id": bd_user.id},
    )
    assert res.status_code == 200
    assert res.json()["owner_id"] == bd_user.id


def test_13_project_creation_works(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.post(
        "/api/admin/showcase",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "ELLY Governance Shield",
            "short_description": "Administrative intelligence and compliance portal",
            "description": "Comprehensive security and operational management system.",
            "category": "Healthcare",
            "status": "Draft",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "ELLY Governance Shield"
    assert data["status"] == "Draft"


def test_14_project_publishing_works(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.get("/api/admin/showcase?search=Governance", headers={"Authorization": f"Bearer {token}"})
    proj_id = res.json()["items"][0]["id"]

    pub_res = client.patch(
        f"/api/admin/showcase/{proj_id}/status",
        headers={"Authorization": f"Bearer {token}"},
        json={"status": "Published"},
    )
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "Published"


def test_15_project_archiving_works(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.get("/api/admin/showcase?search=Governance", headers={"Authorization": f"Bearer {token}"})
    proj_id = res.json()["items"][0]["id"]

    del_res = client.delete(
        f"/api/admin/showcase/{proj_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 200


def test_16_audit_logs_are_generated(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] > 0
    assert len(data["items"]) > 0


def test_17_audit_log_filtering_works(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.get("/api/admin/audit-logs?resource_type=USER", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    for item in res.json()["items"]:
        assert item["resource_type"] == "USER"


def test_18_invalid_role_changes_are_rejected(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    user_id = res.json()["items"][0]["id"]

    bad_res = client.patch(
        f"/api/admin/users/{user_id}/role",
        headers={"Authorization": f"Bearer {token}"},
        json={"role": "SUPER_SUPER_ADMIN"},
    )
    assert bad_res.status_code == 422


def test_19_duplicate_email_is_rejected(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.post(
        "/api/admin/users",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Duplicate User",
            "email": "admin@test.local",
            "password": "password123",
            "role": "ADMIN",
        },
    )
    assert res.status_code == 409


def test_20_sensitive_credentials_are_never_returned(client: TestClient):
    token = get_token(client, "admin@test.local", "password123")
    res = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    for item in res.json()["items"]:
        assert "password" not in item
        assert "password_hash" not in item
        assert "access_token" not in item
