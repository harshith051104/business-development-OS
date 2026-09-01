import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import create_access_token


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


def test_1_unauthenticated_api_access_returns_401(client: TestClient):
    endpoints = [
        "/api/business-development/organizations",
        "/api/business-development/contacts",
        "/api/business-development/opportunities",
        "/api/business-development/meetings",
        "/api/business-development/followups",
        "/api/business-development/communications",
        "/api/business-development/analytics/overview",
        "/api/business-development/audit-logs",
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 401


def test_2_wrong_role_api_access_returns_403(client: TestClient):
    token = get_non_bd_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    endpoints = [
        "/api/business-development/organizations",
        "/api/business-development/contacts",
        "/api/business-development/opportunities",
        "/api/business-development/meetings",
        "/api/business-development/followups",
        "/api/business-development/communications",
        "/api/business-development/analytics/overview",
        "/api/business-development/audit-logs",
    ]
    for ep in endpoints:
        res = client.get(ep, headers=headers)
        assert res.status_code == 403


def test_3_invalid_jwt_token_returns_401(client: TestClient):
    res = client.get(
        "/api/business-development/organizations",
        headers={"Authorization": "Bearer invalid.fake.token"},
    )
    assert res.status_code == 401


def test_4_expired_jwt_token_returns_401(client: TestClient):
    expired_token = create_access_token(
        data={"sub": "bd@test.local", "user_id": 1, "role": "BUSINESS_DEVELOPMENT"},
        expires_delta=timedelta(seconds=-10),
    )
    res = client.get(
        "/api/business-development/organizations",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res.status_code == 401


def test_5_invalid_resource_id_returns_404(client: TestClient):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/organizations/9999999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


def test_6_sql_injection_defense_via_parameterization(client: TestClient):
    token = get_bd_token(client)
    malicious_query = "' OR 1=1; DROP TABLE users; --"
    res = client.get(
        f"/api/business-development/organizations?search={malicious_query}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    # Table should still exist and app responds normally
    res_check = client.get(
        "/api/business-development/organizations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_check.status_code == 200


def test_7_xss_payload_stored_safely(client: TestClient):
    token = get_bd_token(client)
    xss_payload = {
        "name": f"Security Hospital <script>alert(1)</script> {datetime.now().timestamp()}",
        "organization_type": "Hospital",
        "description": "<img src=x onerror=alert('xss')>",
        "priority": "Medium",
    }
    res = client.post(
        "/api/business-development/organizations",
        json=xss_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert "<script>" in data["name"]
    assert "<img" in data["description"]


def test_8_csv_formula_injection_defense(client: TestClient):
    token = get_bd_token(client)
    # Create an opportunity with formula payload
    org_res = client.post(
        "/api/business-development/organizations",
        json={
            "name": f"Formula Org {datetime.now().timestamp()}",
            "organization_type": "Hospital",
            "priority": "High",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = org_res.json()["id"]

    opp_res = client.post(
        "/api/business-development/opportunities",
        json={
            "name": "=CMD|' /C calc'!A0",
            "organization_id": org_id,
            "stage": "Meeting",
            "priority": "High",
            "next_action": "+2+2",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert opp_res.status_code == 201

    # Fetch CSV export
    csv_res = client.get(
        "/api/business-development/analytics/export?date_range=all_time",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert csv_res.status_code == 200
    content = csv_res.text
    # Cell values should be escaped with leading quote
    assert "'=CMD|' /C calc'!A0" in content or "'=CMD|" in content


def test_9_security_headers_present_on_response(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert res.headers.get("X-XSS-Protection") == "1; mode=block"


def test_10_health_and_readiness_endpoints(client: TestClient):
    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"
    assert res_health.json()["database"] == "ok"

    res_ready = client.get("/ready")
    assert res_ready.status_code == 200
    assert res_ready.json()["status"] == "ready"


def test_11_audit_logging_flow(client: TestClient):
    token = get_bd_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Query audit logs
    res = client.get("/api/business-development/audit-logs", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1
    assert any(log["action"] in ["LOGIN_SUCCESS", "ORGANIZATION_CREATED"] for log in data["items"])
