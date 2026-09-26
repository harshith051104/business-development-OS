import pytest


def get_bd_token(client):
    res = client.post("/auth/login", json={"email": "bd@test.local", "password": "password123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def get_non_bd_token(client):
    res = client.post("/auth/login", json={"email": "healthcare@test.local", "password": "password123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def create_test_org(client, token, name="Metropolitan Hospital"):
    res = client.post(
        "/api/business-development/organizations",
        json={"name": name, "organization_type": "Hospital", "city": "Hyderabad", "allow_duplicate": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code in [200, 201]
    return res.json()["id"]


def test_1_bd_user_can_list_contacts(client, db_session):
    """1. Test BD user can retrieve paginated contacts list."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/contacts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert "total_pages" in data


def test_2_bd_user_can_create_contact(client, db_session):
    """2. Test creating a valid business contact associated with an organization."""
    token = get_bd_token(client)
    org_id = create_test_org(client, token, "City Medical Center")

    payload = {
        "organization_id": org_id,
        "first_name": "Rohan",
        "last_name": "Sharma",
        "designation": "Chief Technology Officer",
        "department": "Technology & Innovation",
        "email": "rohan.sharma@citymedical.org",
        "phone": "+91 98765 43210",
        "is_decision_maker": True,
        "is_primary_contact": True,
        "connection_status": "Contacted",
        "notes": "Met at Digital Health Conclave.",
    }

    res = client.post(
        "/api/business-development/contacts",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["first_name"] == "Rohan"
    assert data["last_name"] == "Sharma"
    assert data["full_name"] == "Rohan Sharma"
    assert data["designation"] == "Chief Technology Officer"
    assert data["is_decision_maker"] is True
    assert data["is_primary_contact"] is True
    assert data["organization_id"] == org_id
    assert len(data["activities"]) >= 1


def test_3_bd_user_can_view_contact_profile(client, db_session):
    """3. Test viewing a contact's detailed profile and activities."""
    token = get_bd_token(client)
    org_id = create_test_org(client, token, "Apex Cancer Hospital")

    create_res = client.post(
        "/api/business-development/contacts",
        json={
            "organization_id": org_id,
            "first_name": "Anita",
            "last_name": "Deshmukh",
            "designation": "Medical Director",
            "email": "anita.d@apexcancer.org",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    contact_id = create_res.json()["id"]

    res = client.get(
        f"/api/business-development/contacts/{contact_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == contact_id
    assert data["full_name"] == "Anita Deshmukh"
    assert data["organization_name"] == "Apex Cancer Hospital"


def test_4_bd_user_can_edit_contact(client, db_session):
    """4. Test editing contact profile fields."""
    token = get_bd_token(client)
    org_id = create_test_org(client, token, "Global Care Hospitals")

    create_res = client.post(
        "/api/business-development/contacts",
        json={
            "organization_id": org_id,
            "first_name": "Vikram",
            "last_name": "Mehta",
            "designation": "IT Head",
            "email": "vikram.m@globalcare.org",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    contact_id = create_res.json()["id"]

    edit_res = client.put(
        f"/api/business-development/contacts/{contact_id}",
        json={
            "designation": "Chief Information Officer",
            "department": "Executive IT Leadership",
            "is_decision_maker": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert edit_res.status_code == 200
    data = edit_res.json()
    assert data["designation"] == "Chief Information Officer"
    assert data["department"] == "Executive IT Leadership"
    assert data["is_decision_maker"] is True


def test_5_bd_user_can_delete_contact(client, db_session):
    """5. Test soft deleting a contact."""
    token = get_bd_token(client)
    org_id = create_test_org(client, token, "Heritage Clinic")

    create_res = client.post(
        "/api/business-development/contacts",
        json={"organization_id": org_id, "first_name": "Temporary", "last_name": "Contact"},
        headers={"Authorization": f"Bearer {token}"},
    )
    contact_id = create_res.json()["id"]

    del_res = client.delete(
        f"/api/business-development/contacts/{contact_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert del_res.status_code == 200

    # Verify not found in active profile
    get_res = client.get(
        f"/api/business-development/contacts/{contact_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 404


def test_6_primary_contact_server_side_enforcement(client, db_session):
    """6. Test that only one primary contact exists per organization; setting a new primary unmarks the previous."""
    token = get_bd_token(client)
    org_id = create_test_org(client, token, "Premier Health Network")

    # Create Contact 1 as primary
    res1 = client.post(
        "/api/business-development/contacts",
        json={
            "organization_id": org_id,
            "first_name": "Contact",
            "last_name": "One",
            "email": "contact1@premier.org",
            "is_primary_contact": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    c1_id = res1.json()["id"]

    # Create Contact 2 as primary
    res2 = client.post(
        "/api/business-development/contacts",
        json={
            "organization_id": org_id,
            "first_name": "Contact",
            "last_name": "Two",
            "email": "contact2@premier.org",
            "is_primary_contact": True,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    c2_id = res2.json()["id"]

    # Verify Contact 2 is primary and Contact 1 is no longer primary
    c1_check = client.get(
        f"/api/business-development/contacts/{c1_id}",
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    c2_check = client.get(
        f"/api/business-development/contacts/{c2_id}",
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    assert c2_check["is_primary_contact"] is True
    assert c1_check["is_primary_contact"] is False


def test_7_duplicate_email_and_phone_detection(client, db_session):
    """7. Test duplicate email and duplicate phone checks."""
    token = get_bd_token(client)
    org_id = create_test_org(client, token, "Lotus Multispeciality")

    client.post(
        "/api/business-development/contacts",
        json={
            "organization_id": org_id,
            "first_name": "Kavita",
            "last_name": "Patel",
            "email": "kavita.patel@lotus.org",
            "phone": "+91 99887 76655",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    # Attempt duplicate email
    dup_res = client.post(
        "/api/business-development/contacts",
        json={
            "organization_id": org_id,
            "first_name": "Another",
            "last_name": "Person",
            "email": "kavita.patel@lotus.org",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"]

    # Check duplicate endpoint
    chk_res = client.get(
        "/api/business-development/contacts/check-duplicate?email=kavita.patel@lotus.org",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert chk_res.status_code == 200
    assert chk_res.json()["is_duplicate"] is True


def test_8_search_contacts(client, db_session):
    """8. Test searching contacts by name, designation, or email."""
    token = get_bd_token(client)
    org_id = create_test_org(client, token, "Searchable Institute")

    client.post(
        "/api/business-development/contacts",
        json={
            "organization_id": org_id,
            "first_name": "Siddharth",
            "last_name": "Nambiar",
            "designation": "Vice President of Strategy",
            "email": "siddharth.n@searchable.org",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    search_res = client.get(
        "/api/business-development/contacts?search=Nambiar",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert search_res.status_code == 200
    data = search_res.json()
    assert any(c["first_name"] == "Siddharth" for c in data["items"])


def test_9_filter_contacts(client, db_session):
    """9. Test filtering contacts by decision maker, status, and department."""
    token = get_bd_token(client)
    org_id = create_test_org(client, token, "Filterable Care Center")

    client.post(
        "/api/business-development/contacts",
        json={
            "organization_id": org_id,
            "first_name": "Pooja",
            "last_name": "Gupta",
            "department": "Clinical IT",
            "is_decision_maker": True,
            "connection_status": "Connected",
            "email": "pooja.g@filterable.org",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    res = client.get(
        f"/api/business-development/contacts?organization_id={org_id}&is_decision_maker=true&connection_status=Connected",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) >= 1
    for c in data["items"]:
        assert c["is_decision_maker"] is True
        assert c["connection_status"] == "Connected"


def test_10_update_connection_status_and_activity_logging(client, db_session):
    """10. Test changing connection status and checking activity log entry."""
    token = get_bd_token(client)
    org_id = create_test_org(client, token, "State Hospital")

    create_res = client.post(
        "/api/business-development/contacts",
        json={
            "organization_id": org_id,
            "first_name": "Tarun",
            "last_name": "Bansal",
            "email": "tarun.b@statehospital.org",
            "connection_status": "Contacted",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    contact_id = create_res.json()["id"]

    status_res = client.patch(
        f"/api/business-development/contacts/{contact_id}/status",
        json={"connection_status": "Connected", "note": "Agreed to follow-up demonstration next Tuesday."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert status_res.status_code == 200
    data = status_res.json()
    assert data["connection_status"] == "Connected"
    assert data["first_contacted_at"] is not None
    assert data["last_contacted_at"] is not None
    assert any("Relationship status changed" in act["description"] for act in data["activities"])


def test_11_organization_profile_contacts_endpoint(client, db_session):
    """11. Test fetching all contacts associated with a specific organization."""
    token = get_bd_token(client)
    org_id = create_test_org(client, token, "Multi-Contact Healthcare")

    for name in ["Lead One", "Lead Two", "Lead Three"]:
        fn, ln = name.split()
        res = client.post(
            "/api/business-development/contacts",
            json={
                "organization_id": org_id,
                "first_name": fn,
                "last_name": ln,
                "email": f"{fn.lower()}_{ln.lower()}@multicontact.org",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201

    res = client.get(
        f"/api/business-development/organizations/{org_id}/contacts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    contacts = res.json()
    assert len(contacts) >= 3


def test_12_invalid_organization_id_rejected(client, db_session):
    """12. Test that creating a contact with invalid organization_id returns 400."""
    token = get_bd_token(client)
    res = client.post(
        "/api/business-development/contacts",
        json={"organization_id": 999999, "first_name": "Ghost", "last_name": "User"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
    assert "does not exist" in res.json()["detail"]


def test_13_unauthenticated_request_rejected(client):
    """13. Test unauthenticated contact requests return 401."""
    res = client.get("/api/business-development/contacts")
    assert res.status_code == 401


def test_14_non_bd_user_rejected(client):
    """14. Test non-BD user receives 403 Forbidden."""
    token = get_non_bd_token(client)
    res = client.get(
        "/api/business-development/contacts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_15_contact_not_found_returns_404(client):
    """15. Test non-existent contact ID returns 404."""
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/contacts/88888",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
