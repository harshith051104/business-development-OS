import pytest
from app.models.organization import Organization, OrganizationType, ConnectionStatus, PriorityLevel


def get_bd_token(client):
    res = client.post("/auth/login", json={"email": "bd@test.local", "password": "password123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def get_non_bd_token(client):
    res = client.post("/auth/login", json={"email": "healthcare@test.local", "password": "password123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_1_bd_user_can_list_organizations(client, db_session):
    """1. Test BD user can retrieve paginated list of organizations."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/organizations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "total_pages" in data
    assert isinstance(data["items"], list)


def test_2_bd_user_can_create_organization(client, db_session):
    """2. Test creating a new organization with valid data."""
    token = get_bd_token(client)
    payload = {
        "name": "St. Jude Health Network",
        "organization_type": "Hospital",
        "city": "Hyderabad",
        "state": "Telangana",
        "country": "India",
        "priority": "High",
        "status": "Potential",
        "description": "Premier multispeciality center",
        "website": "https://www.stjudehealth.org",
    }
    res = client.post(
        "/api/business-development/organizations",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "St. Jude Health Network"
    assert data["organization_type"] == "Hospital"
    assert data["priority"] == "High"
    assert data["status"] == "Potential"
    assert data["is_deleted"] is False


def test_3_duplicate_organization_detection(client, db_session):
    """3. Test duplicate organization name warning/rejection."""
    token = get_bd_token(client)
    # Check duplicate endpoint
    chk_res = client.get(
        "/api/business-development/organizations/check-duplicate?name=St. Jude Health Network",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert chk_res.status_code == 200
    assert chk_res.json()["is_duplicate"] is True

    # Attempt creation without allow_duplicate
    dup_res = client.post(
        "/api/business-development/organizations",
        json={"name": "St. Jude Health Network", "organization_type": "Hospital"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"]

    # Allowed with allow_duplicate=True
    force_res = client.post(
        "/api/business-development/organizations",
        json={"name": "St. Jude Health Network", "organization_type": "Hospital", "allow_duplicate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert force_res.status_code == 201


def test_4_bd_user_can_view_organization_details(client, db_session):
    """4. Test viewing single organization details."""
    token = get_bd_token(client)
    # Create first
    create_res = client.post(
        "/api/business-development/organizations",
        json={"name": "Regional Medical Clinic", "organization_type": "Clinic", "city": "Bangalore"},
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = create_res.json()["id"]

    res = client.get(
        f"/api/business-development/organizations/{org_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == org_id
    assert data["name"] == "Regional Medical Clinic"


def test_5_bd_user_can_edit_organization(client, db_session):
    """5. Test updating organization profile."""
    token = get_bd_token(client)
    create_res = client.post(
        "/api/business-development/organizations",
        json={"name": "Sunrise Diagnostics", "organization_type": "Diagnostic Center"},
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = create_res.json()["id"]

    update_res = client.put(
        f"/api/business-development/organizations/{org_id}",
        json={"city": "Pune", "priority": "High", "description": "Updated diagnostic laboratory"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["city"] == "Pune"
    assert data["priority"] == "High"
    assert data["description"] == "Updated diagnostic laboratory"


def test_6_bd_user_can_change_status(client, db_session):
    """6. Test changing connection status stage with transition note."""
    token = get_bd_token(client)
    create_res = client.post(
        "/api/business-development/organizations",
        json={"name": "Care Health Clinic", "organization_type": "Clinic", "status": "Potential"},
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = create_res.json()["id"]

    status_res = client.patch(
        f"/api/business-development/organizations/{org_id}/status",
        json={"status": "Interested", "note": "Director confirmed interest after presentation"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status_res.status_code == 200
    data = status_res.json()
    assert data["status"] == "Interested"
    assert "Status changed" in data["notes"]
    assert "Director confirmed interest" in data["notes"]


def test_7_bd_user_can_change_priority(client, db_session):
    """7. Test updating priority."""
    token = get_bd_token(client)
    create_res = client.post(
        "/api/business-development/organizations",
        json={"name": "Apex Hospital", "organization_type": "Hospital", "priority": "Low"},
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = create_res.json()["id"]

    pri_res = client.patch(
        f"/api/business-development/organizations/{org_id}/priority",
        json={"priority": "High"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert pri_res.status_code == 200
    assert pri_res.json()["priority"] == "High"


def test_8_bd_user_can_add_internal_note(client, db_session):
    """8. Test appending an internal BD note."""
    token = get_bd_token(client)
    create_res = client.post(
        "/api/business-development/organizations",
        json={"name": "Metro Health Systems", "organization_type": "Hospital Group"},
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = create_res.json()["id"]

    note_res = client.post(
        f"/api/business-development/organizations/{org_id}/notes",
        json={"note": "Met IT director at Hyderabad tech expo."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert note_res.status_code == 200
    assert "Met IT director" in note_res.json()["notes"]


def test_9_soft_delete_organization(client, db_session):
    """9. Test soft-deleting an organization."""
    token = get_bd_token(client)
    create_res = client.post(
        "/api/business-development/organizations",
        json={"name": "Obsolete Clinic", "organization_type": "Clinic"},
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = create_res.json()["id"]

    del_res = client.delete(
        f"/api/business-development/organizations/{org_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 200

    # Verify not found in active list or get
    get_res = client.get(
        f"/api/business-development/organizations/{org_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 404


def test_10_search_organizations(client, db_session):
    """10. Test search filter by name or location."""
    token = get_bd_token(client)
    client.post(
        "/api/business-development/organizations",
        json={"name": "Kolkata Heart Institute", "organization_type": "Hospital", "city": "Kolkata"},
        headers={"Authorization": f"Bearer {token}"},
    )

    search_res = client.get(
        "/api/business-development/organizations?search=Kolkata",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert search_res.status_code == 200
    data = search_res.json()
    assert any("Kolkata" in item["name"] or item.get("city") == "Kolkata" for item in data["items"])


def test_11_filter_organizations_by_type_status_priority(client, db_session):
    """11. Test structured filtering."""
    token = get_bd_token(client)
    client.post(
        "/api/business-development/organizations",
        json={"name": "Specialized Eye Center", "organization_type": "Clinic", "status": "Discussion", "priority": "High", "city": "Chennai"},
        headers={"Authorization": f"Bearer {token}"},
    )

    filter_res = client.get(
        "/api/business-development/organizations?organization_type=Clinic&status=Discussion&priority=High",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert filter_res.status_code == 200
    data = filter_res.json()
    for item in data["items"]:
        assert item["organization_type"] == "Clinic"
        assert item["status"] == "Discussion"
        assert item["priority"] == "High"


def test_12_unauthenticated_requests_receive_401(client):
    """12. Test unauthenticated access returns 401."""
    res = client.get("/api/business-development/organizations")
    assert res.status_code == 401


def test_13_non_bd_users_receive_403(client):
    """13. Test non-BD authenticated user receives 403 Forbidden."""
    token = get_non_bd_token(client)
    res = client.get(
        "/api/business-development/organizations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_14_nonexistent_organization_returns_404(client):
    """14. Test non-existent ID returns 404."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/organizations/99999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


def test_15_dashboard_metrics_reflect_real_organizations(client, db_session):
    """15. Test dashboard metrics dynamically synchronize with the organizations table."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/dashboard",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["summary"]["organizations"] >= 1
    assert "pipeline" in data
    assert data["pipeline"]["potential"] >= 0
