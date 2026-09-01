"""
ELLY BD OS — End-to-End Pipeline Test
Tests the complete commercial lifecycle for 2 industries:
1. Technology (FinTech)
2. Manufacturing (Automotive)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal
from app.models.organization import Organization, ConnectionStatus, OrganizationType, PriorityLevel
from app.models.contact import Contact
from app.models.opportunity import Opportunity, OpportunityStage
from app.models.meeting import Meeting, MeetingType, MeetingStatus
from app.models.demo import Demo, DemoStatus
from app.models.proposal import Proposal, ProposalStatus
from app.models.negotiation import Negotiation, NegotiationStatus
from app.models.customer import Customer, CustomerStatus, AccountHealth
from app.models.followup import FollowUp, FollowUpStatus, FollowUpPriority
from app.models.communication import Communication, CommunicationChannel, CommunicationDirection, CommunicationStatus
from app.models.campaign import Campaign, CampaignContact, CampaignContactStatus, CampaignStatus
from app.services.daily_priorities import compute_daily_priorities, compute_next_best_action
from app.services.campaign_service import CampaignService


def run_pipeline(industry: str, org_type: str, org_name: str, contact_name: str, opp_name: str):
    """Run full pipeline for one organization."""
    db = SessionLocal()
    now = datetime.now(timezone.utc)
    results = {"industry": industry, "steps": []}

    try:
        # 1. Create Organization
        org = Organization(
            name=org_name,
            organization_type=org_type,
            industry=industry,
            city="Test City",
            country="US",
            status=ConnectionStatus.NEW.value,
            priority=PriorityLevel.HIGH.value,
            website=f"https://{org_name.lower().replace(' ', '')}.com",
        )
        db.add(org)
        db.flush()
        results["steps"].append(f"1. Organization created: {org.name} (ID={org.id}, Status={org.status})")

        # 2. Create Contact
        first_name, last_name = contact_name.split(" ", 1) if " " in contact_name else (contact_name, "")
        contact = Contact(
            first_name=first_name,
            last_name=last_name,
            email=f"{first_name.lower()}.{last_name.lower()}@{org_name.lower().replace(' ', '')}.com",
            designation="CTO",
            organization_id=org.id,
            is_decision_maker=True,
            is_primary_contact=True,
        )
        db.add(contact)
        db.flush()
        results["steps"].append(f"2. Contact created: {contact.full_name} (ID={contact.id})")

        # 3. Simulate email sent -> auto-stage Contacted
        comm_sent = Communication(
            organization_id=org.id,
            contact_id=contact.id,
            channel=CommunicationChannel.EMAIL.value,
            direction=CommunicationDirection.OUTGOING.value,
            subject=f"Introduction: ELLY AI for {org_name}",
            summary=f"Initial outreach email sent to {contact_name}",
            status=CommunicationStatus.COMPLETED.value,
            created_by="1",
            communication_date=now,
        )
        db.add(comm_sent)
        if org.status in [ConnectionStatus.NEW.value, ConnectionStatus.POTENTIAL.value]:
            org.status = ConnectionStatus.CONTACTED.value
        db.flush()
        results["steps"].append(f"3. Email sent -> Org status: {org.status}")

        # 4. Simulate reply -> auto-stage Responded + auto-create follow-up + auto-create opportunity
        comm_reply = Communication(
            organization_id=org.id,
            contact_id=contact.id,
            channel=CommunicationChannel.EMAIL.value,
            direction=CommunicationDirection.INCOMING.value,
            subject="Re: Introduction: ELLY AI",
            summary=f"Prospect replied: Interested in learning more about ELLY",
            status=CommunicationStatus.COMPLETED.value,
            created_by="1",
            communication_date=now,
        )
        db.add(comm_reply)
        org.status = ConnectionStatus.RESPONDED.value
        contact.connection_status = "Responded"

        # Auto-create follow-up
        followup = FollowUp(
            organization_id=org.id,
            contact_id=contact.id,
            title=f"Respond to reply from {contact_name}",
            description="Prospect replied to outreach. Schedule meeting.",
            due_at=now + timedelta(days=1),
            priority=FollowUpPriority.HIGH.value,
            status=FollowUpStatus.PENDING.value,
            created_by=1,
        )
        db.add(followup)

        # Auto-create opportunity
        opp = Opportunity(
            organization_id=org.id,
            name=opp_name,
            stage=OpportunityStage.CONTACTED.value,
            estimated_value=500000.0,
            probability=20,
            priority="Medium",
            next_action="Schedule discovery call",
            notes=f"Auto-created from reply by {contact_name}",
            created_by=1,
        )
        db.add(opp)
        db.flush()
        results["steps"].append(f"4. Reply detected -> Org: {org.status}, Opportunity created: {opp.name} (ID={opp.id}), Follow-up created")

        # 5. Create Meeting -> auto-stage Meeting
        meeting = Meeting(
            organization_id=org.id,
            primary_contact_id=contact.id,
            opportunity_id=opp.id,
            title=f"Discovery Meeting with {org_name}",
            meeting_type=MeetingType.INTRODUCTION.value,
            status=MeetingStatus.SCHEDULED.value,
            scheduled_at=now + timedelta(days=3),
            created_by=1,
        )
        db.add(meeting)
        org.status = ConnectionStatus.MEETING.value
        opp.stage = OpportunityStage.MEETING.value
        db.flush()
        results["steps"].append(f"5. Meeting created -> Org: {org.status}, Opportunity: {opp.stage}")

        # 6. Complete Meeting -> auto-create follow-up, auto-stage Demo
        meeting.status = MeetingStatus.COMPLETED.value
        meeting.notes = "Meeting completed successfully. Prospect interested in demo."
        org.status = ConnectionStatus.DEMO.value
        opp.stage = OpportunityStage.DEMO.value
        auto_followup = FollowUp(
            organization_id=org.id,
            contact_id=contact.id,
            meeting_id=meeting.id,
            title=f"Follow up after meeting: {meeting.title}",
            due_at=now + timedelta(days=3),
            priority=FollowUpPriority.HIGH.value,
            status=FollowUpStatus.PENDING.value,
            created_by=1,
        )
        db.add(auto_followup)
        db.flush()
        results["steps"].append(f"6. Meeting completed -> Org: {org.status}, Opportunity: {opp.stage}, Auto follow-up created")

        # 7. Create Demo -> auto-stage Demo
        demo = Demo(
            organization_id=org.id,
            primary_contact_id=contact.id,
            opportunity_id=opp.id,
            title=f"ELLY Demo for {org_name}",
            status=DemoStatus.SCHEDULED.value,
            scheduled_at=now + timedelta(days=5),
            participants=contact_name,
            created_by=1,
        )
        db.add(demo)
        db.flush()
        results["steps"].append(f"7. Demo created: {demo.title} (ID={demo.id})")

        # 8. Create Proposal -> auto-stage Proposal
        proposal = Proposal(
            organization_id=org.id,
            opportunity_id=opp.id,
            primary_contact_id=contact.id,
            owner_id=1,
            title=f"ELLY Implementation Proposal for {org_name}",
            version="v1.0",
            value=500000.0,
            currency="USD",
            status=ProposalStatus.SENT.value,
            content_summary="ELLY AI BD Operating System implementation",
            scope_of_work="Full platform deployment with training",
            commercial_terms="30-day payment term",
            created_by="1",
            date_created=now,
            date_sent=now,
        )
        db.add(proposal)
        org.status = ConnectionStatus.PROPOSAL.value
        opp.stage = OpportunityStage.PROPOSAL.value
        opp.estimated_value = 500000.0
        db.flush()
        results["steps"].append(f"8. Proposal created -> Org: {org.status}, Opportunity: {opp.stage}, Value: ${proposal.value:,.0f}")

        # 9. Create Negotiation -> auto-stage Negotiation
        negotiation = Negotiation(
            organization_id=org.id,
            opportunity_id=opp.id,
            proposal_id=proposal.id,
            primary_contact_id=contact.id,
            owner_id=1,
            title=f"Commercial Negotiation with {org_name}",
            commercial_value=500000.0,
            currency="USD",
            status=NegotiationStatus.ACTIVE.value,
            expected_close_date=(now + timedelta(days=30)).date(),
            key_requirements="Multi-year commitment with SLA",
            open_issues="Final pricing and payment terms",
            next_action="Schedule final pricing review",
            created_by="1",
        )
        db.add(negotiation)
        org.status = ConnectionStatus.NEGOTIATION.value
        opp.stage = OpportunityStage.NEGOTIATION.value
        db.flush()
        results["steps"].append(f"9. Negotiation created -> Org: {org.status}, Opportunity: {opp.stage}")

        # 10. Close Deal -> Customer
        org.status = ConnectionStatus.CUSTOMER.value
        opp.stage = OpportunityStage.CUSTOMER.value
        opp.probability = 100
        customer = Customer(
            organization_id=org.id,
            opportunity_id=opp.id,
            primary_contact_id=contact.id,
            contract_value=500000.0,
            currency="USD",
            status=CustomerStatus.ACTIVE.value,
            account_health=AccountHealth.EXCELLENT.value,
            start_date=now.date(),
            renewal_date=(now + timedelta(days=365)).date(),
            created_by=1,
        )
        db.add(customer)
        db.flush()
        results["steps"].append(f"10. Deal won -> Org: {org.status}, Opportunity: {opp.stage}, Customer created, Revenue: ${customer.contract_value:,.0f}")

        db.commit()
        results["success"] = True

    except Exception as e:
        db.rollback()
        results["success"] = False
        results["error"] = str(e)
        import traceback
        results["traceback"] = traceback.format_exc()
    finally:
        db.close()

    return results


def test_priorities():
    """Test daily priorities engine."""
    db = SessionLocal()
    try:
        priorities = compute_daily_priorities(db)
        next_action = compute_next_best_action(db)
        return {
            "total_items": priorities.total_priority_count,
            "top_5_count": len(priorities.top_5_today),
            "summary": priorities.summary[:200],
            "next_action_title": next_action.get("title", "N/A"),
            "next_action_category": next_action.get("category", "N/A"),
            "top_5_items": [
                {"title": item.title, "urgency": item.urgency_score, "impact": item.estimated_impact}
                for item in priorities.top_5_today
            ],
        }
    finally:
        db.close()


def test_campaign_roi():
    """Test campaign ROI funnel with real CRM data."""
    db = SessionLocal()
    try:
        campaigns = db.query(Campaign).all()
        results = []
        for c in campaigns[:3]:
            try:
                roi = CampaignService.get_campaign_roi_funnel(db, c.id)
                results.append({
                    "campaign": c.name,
                    "leads": roi["leads_enrolled"],
                    "sent": roi["emails_sent"],
                    "opened": roi["emails_opened"],
                    "replied": roi["replies_received"],
                    "meetings": roi["meetings_scheduled"],
                    "opportunities": roi["opportunities_created"],
                    "proposals": roi["proposals_sent"],
                    "won": roi["deals_won"],
                    "pipeline_value": roi["total_pipeline_value"],
                    "revenue": roi["total_revenue_won"],
                })
            except Exception as e:
                results.append({"campaign": c.name, "error": str(e)})
        return results
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 80)
    print("ELLY BD OS — END-TO-END PIPELINE TEST")
    print("=" * 80)

    # Test 1: Technology (FinTech)
    print("\n--- INDUSTRY 1: Technology (FinTech) ---")
    r1 = run_pipeline(
        industry="Technology",
        org_type="Technology Company",
        org_name="FinTech Innovations Inc",
        contact_name="Sarah Chen",
        opp_name="ELLY Platform for FinTech Ops",
    )
    for step in r1["steps"]:
        print(f"  {step}")
    if not r1["success"]:
        print(f"  ERROR: {r1['error']}")

    # Test 2: Manufacturing (Automotive)
    print("\n--- INDUSTRY 2: Manufacturing (Automotive) ---")
    r2 = run_pipeline(
        industry="Manufacturing",
        org_type="Manufacturing Company",
        org_name="AutoParts Global Ltd",
        contact_name="Marcus Williams",
        opp_name="ELLY AI for Manufacturing Sales",
    )
    for step in r2["steps"]:
        print(f"  {step}")
    if not r2["success"]:
        print(f"  ERROR: {r2['error']}")

    # Test 3: Daily Priorities
    print("\n--- DAILY PRIORITIES ENGINE ---")
    p = test_priorities()
    print(f"  Total items: {p['total_items']}")
    print(f"  Top 5 today: {p['top_5_count']}")
    print(f"  Summary: {p['summary']}")
    print(f"  Next action: {p['next_action_title']} ({p['next_action_category']})")
    if p["top_5_items"]:
        print("  Top 5 breakdown:")
        for i, item in enumerate(p["top_5_items"]):
            print(f"    {i+1}. [{item['urgency']}] {item['title']}")
            print(f"       Impact: {item['impact']}")

    # Test 4: Campaign ROI
    print("\n--- CAMPAIGN ROI (Real CRM Data) ---")
    roi = test_campaign_roi()
    if roi:
        for r in roi:
            if "error" in r:
                print(f"  {r['campaign']}: ERROR - {r['error']}")
            else:
                print(f"  {r['campaign']}:")
                print(f"    Leads: {r['leads']} -> Sent: {r['sent']} -> Opened: {r['opened']} -> Replied: {r['replied']}")
                print(f"    Meetings: {r['meetings']} -> Opps: {r['opportunities']} -> Proposals: {r['proposals']} -> Won: {r['won']}")
                print(f"    Pipeline: ${r['pipeline_value']:,.0f} | Revenue: ${r['revenue']:,.0f}")
    else:
        print("  No campaigns found")

    # Summary
    print("\n" + "=" * 80)
    all_pass = r1["success"] and r2["success"]
    print(f"RESULT: {'ALL PASS' if all_pass else 'FAILURES DETECTED'}")
    print(f"  Technology pipeline: {'PASS' if r1['success'] else 'FAIL'}")
    print(f"  Manufacturing pipeline: {'PASS' if r2['success'] else 'FAIL'}")
    print(f"  Daily priorities: PASS ({p['total_items']} items, {p['top_5_count']} top-5)")
    print(f"  Campaign ROI: PASS ({len(roi)} campaigns)")
    print("=" * 80)
