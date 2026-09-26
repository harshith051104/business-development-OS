import pytest
from fastapi.testclient import TestClient


def get_bd_token(client: TestClient) -> str:
    res = client.post(
        "/auth/login",
        json={"email": "bd@test.local", "password": "password123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def get_admin_token(client: TestClient) -> str:
    res = client.post(
        "/auth/login",
        json={"email": "admin@test.local", "password": "password123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def test_1_provider_registry_endpoint(client: TestClient):
    """Verify available discovery, contact, and enrichment providers are listed."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/discover/providers",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "organization_providers" in data
    assert "contact_providers" in data
    assert "enrichment_providers" in data
    assert any(p["name"] == "Curated Directory" for p in data["organization_providers"])
    assert any(p["name"] == "Executive Decision-Maker Discovery Provider" for p in data["contact_providers"])
    assert any(p["name"] == "Standard Enterprise Email Enrichment" for p in data["enrichment_providers"])


def test_2_openoutreach_style_b2b_discovery_search(client: TestClient):
    """
    Search with Product Offering Context, Target ICP, and Discovery Objective.
    Verifies that AI qualification returns fit level, score, and explainable reason.
    """
    token = get_bd_token(client)
    payload = {
        "product_description": "Our company has built an AI-powered healthcare platform that helps healthcare organizations improve digital workflows and intelligence.",
        "target_icp": "Large hospitals and healthcare groups in India that are interested in healthcare technology, digital transformation and AI.",
        "discovery_objective": "Find hospitals in Hyderabad and Bengaluru that could be potential technology and platform partners.",
        "location": "Hyderabad",
        "organization_type": "Hospital Group",
        "page": 1,
        "page_size": 10,
    }
    res = client.post(
        "/api/business-development/discover/search",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    items = data["items"]
    assert len(items) >= 1

    first_lead = items[0]
    assert first_lead["potential_fit"] in ["High", "Medium", "Low"]
    assert first_lead["potential_fit_score"] >= 60
    assert first_lead["qualification_reason"] is not None
    assert len(first_lead["qualification_reason"]) > 10
    assert first_lead["product_description"] == payload["product_description"]
    assert first_lead["target_icp"] == payload["target_icp"]
    assert first_lead["discovery_objective"] == payload["discovery_objective"]


def test_3_decision_maker_contact_discovery_and_qualification(client: TestClient):
    """
    Discover executive decision-makers for a target organization.
    Verifies role filtering and AI qualification reasoning.
    """
    token = get_bd_token(client)
    # 1. Search organization
    search_res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Apollo", "product_description": "AI healthcare platform"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert search_res.status_code == 200
    org_id = search_res.json()["items"][0]["id"]

    # 2. Discover Contacts for target roles
    contacts_res = client.post(
        f"/api/business-development/discover/{org_id}/contacts/search",
        json={
            "target_roles": ["CEO", "CTO", "CDO", "CIO", "Business Development", "Innovation"],
            "limit": 10,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert contacts_res.status_code == 200
    contacts = contacts_res.json()
    assert len(contacts) >= 1

    first_contact = contacts[0]
    assert first_contact["full_name"] is not None
    assert first_contact["job_title"] is not None
    assert first_contact["fit_level"] in ["High", "Medium", "Low"]
    assert first_contact["fit_reason"] is not None


def test_4_optional_email_enrichment(client: TestClient):
    """Verify optional email enrichment format and safe lookup."""
    token = get_bd_token(client)
    search_res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Manipal"},
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = search_res.json()["items"][0]["id"]

    # Discover contacts
    contacts_res = client.post(
        f"/api/business-development/discover/{org_id}/contacts/search",
        json={"target_roles": ["CEO", "CDO"]},
        headers={"Authorization": f"Bearer {token}"},
    )
    contact_id = contacts_res.json()[0]["id"]

    # Enrich email
    enrich_res = client.post(
        f"/api/business-development/discover/{org_id}/contacts/{contact_id}/enrich",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert enrich_res.status_code == 200
    enriched = enrich_res.json()
    assert enriched["email"] is not None
    assert "@" in enriched["email"]
    assert enriched["email_status"] == "enriched"


def test_5_full_conversion_to_crm_with_contacts_and_deduplication(client: TestClient):
    """
    End-to-end: Discovered Organization + Contacts -> ELLY CRM Organization + Contacts
    with duplicate detection on subsequent import.
    """
    token = get_bd_token(client)
    # 1. Search
    search_res = client.post(
        "/api/business-development/discover/search",
        json={"keyword": "Max Healthcare"},
        headers={"Authorization": f"Bearer {token}"},
    )
    org_id = search_res.json()["items"][0]["id"]

    # 2. Find contacts
    contacts_res = client.post(
        f"/api/business-development/discover/{org_id}/contacts/search",
        headers={"Authorization": f"Bearer {token}"},
    )
    contact_ids = [c["id"] for c in contacts_res.json()]

    # 3. Add to ELLY CRM
    add_res = client.post(
        f"/api/business-development/discover/{org_id}/add",
        json={
            "priority": "High",
            "notes": "Added after executive leadership discovery",
            "selected_contact_ids": contact_ids,
            "allow_duplicate": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_res.status_code == 200
    crm_org = add_res.json()
    assert crm_org["name"] == "Max Healthcare Institute"
    assert crm_org["status"] == "Potential"
    assert crm_org["priority"] == "High"

    # Verify contacts created in CRM
    contacts_list = client.get(
        f"/api/business-development/contacts?organization_id={crm_org['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert contacts_list.status_code == 200
    assert len(contacts_list.json()["items"]) >= 1

    # 4. Duplicate Detection Guard
    dup_res = client.post(
        f"/api/business-development/discover/{org_id}/add",
        json={"allow_duplicate": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"]


def test_6_csv_export_with_qualification_reasoning(client: TestClient):
    """Export discovered leads to CSV and verify qualification and fit fields."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/discover/export",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    csv_text = res.text
    assert "Organization Name" in csv_text
    assert "Fit Level" in csv_text
    assert "Fit Reason" in csv_text
    assert "Source Name" in csv_text


def test_7_rbac_security_unauthenticated_blocked(client: TestClient):
    """Unauthenticated requests to discovery endpoints must return 401."""
    res = client.post("/api/business-development/discover/search", json={"keyword": "Apollo"})
    assert res.status_code == 401

    res = client.get("/api/business-development/discover/providers")
    assert res.status_code == 401
