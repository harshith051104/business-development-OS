import pytest


def get_bd_token(client):
    res = client.post("/auth/login", json={"email": "bd@test.local", "password": "password123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def get_non_bd_token(client):
    res = client.post("/auth/login", json={"email": "healthcare@test.local", "password": "password123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_1_authorized_bd_user_can_list_projects(client, db_session):
    """1. Test that an authorized BD user can list showcase projects."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/showcase",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) >= 1


def test_2_authorized_bd_user_can_view_project_details(client, db_session):
    """2. Test retrieving detailed project specification and presentation items."""
    token = get_bd_token(client)
    list_res = client.get(
        "/api/business-development/showcase",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert list_res.status_code == 200
    project_id = list_res.json()["items"][0]["id"]

    res = client.get(
        f"/api/business-development/showcase/{project_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == project_id
    assert "description" in data
    assert "key_features" in data
    assert "business_value" in data
    assert "business_use_cases" in data


def test_3_unauthorized_user_receives_401(client):
    """3. Test unauthenticated request is rejected with 401."""
    res = client.get("/api/business-development/showcase")
    assert res.status_code == 401


def test_4_non_bd_user_receives_403(client):
    """4. Test non-BD user is rejected with 403 Forbidden."""
    token = get_non_bd_token(client)
    res = client.get(
        "/api/business-development/showcase",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_5_project_not_found_returns_404(client):
    """5. Test non-existent project returns 404."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/showcase/999999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


def test_6_search_projects(client, db_session):
    """6. Test searching projects by name or keyword."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/showcase?search=Hospital",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert any("ELLY Hospital Intelligence Platform" in p["name"] for p in data["items"])


def test_7_filter_projects_by_category(client, db_session):
    """7. Test filtering projects by category."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/showcase?category=Healthcare",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) >= 1
    for p in data["items"]:
        assert p["category"].lower() == "healthcare"


def test_8_filter_projects_by_status(client, db_session):
    """8. Test filtering projects by status."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/showcase?status=Active",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) >= 1
    for p in data["items"]:
        assert p["status"] == "Active"


def test_9_filter_projects_by_tag(client, db_session):
    """9. Test filtering projects by tag."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/showcase?tag=Communication",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert any(p["name"] == "OmniConnect Health Communication Suite" for p in data["items"])


def test_10_project_links_and_categories_endpoint(client, db_session):
    """10. Test project links and category metadata endpoint."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/showcase/categories",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "categories" in data
    assert "active_categories" in data
    assert "tags" in data
    assert "Healthcare" in data["categories"]


def test_11_create_and_update_project(client, db_session):
    """11. Test creating and updating a showcase project."""
    token = get_bd_token(client)
    payload = {
        "name": "Custom Test Platform",
        "short_description": "A test platform description for verification.",
        "description": "Comprehensive business description for automated testing.",
        "category": "Automation",
        "status": "Active",
        "demo_url": "https://demo.test.local",
        "website_url": "https://www.test.local",
        "key_features": ["Feature A", "Feature B"],
        "tags": ["Automation", "Testing"],
    }
    create_res = client.post(
        "/api/business-development/showcase",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["name"] == "Custom Test Platform"
    assert created["slug"] == "custom-test-platform"

    # Update
    update_res = client.put(
        f"/api/business-development/showcase/{created['id']}",
        json={"short_description": "Updated elevator pitch."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["short_description"] == "Updated elevator pitch."
