import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import get_db, Base, engine
from app.models.user import User, UserRole
from app.models.organization import Organization, ConnectionStatus
from app.models.contact import Contact
from app.models.project import Project, ProjectCategory, ProjectStatus
from app.models.campaign import (
    Campaign,
    CampaignStatus,
    CampaignSequenceStep,
    CampaignContact,
    CampaignContactStatus,
    GmailAccount,
)
from app.models.communication import Communication
from app.models.followup import FollowUp
from app.services.campaign.placeholder_engine import PlaceholderEngine
from app.services.campaign.scorer import PersonalizationScorer
from app.services.campaign.compiler import CampaignCompiler
from app.services.campaign_service import CampaignService
from app.services.daily_priorities import compute_daily_priorities


@pytest.fixture
def client(db_session: Session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client: TestClient):
    response = client.post("/auth/login", json={"email": "bd@test.local", "password": "password123"})
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_data(db_session: Session):
    # Universal B2B Organization (FinTech / Enterprise SaaS)
    org = Organization(
        name="Global Cloud Solutions",
        organization_type="Enterprise Technology",
        industry="FinTech & Cloud",
        city="Singapore",
        country="Singapore",
        website="https://globalcloud.com",
        description="Leading enterprise cloud security and fintech infrastructure provider.",
        status=ConnectionStatus.NEW.value,
        priority="High",
    )
    db_session.add(org)
    db_session.flush()

    contact = Contact(
        organization_id=org.id,
        first_name="Marcus",
        last_name="Vance",
        designation="Chief Information Officer",
        email="marcus.vance@globalcloud.com",
        phone="+65 6123 4567",
        is_decision_maker=True,
    )
    db_session.add(contact)

    showcase = db_session.query(Project).filter(Project.slug == "enterprise-security-engine").first()
    if not showcase:
        showcase = Project(
            name="Enterprise Security Engine",
            slug="enterprise-security-engine",
            short_description="Automated cloud security posture and threat detection platform.",
            description="Full enterprise grade cloud security and compliance orchestration platform.",
            category=ProjectCategory.ARTIFICIAL_INTELLIGENCE.value,
            status=ProjectStatus.ACTIVE.value,
            is_featured=True,
        )
        db_session.add(showcase)
    db_session.commit()
    db_session.refresh(org)
    db_session.refresh(contact)
    db_session.refresh(showcase)

    return {"org": org, "contact": contact, "showcase": showcase}


# ── TEST 1: Placeholder Engine & Strict Unresolved Tag Rejection ──

def test_placeholder_engine():
    template = "Hi {{first_name}}, welcome to {{organization_name}} in {{city}}! ELLY project: {{project_name}}."
    values = {
        "first_name": "Marcus",
        "organization_name": "Global Cloud",
        "city": "Singapore",
        "project_name": "Security Engine",
    }
    rendered = PlaceholderEngine.resolve(template, values)
    assert rendered == "Hi Marcus, welcome to Global Cloud in Singapore! ELLY project: Security Engine."
    
    is_valid, unresolved = PlaceholderEngine.validate_no_unresolved(rendered)
    assert is_valid is True
    assert len(unresolved) == 0

    # Unresolved test
    broken_template = "Hi {{first_name}}, let's talk about {{missing_field}}."
    rendered_broken = PlaceholderEngine.resolve(broken_template, values)
    is_valid_broken, unresolved_broken = PlaceholderEngine.validate_no_unresolved(rendered_broken)
    assert is_valid_broken is False
    assert "missing_field" in unresolved_broken


# ── TEST 2: Personalization Scorer ──

def test_personalization_scorer():
    context = {
        "organization_name": "Global Cloud Solutions",
        "first_name": "Marcus",
        "contact_role": "Chief Information Officer",
        "industry": "FinTech",
        "city": "Singapore",
        "project_name": "Security Engine",
    }
    subject = "Strategic Collaboration: Global Cloud Solutions & ELLY"
    body = "Hi Marcus, as Chief Information Officer at Global Cloud Solutions in Singapore, ELLY Security Engine provides accelerated cloud ROI. Would you be open to a 15 minute conversation next Tuesday?"
    
    score = PersonalizationScorer.score(subject, body, context)
    assert score >= 80.0


# ── TEST 3: Campaign Creation, Steps & Contact Enrollment ──

