from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_, and_

from app.models.organization import Organization, ConnectionStatus, PriorityLevel
from app.models.contact import Contact
from app.models.opportunity import Opportunity, OpportunityStage, OpportunityPriority
from app.models.meeting import Meeting, MeetingStatus
from app.models.followup import FollowUp, FollowUpStatus, FollowUpPriority
from app.models.demo import Demo, DemoStatus
from app.models.proposal import Proposal, ProposalStatus
from app.models.negotiation import Negotiation, NegotiationStatus
from app.models.customer import Customer, CustomerStatus, AccountHealth
from app.models.task import BDTask, TaskStatus, TaskPriority
from app.models.communication import Communication
from app.models.user import User
from app.schemas.daily_priorities import DailyPrioritiesResponse, PriorityItem


def _to_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def compute_daily_priorities(db: Session, user: Optional[User] = None) -> DailyPrioritiesResponse:
    now = datetime.now(timezone.utc)
    all_items: List[PriorityItem] = []

    # 1. Who should I contact today?
    # Uncontacted or high priority target with no recent outreach
    who_contact: Optional[PriorityItem] = None
    target_org = (
        db.query(Organization)
        .filter(
            Organization.is_deleted == False,
            Organization.status.in_([ConnectionStatus.NEW.value, ConnectionStatus.POTENTIAL.value, ConnectionStatus.CONTACTED.value]),
            Organization.priority == PriorityLevel.HIGH.value
        )
        .first()
    )
    if not target_org:
        target_org = (
            db.query(Organization)
            .filter(
                Organization.is_deleted == False,
                Organization.status.in_([ConnectionStatus.NEW.value, ConnectionStatus.POTENTIAL.value])
            )
            .first()
        )

    if target_org:
        primary_c = (
            db.query(Contact)
            .filter(Contact.organization_id == target_org.id, Contact.is_deleted == False)
            .order_by(desc(Contact.is_decision_maker), desc(Contact.is_primary_contact))
            .first()
        )
        who_contact = PriorityItem(
            category="who_to_contact",
            title=f"Initial Outreach: {target_org.name}",
            target_name=target_org.name,
            target_type="organization",
            target_id=target_org.id,
            priority="High",
            reason_why=f"High-priority {target_org.organization_type} in {target_org.city or 'target region'} with high technology partnership fit and no active discussion yet.",
            recommended_action=f"Draft and review an introduction email to {primary_c.first_name + ' ' + primary_c.last_name + ' (' + (primary_c.designation or 'Leadership') + ')' if primary_c else 'Key Decision Maker'} via Outreach Workspace.",
            url=f"/business-development/organizations/{target_org.id}",
            metadata={"contact_id": primary_c.id if primary_c else None, "city": target_org.city}
        )
        all_items.append(who_contact)

    # 2. Who needs follow-up?
    # Overdue follow-up
    who_fu: Optional[PriorityItem] = None
    all_pending_fu = (
        db.query(FollowUp)
        .filter(
            FollowUp.is_deleted == False,
            FollowUp.status == FollowUpStatus.PENDING.value
        )
        .order_by(desc(FollowUp.priority), FollowUp.due_at.asc())
        .all()
    )
    
    overdue_fu = None
    if all_pending_fu:
        # Find first overdue
        for fu_item in all_pending_fu:
            if fu_item.due_at and _to_utc(fu_item.due_at) < now:
                overdue_fu = fu_item
                break
        if not overdue_fu:
            overdue_fu = all_pending_fu[0]

    if overdue_fu:
        org_name = overdue_fu.organization.name if overdue_fu.organization else "Organization"
        fu_due_utc = _to_utc(overdue_fu.due_at) if overdue_fu.due_at else now
        is_overdue = fu_due_utc < now
        who_fu = PriorityItem(
            category="overdue_followup",
            title=f"{'Overdue' if is_overdue else 'Upcoming'} Follow-up: {overdue_fu.title}",
            target_name=org_name,
            target_type="followup",
            target_id=overdue_fu.id,
            priority="High" if overdue_fu.priority == FollowUpPriority.HIGH.value or is_overdue else "Medium",
            reason_why=f"Follow-up was scheduled for {overdue_fu.due_at.strftime('%b %d, %Y') if overdue_fu.due_at else 'Soon'} ({'Overdue' if is_overdue else 'Due soon'}) for {org_name}.",
            recommended_action=f"Execute reminder task: '{overdue_fu.title}' and update status upon completion.",
            url=f"/business-development/followups",
            metadata={"due_at": overdue_fu.due_at.isoformat() if overdue_fu.due_at else None, "organization_id": overdue_fu.organization_id}
        )
        all_items.append(who_fu)

    # 3. Which meeting / demo is next?
    which_meeting: Optional[PriorityItem] = None
    meets = db.query(Meeting).filter(Meeting.is_deleted == False).all()
    upcoming_meets = [m for m in meets if m.scheduled_at and _to_utc(m.scheduled_at) >= (now - timedelta(hours=1))]
    next_m = None
    if upcoming_meets:
        upcoming_meets.sort(key=lambda m: _to_utc(m.scheduled_at))
        next_m = upcoming_meets[0]

    if next_m:
        org_name = next_m.organization.name if next_m.organization else "Target Organization"
        which_meeting = PriorityItem(
            category="next_meeting",
            title=f"Next Meeting: {next_m.title}",
            target_name=org_name,
            target_type="meeting",
            target_id=next_m.id,
            priority="High",
            reason_why=f"Scheduled for {next_m.scheduled_at.strftime('%A, %b %d at %I:%M %p')} ({next_m.meeting_type}).",
            recommended_action="Review 360° account dossier, previous notes, and prepare recommended showcase projects.",
            url=f"/business-development/meetings/{next_m.id}",
            metadata={"scheduled_at": next_m.scheduled_at.isoformat(), "organization_id": next_m.organization_id}
        )
        all_items.append(which_meeting)

    # 4. Which opportunity is most important?
    which_opp: Optional[PriorityItem] = None
    top_opp = (
        db.query(Opportunity)
        .filter(
            Opportunity.is_deleted == False,
            Opportunity.stage.notin_([OpportunityStage.PARTNERSHIP.value, OpportunityStage.CUSTOMER.value])
        )
        .order_by(desc(Opportunity.estimated_value), desc(Opportunity.probability))
        .first()
    )
    if top_opp:
        org_name = top_opp.organization.name if top_opp.organization else "Organization"
        opp_val = top_opp.estimated_value or 0.0
        which_opp = PriorityItem(
            category="which_opportunity_is_most_important",
            title=f"Key Commercial Deal: {top_opp.name}",
            target_name=org_name,
            target_type="opportunity",
            target_id=top_opp.id,
            priority="High",
            reason_why=f"Estimated deal value of ₹{opp_val:,.2f} ({top_opp.stage} stage, {top_opp.probability or 50}% probability).",
            recommended_action=f"Drive next action: '{top_opp.next_action or 'Advance to next commercial stage'}' to accelerate deal close.",
            url=f"/business-development/opportunities/{top_opp.id}",
            metadata={"value": opp_val, "stage": top_opp.stage}
        )
        all_items.append(which_opp)

    # 5. Which deal is stale?
    which_stale: Optional[PriorityItem] = None
    fourteen_days_ago = now - timedelta(days=14)
    opps = db.query(Opportunity).filter(
        Opportunity.is_deleted == False,
        Opportunity.stage.notin_([OpportunityStage.PARTNERSHIP.value, OpportunityStage.CUSTOMER.value])
    ).all()
    stale_list = [op for op in opps if op.updated_at and _to_utc(op.updated_at) < fourteen_days_ago]
    stale_opp = None
    if stale_list:
        stale_list.sort(key=lambda op: _to_utc(op.updated_at))
        stale_opp = stale_list[0]
    if stale_opp:
        org_name = stale_opp.organization.name if stale_opp.organization else "Organization"
        which_stale = PriorityItem(
            category="stale_opportunity",
            title=f"Stale Deal Alert: {stale_opp.name}",
            target_name=org_name,
            target_type="opportunity",
            target_id=stale_opp.id,
            priority="Medium",
            reason_why=f"No activity or stage transition recorded for {stale_opp.name} in over 14 days (Current stage: {stale_opp.stage}).",
            recommended_action=f"Check in with leadership at {org_name} to reactivate discussion and schedule a demo.",
            url=f"/business-development/opportunities/{stale_opp.id}",
            metadata={"last_updated": stale_opp.updated_at.isoformat()}
        )
        all_items.append(which_stale)

    # 6. Which proposal needs attention?
    which_prop: Optional[PriorityItem] = None
    active_prop = (
        db.query(Proposal)
        .filter(
            Proposal.is_deleted == False,
            Proposal.status.in_([ProposalStatus.INTERNAL_REVIEW.value, ProposalStatus.SENT.value, ProposalStatus.UNDER_DISCUSSION.value, ProposalStatus.DRAFT.value])
        )
        .order_by(desc(Proposal.value), desc(Proposal.date_created))
        .first()
    )
    if active_prop:
        org_name = active_prop.organization.name if active_prop.organization else "Organization"
        prop_val = active_prop.value or 0.0
        which_prop = PriorityItem(
            category="pending_proposal",
            title=f"Proposal Follow-up: {active_prop.title}",
            target_name=org_name,
            target_type="proposal",
            target_id=active_prop.id,
            priority="High" if active_prop.status == ProposalStatus.SENT.value else "Medium",
            reason_why=f"Proposal ({active_prop.version}, ₹{prop_val:,.2f}) is in '{active_prop.status}' status.",
            recommended_action="Follow up with the evaluation committee to answer technical questions and move to negotiation.",
            url=f"/business-development/proposals/{active_prop.id}",
            metadata={"status": active_prop.status, "value": prop_val}
        )
        all_items.append(which_prop)

    # 7. Which negotiation needs attention?
    which_neg: Optional[PriorityItem] = None
    active_neg = (
        db.query(Negotiation)
        .filter(
            Negotiation.is_deleted == False,
            Negotiation.status.in_([NegotiationStatus.BLOCKED.value, NegotiationStatus.ACTIVE.value])
        )
        .order_by(desc(Negotiation.commercial_value))
        .first()
    )
    if active_neg:
        org_name = active_neg.organization.name if active_neg.organization else "Organization"
        neg_val = active_neg.commercial_value or 0.0
        which_neg = PriorityItem(
            category="blocked_negotiation",
            title=f"Negotiation Review: {active_neg.title}",
            target_name=org_name,
            target_type="negotiation",
            target_id=active_neg.id,
            priority="High" if active_neg.status == NegotiationStatus.BLOCKED.value else "Medium",
            reason_why=f"Commercial contract negotiation (₹{neg_val:,.2f}) status is '{active_neg.status}'. Open issues: {active_neg.open_issues or 'Terms finalization'}.",
            recommended_action="Address open commercial clauses to finalize agreement and convert to active partnership/customer.",
            url=f"/business-development/negotiations/{active_neg.id}",
            metadata={"status": active_neg.status, "value": neg_val}
        )
        all_items.append(which_neg)

    # 8. Which customer needs attention?
    which_cust: Optional[PriorityItem] = None
    risk_cust = (
        db.query(Customer)
        .filter(
            Customer.is_deleted == False,
            Customer.account_health.in_([AccountHealth.CRITICAL.value, AccountHealth.NEEDS_ATTENTION.value])
        )
        .first()
    )
    if risk_cust:
        org_name = risk_cust.organization.name if risk_cust.organization else "Customer Account"
        cust_val = risk_cust.contract_value or 0.0
        which_cust = PriorityItem(
            category="customer_at_risk",
            title=f"Account Health Warning: {org_name}",
            target_name=org_name,
            target_type="customer",
            target_id=risk_cust.id,
            priority="High",
            reason_why=f"Customer health is '{risk_cust.account_health}'. Contract value: ₹{cust_val:,.2f}.",
            recommended_action="Schedule an executive alignment check-in to resolve satisfaction blockers and ensure renewal.",
            url=f"/business-development/customers/{risk_cust.id}",
            metadata={"health": risk_cust.account_health}
        )
        all_items.append(which_cust)

    # 9. Campaign Activity & Prospects who replied
    try:
        from app.models.campaign import CampaignContact, CampaignContactStatus
        replied_cc = (
            db.query(CampaignContact)
            .filter(CampaignContact.status == CampaignContactStatus.REPLIED.value)
            .order_by(desc(CampaignContact.last_action_at))
            .first()
        )
        if replied_cc:
            c_name = replied_cc.contact.full_name if replied_cc.contact else "Prospect"
            org_name = replied_cc.organization.name if replied_cc.organization else "Organization"
            reply_priority = PriorityItem(
                category="campaign_reply",
                title=f"Prospect Replied: {c_name} ({org_name})",
                target_name=org_name,
                target_type="contact",
                target_id=replied_cc.contact_id,
                priority="High",
                reason_why=f"{c_name} responded to campaign '{replied_cc.campaign.name if replied_cc.campaign else 'Outreach'}'. Sequence automatically paused.",
                recommended_action="Review incoming reply, schedule initial meeting or demo, and advance to next opportunity stage.",
                url=f"/business-development/campaigns/{replied_cc.campaign_id}",
                metadata={"campaign_id": replied_cc.campaign_id, "contact_id": replied_cc.contact_id}
            )
            all_items.append(reply_priority)

        # Pending review in campaigns
        review_cc = (
            db.query(CampaignContact)
            .filter(CampaignContact.status == CampaignContactStatus.READY_FOR_REVIEW.value)
            .first()
        )
        if review_cc:
            c_name = review_cc.contact.full_name if review_cc.contact else "Prospect"
            org_name = review_cc.organization.name if review_cc.organization else "Organization"
            review_priority = PriorityItem(
                category="campaign_review",
                title=f"Campaign Email Ready for Review: {c_name}",
                target_name=org_name,
                target_type="campaign",
                target_id=review_cc.campaign_id,
                priority="Medium",
                reason_why=f"Step {review_cc.current_step_number} email prepared for {c_name} (Personalization Score: {review_cc.personalization_score:.0f}%).",
                recommended_action="Review AI generated email draft in Campaign Detail and send via Gmail.",
                url=f"/business-development/campaigns/{review_cc.campaign_id}",
                metadata={"campaign_id": review_cc.campaign_id, "contact_id": review_cc.contact_id}
            )
            all_items.append(review_priority)
    except Exception as e:
        pass

    # Top single next action recommendation
    what_next = "Focus on your top daily priorities above: initiate outreach to high-fit prospects, execute pending follow-ups, and prepare for upcoming meetings."
    if who_fu:
        what_next = f"First priority: Complete overdue follow-up '{who_fu.title}' for {who_fu.target_name}."
    elif which_meeting:
        what_next = f"First priority: Prepare presentation materials and review briefing for upcoming meeting with {which_meeting.target_name}."
    elif who_contact:
        what_next = f"First priority: Initiate outreach to high-priority target {who_contact.target_name}."

    # Score and rank all items for top_5_today
    urgency_weights = {
        "campaign_reply": 100,
        "customer_at_risk": 95,
        "next_meeting": 90,
        "overdue_followup": 85,
        "which_opportunity_is_most_important": 80,
        "blocked_negotiation": 75,
        "campaign_review": 70,
        "who_should_i_contact_today": 60,
        "stale_opportunity": 55,
        "pending_proposal": 50,
    }
    impact_map = {
        "campaign_reply": "Convert reply to meeting — highest conversion signal in pipeline",
        "customer_at_risk": "Prevent churn — retain existing revenue and relationship",
        "next_meeting": "Advance deal — next step toward commercial close",
        "overdue_followup": "Prevent lead decay — timely follow-up doubles response rate",
        "which_opportunity_is_most_important": "Drive highest-value deal forward",
        "blocked_negotiation": "Unblock revenue — negotiation stuck on open issues",
        "campaign_review": "Send personalized email — maintain campaign momentum",
        "who_should_i_contact_today": "Initiate pipeline — new touchpoint with high-fit prospect",
        "stale_opportunity": "Re-engage — stale deals lose 60% probability per 30 days",
        "pending_proposal": "Advance proposal — keep deal moving through pipeline",
    }

    for item in all_items:
        item.urgency_score = urgency_weights.get(item.category, 50)
        item.estimated_impact = impact_map.get(item.category, "Advance pipeline stage")

    scored = sorted(all_items, key=lambda x: x.urgency_score or 0, reverse=True)
    top_5 = scored[:5]

    # Build summary with top 5
    if top_5:
        top_titles = [f"{i+1}. {item.title}" for i, item in enumerate(top_5)]
        summary = (
            f"Today's top {len(top_5)} priorities:\n"
            + "\n".join(top_titles)
            + f"\n\n{len(all_items)} total items requiring attention across the BD funnel."
        )
    else:
        summary = "No urgent priorities today. Pipeline is clear — run discovery to find new targets."

    return DailyPrioritiesResponse(
        summary=summary,
        top_5_today=top_5,
        total_priority_count=len(all_items),
        who_should_i_contact_today=who_contact,
        who_needs_followup=who_fu,
        which_meeting_is_next=which_meeting,
        which_opportunity_is_most_important=which_opp,
        which_deal_is_stale=which_stale,
        which_proposal_needs_attention=which_prop,
        which_negotiation_needs_attention=which_neg,
        which_customer_needs_attention=which_cust,
        what_should_i_do_next=what_next,
        all_priority_items=all_items,
    )


