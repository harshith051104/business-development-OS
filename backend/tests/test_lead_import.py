import io
from datetime import datetime, timezone

from app.models.campaign import Campaign, CampaignContact, CampaignContactStatus, CampaignStatus
from app.models.organization import Organization
from app.models.contact import Contact


def get_bd_token(client):
    res = client.post("/auth/login", json={"email": "bd@test.local", "password": "password123"})
    assert res.status_code == 200
    return res.json()["access_token"]


def _upload_and_map(client, token, csv_bytes: bytes, filename="leads.csv"):
    res = client.post(
        "/api/business-development/leads/upload",
        files={"file": (filename, io.BytesIO(csv_bytes), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    return res.json()


SAMPLE_CSV = (
    b"Company,Website,City,Contact Name,Email,Location\n"
    b"Acme Health,https://acme.test,Hyderabad,Jane Doe,jane@acme.test,Banjara Hills\n"
)


def _default_mapping():
    return {
        "org_name": "Company",
        "org_website": "Website",
        "org_city": "City",
        "contact_full_name": "Contact Name",
        "contact_email": "Email",
        "contact_location": "Location",
    }


def test_import_tags_created_rows_with_batch_id_and_sets_contact_location(client, db_session):
    token = get_bd_token(client)
    preview = _upload_and_map(client, token, SAMPLE_CSV, "batch_tag.csv")

    res = client.post(
        "/api/business-development/leads/import",
        json={"upload_id": preview["upload_id"], "column_mapping": _default_mapping()},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    result = res.json()
    batch_id = result["batch_id"]
    assert result["organizations_created"] == 1
    assert result["contacts_created"] == 1

    org = db_session.query(Organization).filter(Organization.name == "Acme Health").first()
    assert org is not None
    assert org.import_batch_id == batch_id

    contact = db_session.query(Contact).filter(Contact.email == "jane@acme.test").first()
    assert contact is not None
    assert contact.import_batch_id == batch_id
    assert contact.location == "Banjara Hills"


def test_batch_records_endpoint_returns_created_rows(client, db_session):
    token = get_bd_token(client)
    # Unique company/email so this row is freshly created (not matched to a row from
    # another test sharing the same session-scoped test DB).
    csv_bytes = (
        b"Company,Website,City,Contact Name,Email,Location\n"
        b"Records Endpoint Health,https://recendpoint.test,Hyderabad,Jane RecEndpoint,"
        b"jane.recendpoint@acme.test,Banjara Hills\n"
    )
    preview = _upload_and_map(client, token, csv_bytes, "batch_records.csv")

    import_res = client.post(
        "/api/business-development/leads/import",
        json={"upload_id": preview["upload_id"], "column_mapping": _default_mapping()},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert import_res.status_code == 200, import_res.text
    batch_id = import_res.json()["batch_id"]

    res = client.get(
        f"/api/business-development/leads/imports/{batch_id}/records",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["batch_id"] == batch_id
    assert len(data["organizations"]) == 1
    assert data["organizations"][0]["name"] == "Records Endpoint Health"
    assert len(data["contacts"]) == 1
    assert data["contacts"][0]["email"] == "jane.recendpoint@acme.test"


def test_batch_records_endpoint_404_for_unknown_batch(client, db_session):
    token = get_bd_token(client)
    res = client.get(
        "/api/business-development/leads/imports/999999/records",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


def test_import_with_campaign_id_enrolls_contact(client, db_session):
    token = get_bd_token(client)

    campaign = Campaign(
        name="Test Enrollment Campaign",
        status=CampaignStatus.ACTIVE.value,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(campaign)
    db_session.commit()
    campaign_id = campaign.id

    preview = _upload_and_map(client, token, SAMPLE_CSV, "with_campaign.csv")
    res = client.post(
        "/api/business-development/leads/import",
        json={
            "upload_id": preview["upload_id"],
            "column_mapping": _default_mapping(),
            "campaign_id": campaign_id,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    result = res.json()
    assert result["campaign_id"] == campaign_id
    assert result.get("contacts_enrolled", 0) == 1

    contact = db_session.query(Contact).filter(Contact.email == "jane@acme.test").first()
    cc = (
        db_session.query(CampaignContact)
        .filter(CampaignContact.campaign_id == campaign_id, CampaignContact.contact_id == contact.id)
        .first()
    )
    assert cc is not None
    assert cc.current_step_number == 1
    assert cc.status == CampaignContactStatus.PENDING.value


def test_reimporting_same_contact_into_same_campaign_does_not_duplicate(client, db_session):
    token = get_bd_token(client)

    campaign = Campaign(
        name="Dedupe Campaign",
        status=CampaignStatus.ACTIVE.value,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db_session.add(campaign)
    db_session.commit()
    campaign_id = campaign.id

    csv_bytes = (
        b"Company,Website,City,Contact Name,Email,Location\n"
        b"Repeat Health,https://repeat.test,Pune,John Repeat,john@repeat.test,Koregaon Park\n"
    )

    # First import: creates org/contact + enrolls.
    preview1 = _upload_and_map(client, token, csv_bytes, "repeat1.csv")
    res1 = client.post(
        "/api/business-development/leads/import",
        json={
            "upload_id": preview1["upload_id"],
            "column_mapping": _default_mapping(),
            "campaign_id": campaign_id,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res1.status_code == 200, res1.text
    assert res1.json()["contacts_enrolled"] == 1

    # Second import of the same row: contact/org should be matched (not re-created),
    # and enrollment should be skipped (deduped) rather than creating a 2nd CampaignContact.
    preview2 = _upload_and_map(client, token, csv_bytes, "repeat2.csv")
    res2 = client.post(
        "/api/business-development/leads/import",
        json={
            "upload_id": preview2["upload_id"],
            "column_mapping": _default_mapping(),
            "campaign_id": campaign_id,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res2.status_code == 200, res2.text
    result2 = res2.json()
    assert result2["contacts_matched"] == 1
    assert result2["contacts_enrolled"] == 0

    contact = db_session.query(Contact).filter(Contact.email == "john@repeat.test").first()
    ccs = (
        db_session.query(CampaignContact)
        .filter(CampaignContact.campaign_id == campaign_id, CampaignContact.contact_id == contact.id)
        .all()
    )
    assert len(ccs) == 1


def test_import_with_invalid_campaign_id_rejected(client, db_session):
    token = get_bd_token(client)
    preview = _upload_and_map(client, token, SAMPLE_CSV, "bad_campaign.csv")
    res = client.post(
        "/api/business-development/leads/import",
        json={
            "upload_id": preview["upload_id"],
            "column_mapping": _default_mapping(),
            "campaign_id": 999999,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400


class FakeSpreadsheet:
    def __init__(self, title):
        self.title = title


def test_sheet_tabs_endpoint_returns_tab_list(client, monkeypatch):
    from app.services import google_sheets_service

    token = get_bd_token(client)
    monkeypatch.setattr(google_sheets_service, "open_by_url", lambda url: FakeSpreadsheet("My Leads"))
    monkeypatch.setattr(
        google_sheets_service,
        "list_worksheet_titles",
        lambda spreadsheet: [{"title": "Sheet1", "row_count": 10, "col_count": 5}],
    )

    res = client.post(
        "/api/business-development/leads/sheets/tabs",
        json={"sheet_url": "https://docs.google.com/spreadsheets/d/abc123/edit"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["spreadsheet_title"] == "My Leads"
    assert data["tabs"] == [{"title": "Sheet1", "row_count": 10, "col_count": 5}]


def test_sheet_tabs_endpoint_400_on_bad_url(client, monkeypatch):
    from app.services import google_sheets_service

    token = get_bd_token(client)

    def raise_bad_url(url):
        raise ValueError("That doesn't look like a Google Sheets URL.")

    monkeypatch.setattr(google_sheets_service, "open_by_url", raise_bad_url)

    res = client.post(
        "/api/business-development/leads/sheets/tabs",
        json={"sheet_url": "not-a-url"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400


def test_sheet_preview_endpoint_stages_rows_for_import(client, db_session, monkeypatch):
    from app.services import google_sheets_service

    token = get_bd_token(client)
    monkeypatch.setattr(
        google_sheets_service, "open_by_url", lambda url: FakeSpreadsheet("Sheet Import Health")
    )
    headers = ["Company", "Website", "City", "Contact Name", "Email", "Location"]
    rows = [
        {
            "Company": "Sheet Import Health",
            "Website": "https://sheetimport.test",
            "City": "Hyderabad",
            "Contact Name": "Sam SheetImport",
            "Email": "sam.sheetimport@acme.test",
            "Location": "Gachibowli",
        }
    ]
    monkeypatch.setattr(
        google_sheets_service, "read_worksheet_rows", lambda spreadsheet, tab_name: (headers, rows)
    )

    res = client.post(
        "/api/business-development/leads/sheets/preview",
        json={"sheet_url": "https://docs.google.com/spreadsheets/d/abc123/edit", "tab_name": "Sheet1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    preview = res.json()
    assert preview["total_rows"] == 1
    assert preview["headers"] == headers
    assert preview["suggested_mapping"]["org_name"] == "Company"

    import_res = client.post(
        "/api/business-development/leads/import",
        json={"upload_id": preview["upload_id"], "column_mapping": _default_mapping()},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert import_res.status_code == 200, import_res.text
    result = import_res.json()
    assert result["organizations_created"] == 1

    org = db_session.query(Organization).filter(Organization.name == "Sheet Import Health").first()
    assert org is not None


def test_sheet_service_account_email_endpoint(client, monkeypatch):
    from app.services import google_sheets_service

    token = get_bd_token(client)
    monkeypatch.setattr(
        google_sheets_service, "get_service_account_email", lambda: "bot@project.iam.gserviceaccount.com"
    )

    res = client.get(
        "/api/business-development/leads/sheets/service-account-email",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["email"] == "bot@project.iam.gserviceaccount.com"
