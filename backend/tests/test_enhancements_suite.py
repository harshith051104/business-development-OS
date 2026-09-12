import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.models.contact import Contact
from app.models.opportunity import Opportunity, OpportunityStage
from app.models.meeting import Meeting, MeetingStatus
from app.models.discovery import DiscoveredOrganization, DiscoverySearchHistory
from app.services.meeting_scheduler import detect_and_schedule_meeting_from_reply, is_meeting_intent_present, extract_platform_and_link, extract_proposed_datetime
from app.services.discovery.prompt_parser import parse_discovery_prompt
from app.core.security import create_access_token


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def auth_headers(db):
    user = db.query(User).filter(User.role == UserRole.ADMIN.value).first()
    if not user:
        user = db.query(User).first()
    token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"Authorization": f"Bearer {token}"}


def test_meeting_scheduler_nlp_extraction(db):
    text = "Hi Harshith, thanks for reaching out. Can we connect through meet tomorrow at 3pm to discuss?"
    assert is_meeting_intent_present(text) is True

    platform, link = extract_platform_and_link(text)
    assert platform == "Google Meet"

    dt = extract_proposed_datetime(text)
    assert dt is not None
    assert dt.hour == 15

    # Teams text test
    teams_text = "Let's catch up over Microsoft Teams on Friday 10:30am."
    assert is_meeting_intent_present(teams_text) is True
    plat2, _ = extract_platform_and_link(teams_text)
    assert plat2 == "Microsoft Teams"


def test_meeting_scheduler_auto_provision(db):
    org = db.query(Organization).first()
    if not org:
        org = Organization(name="Test Org For Meeting", priority="High", status="Potential")
        db.add(org)
        db.commit()

    contact = db.query(Contact).filter(Contact.organization_id == org.id).first()
    if not contact:
        contact = Contact(organization_id=org.id, first_name="Rohan", last_name="Sharma", email="rohan@example.com")
        db.add(contact)
        db.commit()

    meeting = detect_and_schedule_meeting_from_reply(
        db=db,
        contact_id=contact.id,
        organization_id=org.id,
        reply_subject="Re: Partnership discussion",
        reply_body="Sounds promising! Can we connect through meet tomorrow at 3pm to review the deck?",
    )
    assert meeting is not None
    assert meeting.organization_id == org.id
    assert meeting.primary_contact_id == contact.id
    assert "Google Meet" in (meeting.location or "") or "meet" in (meeting.location or "").lower()
    assert meeting.status == MeetingStatus.SCHEDULED.value


def test_discovery_prompt_parser():
    prompt = "Find diagnostic chains and hospitals in Hyderabad for AI partnership"
    result = parse_discovery_prompt(prompt)
    assert result is not None
    assert "hyderabad" in (result.get("location") or "").lower()


def test_connections_auto_sync_endpoint(auth_headers):
    client = TestClient(app)
    response = client.post("/api/business-development/connections/auto-sync", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "updated_count" in data


def test_active_upcoming_meetings_endpoint(auth_headers):
    client = TestClient(app)
    response = client.get("/api/business-development/meetings/active-upcoming", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "meetings" in data
    assert "server_time" in data


def test_showcase_deck_upload(auth_headers):
    client = TestClient(app)
    fake_pdf = b"%PDF-1.4 Mock PDF presentation content for testing"
    files = {"file": ("pitch_deck.pdf", fake_pdf, "application/pdf")}
    response = client.post(
        "/api/business-development/showcase/upload-presentation-file",
        headers=auth_headers,
        files=files,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "presentation_url" in data
    assert data["file_type"].lower() == "pdf"