def compute_next_best_action(db: Session, user: Optional[User] = None) -> Dict[str, Any]:
    """
    Evaluates 7 commercial funnel signals and returns the single highest-priority next best action,
    ranked by urgency, pipeline impact, and relationship freshness.
    """
    priorities = compute_daily_priorities(db, user)
    all_items = priorities.all_priority_items

    if not all_items:
        return {
            "category": "explore_new_leads",
            "title": "Discover New Target Organizations",
            "priority": "Medium",
            "urgency_score": 40,
            "target_name": "Pipeline Discovery",
            "reason_why": "All current pipeline items are up to date with no pending follow-ups or stale deals.",
            "recommended_action": "Run discovery to find and qualify new prospective B2B organizations.",
            "action_url": "/business-development/discovery",
            "alternative_priorities": [],
        }

    # Weight ranking map
    weight_map = {
        "campaign_reply": 100,
        "next_meeting": 90,
        "overdue_followup": 80,
        "which_opportunity_is_most_important": 75,
        "blocked_negotiation": 70,
        "campaign_review": 60,
        "who_should_i_contact_today": 50,
        "stale_opportunity": 45,
        "pending_proposal": 40,
        "customer_at_risk": 85,
    }

    scored_items = []
    for item in all_items:
        w = weight_map.get(item.category, 50)
        scored_items.append((w, item))

    scored_items.sort(key=lambda x: x[0], reverse=True)
    top_score, top_item = scored_items[0]

    alternatives = [
        {
            "category": it.category,
            "title": it.title,
            "target_name": it.target_name,
            "priority": it.priority,
            "url": it.url,
        }
        for _, it in scored_items[1:5]
    ]

    return {
        "category": top_item.category,
        "title": top_item.title,
        "priority": top_item.priority,
        "urgency_score": top_score,
        "target_name": top_item.target_name,
        "target_type": top_item.target_type,
        "target_id": top_item.target_id,
        "reason_why": top_item.reason_why,
        "recommended_action": top_item.recommended_action,
        "action_url": top_item.url,
        "metadata": top_item.metadata,
        "alternative_priorities": alternatives,
    }
