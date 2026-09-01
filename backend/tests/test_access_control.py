from datetime import timedelta
from app.core.security import create_access_token
from app.models.user import UserRole


def test_1_successful_bd_login(client):
    """1. Test successful login for a user with the BUSINESS_DEVELOPMENT role."""
    response = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "bd@test.local"
    assert data["user"]["role"] == UserRole.BUSINESS_DEVELOPMENT.value
    assert data["user"]["name"] == "BD Test User"


def test_2_failed_login_invalid_password(client):
    """2. Test failed login when an incorrect password is provided."""
    response = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    data = response.json()
    assert "detail" in data
    assert "Invalid email or password" in data["detail"]


def test_3_failed_login_unknown_user(client):
    """3. Test failed login for a non-existent email address."""
    response = client.post(
        "/auth/login",
        json={"email": "nonexistent@company.internal", "password": "password123"},
    )
    assert response.status_code == 401
    data = response.json()
    assert "detail" in data
    assert "Invalid email or password" in data["detail"]


def test_4_authenticated_bd_user_can_access_bd_route(client):
    """4. Test that an authenticated BUSINESS_DEVELOPMENT user can access the BD portal endpoint."""
    # Login first
    login_res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    token = login_res.json()["access_token"]

    # Access protected BD endpoint
    response = client.get(
        "/api/business-development/access",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "authorized"
    assert data["user"]["role"] == UserRole.BUSINESS_DEVELOPMENT.value
    assert "Access granted" in data["message"]


def test_5_unauthenticated_user_receives_401(client):
    """5. Test that unauthenticated requests receive 401 Unauthorized."""
    # No Authorization header
    response = client.get("/api/business-development/access")
    assert response.status_code == 401

    # Also test /auth/me without token
    me_response = client.get("/auth/me")
    assert me_response.status_code == 401


def test_6_authenticated_non_bd_user_receives_403(client):
    """6. Test that users with unauthorized roles are denied access with 403 Forbidden."""
    non_bd_emails = [
        ("healthcare@test.local", "HEALTHCARE"),
        ("user@test.local", "USER"),
    ]

    for email, role_name in non_bd_emails:
        login_res = client.post(
            "/auth/login",
            json={"email": email, "password": "password123"},
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]

        # Attempt to access BD route
        response = client.get(
            "/api/business-development/access",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403
        data = response.json()
        assert "Access denied" in data["detail"]
        assert role_name in data["detail"]


def test_7_expired_or_invalid_token_is_rejected(client):
    """7. Test that expired, malformed, or fake tokens are rejected with 401 Unauthorized."""
    # Malformed token
    res_malformed = client.get(
        "/api/business-development/access",
        headers={"Authorization": "Bearer invalid.token.value"},
    )
    assert res_malformed.status_code == 401

    # Expired token
    expired_token = create_access_token(
        data={"sub": "bd@test.local", "role": "BUSINESS_DEVELOPMENT"},
        expires_delta=timedelta(seconds=-60),  # expired in the past
    )
    res_expired = client.get(
        "/api/business-development/access",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res_expired.status_code == 401


def test_8_logout_works_correctly(client):
    """8. Test the logout endpoint returns a successful response."""
    response = client.post("/auth/logout")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "logged out" in data["message"].lower()


def test_9_auth_me_endpoint_returns_current_user(client):
    """Verify GET /auth/me returns the profile for the authenticated token."""
    login_res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    token = login_res.json()["access_token"]

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "bd@test.local"
    assert data["name"] == "BD Test User"
    assert data["role"] == "BUSINESS_DEVELOPMENT"
    assert data["is_active"] is True


def test_10_inactive_user_cannot_login_or_access(client):
    """Verify deactivated user accounts cannot authenticate or access endpoints."""
    # Attempt login
    login_res = client.post(
        "/auth/login",
        json={"email": "inactive_bd@test.local", "password": "password123"},
    )
    assert login_res.status_code == 401
    assert "deactivated" in login_res.json()["detail"].lower() or "inactive" in login_res.json()["detail"].lower()
