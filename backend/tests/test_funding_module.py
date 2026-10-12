"""
Funding / Investor Outreach module — verifies the additive no-approval flow end
to end at the service layer, with no live network/LLM/email calls:
1. find_investor_contacts promotes DiscoveredContact rows into real Contact rows
   (the gap: discover_decision_makers_tool only writes DiscoveredContact; quick_send
   only reads Contact).
2. send_funding_outreach enrolls a contact as APPROVED and sends with no approval
   step, while the existing client-campaign approval gate is untouched.
"""
from unittest.mock import patch

from app.models.discovery import DiscoveredOrganization, DiscoveredContact, DiscoveryStatus
from app.models.organization import Organization, OrganizationType, ConnectionStatus, PriorityLevel
from app.models.contact import Contact
from app.models.campaign import Campaign, CampaignContact, CampaignContactStatus
from app.models.user import User
from app.services.copilot import tools


def _make_discovered_org_with_contact(db, suffix=""):
    org = Organization(
        name=f"Acme Ventures{suffix}",
        organization_type=OrganizationType.OTHER.value,
        country="Unknown",
        status=ConnectionStatus.POTENTIAL.value,
        priority=PriorityLevel.MEDIUM.value,
    )
    db.add(org)
    db.flush()

    disc_org = DiscoveredOrganization(
        name=f"Acme Ventures{suffix}",
        organization_type=OrganizationType.OTHER.value,
        organization_id=org.id,
        status=DiscoveryStatus.ADDED.value,
        source_name="Investor & VC Discovery",
    )
    db.add(disc_org)
    db.flush()

    disc_contact = DiscoveredContact(
        discovered_org_id=disc_org.id,
        full_name="Jane Partner",
        job_title="General Partner",
        email=f"jane{suffix}@acmevc.test",
        fit_level="High",
    )
    db.add(disc_contact)
    db.commit()

    return org, disc_org, disc_contact


def test_find_investor_contacts_promotes_to_real_contact_table(db_session):
    org, disc_org, disc_contact = _make_discovered_org_with_contact(db_session, suffix="1")

    # No real Contact exists yet — this is exactly the gap being fixed.
    assert db_session.query(Contact).filter(Contact.organization_id == org.id).count() == 0

    with patch.object(tools, "discover_decision_makers_tool", return_value=[
        {"name": "Jane Partner", "role": "General Partner", "email": "jane1@acmevc.test"}
    ]):
        result = tools.find_investor_contacts(db_session, discovered_org_id=disc_org.id)

    assert len(result) == 1

    real_contacts = db_session.query(Contact).filter(Contact.organization_id == org.id).all()
    assert len(real_contacts) == 1
    assert real_contacts[0].email == "jane1@acmevc.test"


def test_send_funding_outreach_sends_without_approval_and_client_gate_untouched(db_session):
    # No GmailAccount row exists in the test DB, so GmailService.send_email takes
    # its existing no-credentials path and simulates the send — no real network/
    # email I/O happens here, verified by reading app/services/gmail_service.py.
    user = db_session.query(User).filter(User.email == "bd@test.local").first()
    org, disc_org, disc_contact = _make_discovered_org_with_contact(db_session, suffix="2")

    with patch.object(tools, "discover_decision_makers_tool", return_value=[
        {"name": "Jane Partner", "role": "General Partner", "email": "jane2@acmevc.test"}
    ]):
        tools.find_investor_contacts(db_session, discovered_org_id=disc_org.id)

    result = tools.send_funding_outreach(
        db_session,
        organization_ids=str(org.id),
        template="Hi {{first_name}}, quick intro.",
        user=user,
    )

    campaign = db_session.query(Campaign).filter(Campaign.id == result["campaign_id"]).first()
    assert campaign.category == "funding"

    cc = db_session.query(CampaignContact).filter(CampaignContact.campaign_id == campaign.id).first()
    assert cc is not None
    # Enrolled straight to APPROVED (no human review) and then actually sent.
    assert cc.status == CampaignContactStatus.SENT.value


def test_client_campaign_still_requires_manual_approval(db_session):
    """Regression check: quick_send's pre-APPROVED path must not weaken the
    existing client-campaign gate in CampaignService.send_step_email."""
    from app.services.campaign_service import CampaignService

    org = Organization(
        name="Client Hospital",
        organization_type=OrganizationType.OTHER.value,
        country="Unknown",
        status=ConnectionStatus.POTENTIAL.value,
        priority=PriorityLevel.MEDIUM.value,
    )
    db_session.add(org)
    db_session.flush()

    contact = Contact(organization_id=org.id, first_name="Client", last_name="Contact", email="client@test.local")
    db_session.add(contact)
    db_session.flush()

    campaign = Campaign(name="Client Campaign", category="client", status="Active")
    db_session.add(campaign)
    db_session.flush()

    cc = CampaignContact(
        campaign_id=campaign.id,
        contact_id=contact.id,
        organization_id=org.id,
        current_step_number=1,
        status=CampaignContactStatus.READY_FOR_REVIEW.value,
    )
    db_session.add(cc)
    db_session.commit()

    bd_user = db_session.query(User).filter(User.email == "bd@test.local").first()
    try:
        CampaignService.send_step_email(
            db=db_session,
            campaign_id=campaign.id,
            contact_id=contact.id,
            user=bd_user,
            subject="Test",
            body_html="<p>Test</p>",
        )
        assert False, "expected ValueError: client campaign contact not yet approved"
    except ValueError as e:
        assert "Approved before sending" in str(e)
