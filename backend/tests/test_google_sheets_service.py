import json
import pytest

from app.services import google_sheets_service as svc


def test_extract_spreadsheet_id_from_full_url():
    url = "https://docs.google.com/spreadsheets/d/1A2B3C4D5E6F7G8H9I0J/edit#gid=0"
    assert svc.extract_spreadsheet_id(url) == "1A2B3C4D5E6F7G8H9I0J"


def test_extract_spreadsheet_id_from_bare_id():
    assert svc.extract_spreadsheet_id("1A2B3C4D5E6F7G8H9I0J_bareID12345") == "1A2B3C4D5E6F7G8H9I0J_bareID12345"


def test_extract_spreadsheet_id_returns_none_for_garbage():
    assert svc.extract_spreadsheet_id("not a url") is None


def test_get_service_account_email_reads_client_email(tmp_path, monkeypatch):
    creds_file = tmp_path / "creds.json"
    creds_file.write_text(json.dumps({"client_email": "bot@project.iam.gserviceaccount.com"}))
    monkeypatch.setattr(svc.settings, "GOOGLE_SHEETS_CREDENTIALS_FILE", str(creds_file))
    assert svc.get_service_account_email() == "bot@project.iam.gserviceaccount.com"


def test_get_service_account_email_returns_none_when_not_configured(monkeypatch):
    monkeypatch.setattr(svc.settings, "GOOGLE_SHEETS_CREDENTIALS_FILE", None)
    assert svc.get_service_account_email() is None


def test_open_by_url_raises_value_error_when_not_configured(monkeypatch):
    monkeypatch.setattr(svc, "_get_client", lambda: None)
    with pytest.raises(ValueError):
        svc.open_by_url("https://docs.google.com/spreadsheets/d/abc123/edit")


def test_open_by_url_raises_value_error_for_bad_url(monkeypatch):
    monkeypatch.setattr(svc, "_get_client", lambda: object())
    with pytest.raises(ValueError):
        svc.open_by_url("not a url")


def test_read_worksheet_rows_parses_header_and_rows():
    class FakeWorksheet:
        def get_all_values(self):
            return [
                ["Company", "Email"],
                ["Acme", "a@acme.test"],
                ["", ""],
            ]

    class FakeSpreadsheet:
        def worksheet(self, name):
            return FakeWorksheet()

    headers, rows = svc.read_worksheet_rows(FakeSpreadsheet(), "Sheet1")
    assert headers == ["Company", "Email"]
    assert rows == [{"Company": "Acme", "Email": "a@acme.test"}]
