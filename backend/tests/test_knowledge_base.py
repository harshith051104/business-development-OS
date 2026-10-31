import io

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.services import kb_service


def get_token(client: TestClient, email: str = "bd@test.local", password: str = "password123") -> str:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


@pytest.fixture(autouse=True)
def no_live_embedding_calls(monkeypatch):
    """KB chunking must not hit the real Gemini embedding endpoint in tests."""
    monkeypatch.setattr(kb_service, "embed_text", lambda text: None)


def test_chunk_text_splits_long_text():
    text = "word " * 1000
    chunks = kb_service.chunk_text(text, chunk_size=800, overlap=100)
    assert len(chunks) > 1
    assert all(c for c in chunks)


def test_chunk_text_empty():
    assert kb_service.chunk_text("") == []
    assert kb_service.chunk_text("   ") == []


def test_upload_list_search_delete_document(client: TestClient):
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    file_content = b"ELLY pricing playbook: enterprise tier starts at $5000 per month."
    res = client.post(
        "/api/business-development/knowledge-base",
        headers=headers,
        data={"title": "Pricing Playbook"},
        files={"file": ("pricing.md", io.BytesIO(file_content), "text/markdown")},
    )
    assert res.status_code == 201, res.text
    doc = res.json()
    assert doc["title"] == "Pricing Playbook"
    assert doc["chunk_count"] >= 1
    doc_id = doc["id"]

    res = client.get("/api/business-development/knowledge-base", headers=headers)
    assert res.status_code == 200
    assert any(d["id"] == doc_id for d in res.json())

    res = client.get(
        "/api/business-development/knowledge-base/search",
        headers=headers,
        params={"q": "pricing enterprise"},
    )
    assert res.status_code == 200
    results = res.json()
    assert any(r["document_id"] == doc_id for r in results)

    res = client.delete(f"/api/business-development/knowledge-base/{doc_id}", headers=headers)
    assert res.status_code == 200

    res = client.get("/api/business-development/knowledge-base", headers=headers)
    assert all(d["id"] != doc_id for d in res.json())


def test_upload_rejects_non_text_file(client: TestClient):
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    binary_content = bytes([0xFF, 0xFE, 0x00, 0x01, 0x80, 0x81]) * 10
    res = client.post(
        "/api/business-development/knowledge-base",
        headers=headers,
        data={"title": "Bad File"},
        files={"file": ("bad.bin", io.BytesIO(binary_content), "application/octet-stream")},
    )
    assert res.status_code == 400


def test_upload_rejects_empty_file(client: TestClient):
    token = get_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/api/business-development/knowledge-base",
        headers=headers,
        data={"title": "Empty"},
        files={"file": ("empty.txt", io.BytesIO(b"   "), "text/plain")},
    )
    assert res.status_code == 400


def test_delete_nonexistent_document(client: TestClient):
    token = get_token(client)
    res = client.delete(
        "/api/business-development/knowledge-base/999999",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404


def test_knowledge_base_requires_bd_or_admin(client: TestClient):
    token = get_token(client, "user@test.local", "password123")
    res = client.get(
        "/api/business-development/knowledge-base",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
