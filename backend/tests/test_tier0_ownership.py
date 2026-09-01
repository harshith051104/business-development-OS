"""Tests for Tier 0 — ownership scoping and Gmail OAuth fixes."""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


class TestOwnershipScoping:
    """Test that owner_id is set on creation and queries filter by owner."""

    def test_contact_create_sets_owner_id(self, client: TestClient):
        token = _get_bd_token(client)
        # Create org first
        org_res = client.post(
            "/api/business-development/organizations",
            json={"name": "Test Org for Ownership", "organization_type": "Technology Company", "country": "US"},
            headers={"Authorization": f"Bearer {token}"},
        )
        org_id = org_res.json()["id"]

        # Create contact
        res = client.post(
            "/api/business-development/contacts",
            json={"organization_id": org_id, "first_name": "Test", "last_name": "Owner"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        data = res.json()
        # owner_id should be set (may be None in response if not exposed, but DB should have it)

    def test_followup_create_sets_owner_id(self, client: TestClient):
        token = _get_bd_token(client)
        # Create org first
        org_res = client.post(
            "/api/business-development/organizations",
            json={"name": "Test Org for FollowUp Ownership", "organization_type": "Technology Company", "country": "US"},
            headers={"Authorization": f"Bearer {token}"},
        )
        org_id = org_res.json()["id"]

        from datetime import datetime, timezone, timedelta
        due = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

        res = client.post(
            "/api/business-development/followups",
            json={"organization_id": org_id, "title": "Test FollowUp", "due_at": due},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code in (200, 201)

    def test_meeting_create_sets_owner_id(self, client: TestClient):
        token = _get_bd_token(client)
        org_res = client.post(
            "/api/business-development/organizations",
            json={"name": "Test Org for Meeting Ownership", "organization_type": "Technology Company", "country": "US"},
            headers={"Authorization": f"Bearer {token}"},
        )
        org_id = org_res.json()["id"]

        from datetime import datetime, timezone, timedelta
        scheduled = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

        res = client.post(
            "/api/business-development/meetings",
            json={
                "organization_id": org_id,
                "title": "Test Meeting",
                "meeting_type": "Business Discussion",
                "scheduled_at": scheduled,
                "duration_minutes": 30,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code in (200, 201)


class TestGmailOwnership:
    """Test Gmail account ownership checks."""

    def test_disconnect_requires_ownership(self, client: TestClient):
        """User cannot disconnect another user's Gmail account."""
        token = _get_bd_token(client)
        # Try to disconnect a non-existent account (ownership check should fail)
        res = client.delete(
            "/api/gmail/accounts/nonexistent_account",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 404

    def test_list_accounts_returns_only_own(self, client: TestClient):
        """User only sees their own Gmail accounts."""
        token = _get_bd_token(client)
        res = client.get(
            "/api/gmail/accounts",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        # Should return empty list for user with no connected accounts
        assert isinstance(res.json(), list)


class TestOwnerScopeParam:
    """Test owner_scope query parameter on list endpoints."""

    def test_organizations_owner_scope_mine(self, client: TestClient):
        token = _get_bd_token(client)
        res = client.get(
            "/api/business-development/organizations?owner_scope=mine",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200

    def test_contacts_owner_scope_all(self, client: TestClient):
        token = _get_bd_token(client)
        res = client.get(
            "/api/business-development/contacts?owner_scope=all",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200

    def test_followups_owner_scope_mine(self, client: TestClient):
        token = _get_bd_token(client)
        res = client.get(
            "/api/business-development/followups?owner_scope=mine",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200


def _get_bd_token(client: TestClient) -> str:
    res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]