def test_campaign_lifecycle(client: TestClient, auth_headers: dict, sample_data: dict, db_session: Session):
    contact = sample_data["contact"]
    org = sample_data["org"]

    # 1. Create Campaign
    payload = {
        "name": "Q3 Enterprise Tech Campaign",
        "description": "Multi-step outreach to APAC enterprise tech leaders.",
        "target_industry": "FinTech & Cloud",
        "sender_email": "bd_rep@elly.ai",
        "contact_ids": [contact.id],
    }
    resp = client.post("/api/business-development/campaigns", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    campaign_data = resp.json()
    campaign_id = campaign_data["id"]
    assert campaign_data["name"] == "Q3 Enterprise Tech Campaign"
    assert len(campaign_data["sequence_steps"]) == 4  # Default 4-step sequence

    # 2. Get Detail with Contacts
    detail_resp = client.get(f"/api/business-development/campaigns/{campaign_id}", headers=auth_headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert len(detail["campaign_contacts"]) == 1
    assert detail["campaign_contacts"][0]["contact_name"] == "Marcus Vance"
    assert detail["campaign_contacts"][0]["status"] == "Ready_For_Review"

    # 3. Activate and Pause
    start_resp = client.post(f"/api/business-development/campaigns/{campaign_id}/start", headers=auth_headers)
    assert start_resp.status_code == 200
    assert start_resp.json()["status"] == "Active"

    pause_resp = client.post(f"/api/business-development/campaigns/{campaign_id}/pause", headers=auth_headers)
    assert pause_resp.status_code == 200
    assert pause_resp.json()["status"] == "Paused"


# ── TEST 4: Live AI Preview & Personalization Generation ──

def test_campaign_preview_and_ai_compilation(client: TestClient, auth_headers: dict, sample_data: dict, db_session: Session):
    contact = sample_data["contact"]
    user = db_session.query(User).first()

    # Create campaign
    campaign = CampaignService.create_campaign(
        db=db_session,
        user=user,
        data=type("Data", (), {
            "name": "AI Preview Test",
            "description": "Testing AI compilation",
            "sender_email": "bd@elly.ai",
            "gmail_account_id": None,
            "target_industry": "FinTech",
            "sequence_steps": None,
            "contact_ids": [contact.id],
        })()
    )

    prev_resp = client.post(
        f"/api/business-development/campaigns/{campaign.id}/contacts/{contact.id}/preview",
        json={"contact_id": contact.id, "step_number": 1},
        headers=auth_headers,
    )
    assert prev_resp.status_code == 200
    prev = prev_resp.json()
    assert "Marcus" in prev["body_html"]
    assert "Global Cloud Solutions" in prev["body_html"]
    assert prev["is_valid"] is True
    assert prev["personalization_score"] >= 60.0


# ── TEST 5: Send Step Email & Communication Timeline Integration ──

def test_campaign_send_step(client: TestClient, auth_headers: dict, sample_data: dict, db_session: Session):
    contact = sample_data["contact"]
    user = db_session.query(User).first()

    campaign = CampaignService.create_campaign(
        db=db_session,
        user=user,
        data=type("Data", (), {
            "name": "Send Step Test",
            "description": "Testing step execution",
            "sender_email": "bd@elly.ai",
            "gmail_account_id": None,
            "target_industry": "FinTech",
            "sequence_steps": None,
            "contact_ids": [contact.id],
        })()
    )

    send_payload = {
        "subject": "Collaboration with Global Cloud Solutions",
        "body_html": "<p>Hi Marcus, let us collaborate.</p>",
    }
    send_resp = client.post(
        f"/api/business-development/campaigns/{campaign.id}/contacts/{contact.id}/send",
        json=send_payload,
        headers=auth_headers,
    )
    assert send_resp.status_code == 200
    res = send_resp.json()
    assert res["success"] is True
    assert res["next_step_number"] == 2  # Advanced to step 2

    # Verify Communication record was created in timeline
    comm = db_session.query(Communication).filter(
        Communication.contact_id == contact.id,
        Communication.direction == "Outgoing"
    ).first()
    assert comm is not None
    assert "Global Cloud Solutions" in comm.subject


# ── TEST 6: Reply Detection, Sequence Auto-Pause, and Follow-up Creation ──

def test_campaign_reply_detection_and_pause(client: TestClient, auth_headers: dict, sample_data: dict, db_session: Session):
    contact = sample_data["contact"]
    user = db_session.query(User).first()

    campaign = CampaignService.create_campaign(
        db=db_session,
        user=user,
        data=type("Data", (), {
            "name": "Reply Auto-Pause Test",
            "description": "Testing reply pausing",
            "sender_email": "bd@elly.ai",
            "gmail_account_id": None,
            "target_industry": "FinTech",
            "sequence_steps": None,
            "contact_ids": [contact.id],
        })()
    )

    # Simulate incoming prospect reply
    reply_resp = client.post(
        f"/api/business-development/campaigns/simulate-reply?contact_id={contact.id}&campaign_id={campaign.id}&reply_subject=Interested+in+Demo&reply_snippet=Let+us+schedule+a+meeting+next+week",
        headers=auth_headers,
    )
    assert reply_resp.status_code == 200
    reply_data = reply_resp.json()
    assert reply_data["status"] == "Replied"
    assert reply_data["sequence_paused"] is True

    # Verify CampaignContact status in DB
    cc = db_session.query(CampaignContact).filter(
        CampaignContact.campaign_id == campaign.id,
        CampaignContact.contact_id == contact.id
    ).first()
    assert cc.status == CampaignContactStatus.REPLIED.value
    assert cc.next_action_due is None  # Sequence paused

    # Verify Follow-up task was generated
    fu = db_session.query(FollowUp).filter(FollowUp.contact_id == contact.id).first()
    assert fu is not None
    assert "Respond to reply" in fu.title

    # Verify Daily Priorities detects the reply
    priorities = compute_daily_priorities(db_session, user)
    reply_priority_items = [p for p in priorities.all_priority_items if p.category == "campaign_reply"]
    assert len(reply_priority_items) > 0
    assert any("Marcus Vance" in p.title for p in reply_priority_items)


# ── TEST 7: AI Outreach Workspace Generate Draft Endpoint ──

def test_outreach_workspace_ai_draft(client: TestClient, auth_headers: dict, sample_data: dict):
    contact = sample_data["contact"]
    resp = client.post(
        f"/api/business-development/outreach/generate-ai-draft?contact_id={contact.id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "Marcus" in data["body_plain"]
    assert data["personalization_score"] >= 60.0


# ── TEST 8: Gmail Reply Sync Endpoint ──

def test_gmail_reply_sync_endpoint(client: TestClient, auth_headers: dict):
    resp = client.post("/api/gmail/sync-replies", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "synced_active_threads" in data
    assert "replies_detected" in data


# ── TEST 9: Lightweight Open Tracking Pixel Endpoint ──

def test_open_tracking_pixel_endpoint(client: TestClient, db_session: Session, sample_data: dict):
    contact = sample_data["contact"]
    org = sample_data["org"]
    user = db_session.query(User).first()

    campaign = CampaignService.create_campaign(
        db=db_session,
        user=user,
        data=type("Data", (), {
            "name": "Tracking Pixel Test",
            "description": "Testing open tracking",
            "sender_email": "bd@elly.ai",
            "gmail_account_id": None,
            "target_industry": "FinTech",
            "sequence_steps": None,
            "contact_ids": [contact.id],
        })()
    )
    cc = db_session.query(CampaignContact).filter(CampaignContact.campaign_id == campaign.id).first()
    assert cc.open_count == 0
    assert cc.opened_at is None

    # Hit tracking pixel endpoint
    resp = client.get(f"/api/gmail/track/open/{cc.id}")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/gif"

    db_session.refresh(cc)
    assert cc.open_count == 1
    assert cc.opened_at is not None


# ── TEST 10: Campaign to Opportunity Bridge Conversion ──

def test_opportunity_bridge_confirmed_conversion(client: TestClient, auth_headers: dict, db_session: Session, sample_data: dict):
    contact = sample_data["contact"]
    user = db_session.query(User).first()

    campaign = CampaignService.create_campaign(
        db=db_session,
        user=user,
        data=type("Data", (), {
            "name": "Opportunity Bridge Test",
            "description": "Testing opp conversion",
            "sender_email": "bd@elly.ai",
            "gmail_account_id": None,
            "target_industry": "FinTech",
            "sequence_steps": None,
            "contact_ids": [contact.id],
        })()
    )
    cc = db_session.query(CampaignContact).filter(CampaignContact.campaign_id == campaign.id).first()

    # Confirmed 1-click Opportunity creation
    resp = client.post(
        f"/api/business-development/campaigns/contacts/{cc.id}/create-opportunity",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "opportunity_id" in data
    assert "Global Cloud Solutions" in data["opportunity_name"]
    assert data["stage"] == "Responded"


# ── TEST 11: AI Next Best Action Engine ──

def test_next_best_action_engine(client: TestClient, auth_headers: dict):
    resp = client.get(
        "/api/business-development/daily-priorities/next-best-action",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "title" in data
    assert "urgency_score" in data
    assert "recommended_action" in data
    assert "action_url" in data


# ── TEST 12: Commercial ROI Funnel & Conversion Analytics ──

def test_campaign_commercial_roi_funnel_reporting(client: TestClient, auth_headers: dict, db_session: Session, sample_data: dict):
    contact = sample_data["contact"]
    user = db_session.query(User).first()

    campaign = CampaignService.create_campaign(
        db=db_session,
        user=user,
        data=type("Data", (), {
            "name": "ROI Analytics Test",
            "description": "Testing full funnel analytics",
            "sender_email": "bd@elly.ai",
            "gmail_account_id": None,
            "target_industry": "FinTech",
            "sequence_steps": None,
            "contact_ids": [contact.id],
        })()
    )

    resp = client.get(
        f"/api/business-development/campaigns/{campaign.id}/roi",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    roi = resp.json()
    assert roi["campaign_id"] == campaign.id
    assert roi["leads_enrolled"] == 1
    assert "sent_to_open_pct" in roi
    assert "open_to_reply_pct" in roi
    assert "reply_to_meeting_pct" in roi
    assert "overall_lead_to_deal_pct" in roi

