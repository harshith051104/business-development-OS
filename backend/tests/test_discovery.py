import pytest
import io
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


def test_1_bd_user_can_search_organizations(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Hospital", "location": "Hyderabad", "page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) >= 1
    first_item = data["items"][0]
    assert "name" in first_item
    assert "organization_type" in first_item
    assert "source_name" in first_item


def test_2_non_bd_user_receives_403(client: TestClient):
    token = get_non_bd_token(client)
    res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Hospital"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_3_unauthenticated_user_receives_401(client: TestClient):
    res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Hospital"},
    )
    assert res.status_code == 401


def test_4_search_parameters_and_pagination_validation(client: TestClient):
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Care", "page": 1, "page_size": 5},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["page"] == 1
    assert data["page_size"] == 5


def test_5_discovery_details_retrieval(client: TestClient):
    token = get_bd_token(client)
    # Search first
    search_res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Apollo"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert search_res.status_code == 200
    items = search_res.json()["items"]
    assert len(items) >= 1
    item_id = items[0]["id"]

    # Get details
    detail_res = client.get(
        f"/api/business-development/discover/{item_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == item_id


def test_6_saved_discovery_action(client: TestClient):
    token = get_bd_token(client)
    search_res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Manipal"},
        headers={"Authorization": f"Bearer {token}"},
    )
    item_id = search_res.json()["items"][0]["id"]

    save_res = client.post(
        f"/api/business-development/discover/{item_id}/save",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert save_res.status_code == 200
    assert save_res.json()["status"] == "saved"

    # Verify in saved listing
    saved_list = client.get(
        "/api/business-development/discover/saved",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert saved_list.status_code == 200
    assert any(item["id"] == item_id for item in saved_list.json()["items"])


def test_7_skipped_discovery_action(client: TestClient):
    token = get_bd_token(client)
    search_res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Lilavati"},
        headers={"Authorization": f"Bearer {token}"},
    )
    item_id = search_res.json()["items"][0]["id"]

    skip_res = client.post(
        f"/api/business-development/discover/{item_id}/skip",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert skip_res.status_code == 200
    assert skip_res.json()["status"] == "skipped"


def test_8_qualify_discovery(client: TestClient):
    token = get_bd_token(client)
    search_res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Max Healthcare"},
        headers={"Authorization": f"Bearer {token}"},
    )
    item_id = search_res.json()["items"][0]["id"]

    qualify_res = client.post(
        f"/api/business-development/discover/{item_id}/qualify",
        json={"potential_fit": "High", "qualification_reason": "Top tier hospital group with AI roadmap"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert qualify_res.status_code == 200
    assert qualify_res.json()["potential_fit"] == "High"
    assert "AI roadmap" in qualify_res.json()["qualification_reason"]


def test_9_add_discovered_organization_to_pipeline(client: TestClient):
    token = get_bd_token(client)
    search_res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Qure.ai"},
        headers={"Authorization": f"Bearer {token}"},
    )
    item_id = search_res.json()["items"][0]["id"]

    add_res = client.post(
        f"/api/business-development/discover/{item_id}/add",
        json={"priority": "High", "notes": "Discovered via provider search", "allow_duplicate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_res.status_code == 200
    new_org = add_res.json()
    assert new_org["name"] == "Qure.ai Technologies"
    assert new_org["status"] == "Potential"
    assert new_org["priority"] == "High"


def test_10_duplicate_detection_prevents_unintended_duplicate(client: TestClient):
    token = get_bd_token(client)
    search_res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Qure.ai"},
        headers={"Authorization": f"Bearer {token}"},
    )
    item_id = search_res.json()["items"][0]["id"]

    # Attempt adding again without allow_duplicate
    add_dup_res = client.post(
        f"/api/business-development/discover/{item_id}/add",
        json={"allow_duplicate": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_dup_res.status_code == 409
    assert "already exists" in add_dup_res.json()["detail"]


def test_11_discovery_history_recorded(client: TestClient):
    token = get_bd_token(client)
    # Perform a search
    client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Diagnostics", "location": "Mumbai"},
        headers={"Authorization": f"Bearer {token}"},
    )

    hist_res = client.get(
        "/api/business-development/discover/history",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) >= 1
    assert any(h["query_keyword"] == "Diagnostics" for h in history)


def test_12_discovery_stats_endpoint(client: TestClient):
    token = get_bd_token(client)
    stats_res = client.get(
        "/api/business-development/discover/stats",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_discovered" in stats
    assert "total_added" in stats
    assert "total_saved" in stats
    assert stats["total_discovered"] >= 1


def test_13_csv_import_preview_validation(client: TestClient):
    token = get_bd_token(client)
    csv_content = (
        "name,organization_type,city,email\n"
        "City General Hospital,Hospital,Hyderabad,contact@citygen.org\n"
        "Broken Clinic,InvalidType,Delhi,bad-email\n"
        ",Hospital,Mumbai,missing-name@test.org\n"
    )
    file_tuple = ("test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")
    res = client.post(
        "/api/business-development/discover/import/preview",
        files={"file": file_tuple},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 3
    assert data["valid_rows"] == 1
    assert data["invalid_rows"] == 2


def test_14_csv_import_execute(client: TestClient):
    token = get_bd_token(client)
    payload = {
        "rows": [
            {
                "row_number": 1,
                "name": "Starlight Specialty Hospital",
                "organization_type": "Hospital",
                "city": "Bengaluru",
                "email": "info@starlight.health",
                "is_valid": True,
                "is_duplicate": False,
                "errors": [],
            }
        ],
        "skip_duplicates": True,
    }
    res = client.post(
        "/api/business-development/discover/import/execute",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["imported_count"] == 1
    assert len(data["imported_ids"]) == 1
