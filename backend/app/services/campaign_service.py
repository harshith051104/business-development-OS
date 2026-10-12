import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.campaign import (
    Campaign,
    CampaignStatus,
    CampaignSequenceStep,
    CampaignContact,
    CampaignContactStatus,
)
from app.models.contact import Contact
from app.models.organization import Organization, ConnectionStatus
from app.models.communication import (
    Communication,
    CommunicationChannel,
    CommunicationDirection,
    CommunicationStatus,
)
from app.models.followup import FollowUp, FollowUpPriority, FollowUpStatus
from app.models.user import User
from app.schemas.campaign import CampaignCreate, CampaignUpdate, CampaignSequenceStepCreate
from app.services.campaign.compiler import CampaignCompiler
from app.services.gmail_service import GmailService
from app.core.audit import log_audit_event

logger = logging.getLogger("elly.campaign.service")


class CampaignService:
    """
    Complete Campaign Execution & Multi-Step Sequence Automation Engine.
    Integrates directly with existing Organizations, Contacts, Communications, and Follow-ups.
    """

    @classmethod
    def create_campaign(cls, db: Session, user: User, data: CampaignCreate) -> Campaign:
        campaign = Campaign(
            name=data.name,
            description=data.description,
            category=getattr(data, "category", None) or "client",
            sender_email=data.sender_email,
            gmail_account_id=data.gmail_account_id,
            target_industry=data.target_industry,
            status=CampaignStatus.DRAFT.value,
            created_by=user.id,
            owner_id=user.id,
        )
        db.add(campaign)
        db.flush()

        # Add sequence steps
        steps = data.sequence_steps
        if not steps:
            # Default 4-step sequence
            steps = [
                CampaignSequenceStepCreate(
                    step_number=1,
                    delay_days=0,
                    channel="Email",
                    subject_template="Collaboration with {{organization_name}} & ELLY",
                    body_template="Hi {{first_name}},\n\n{{opening_hook}}\n\n{{relevant_problem}}\n\n{{ai_value_prop}}\n\n{{cta}}\n\nBest regards,\n{{sender_name}}\n{{sender_email}}",
                ),
                CampaignSequenceStepCreate(
                    step_number=2,
                    delay_days=3,
                    channel="Email",
                    subject_template="Quick follow-up regarding {{organization_name}}",
                    body_template="Hi {{first_name}},\n\n{{opening_hook}}\n\n{{relevant_problem}}\n\n{{ai_value_prop}}\n\n{{cta}}\n\nBest,\n{{sender_name}}",
                ),
                CampaignSequenceStepCreate(
                    step_number=3,
                    delay_days=7,
                    channel="Email",
                    subject_template="Strategic perspective for {{organization_name}}",
                    body_template="Hi {{first_name}},\n\n{{opening_hook}}\n\n{{ai_value_prop}}\n\n{{cta}}\n\nBest regards,\n{{sender_name}}",
                ),
                CampaignSequenceStepCreate(
                    step_number=4,
                    delay_days=14,
                    channel="Email",
                    subject_template="Final check-in: {{organization_name}}",
                    body_template="Hi {{first_name}},\n\n{{opening_hook}}\n\n{{cta}}\n\nWarmly,\n{{sender_name}}",
                ),
            ]

        for step in steps:
            db_step = CampaignSequenceStep(
                campaign_id=campaign.id,
                step_number=step.step_number,
                delay_days=step.delay_days,
                channel=step.channel or "Email",
                subject_template=step.subject_template,
                body_template=step.body_template,
                notes=step.notes,
            )
            db.add(db_step)

        # Enroll initial contacts if provided
        if data.contact_ids:
            cls.enroll_contacts(db, campaign.id, data.contact_ids, user=user)

        db.commit()
        db.refresh(campaign)

        log_audit_event(
            db=db,
            action="CREATE",
            resource_type="Campaign",
            resource_id=campaign.id,
            user=user,
            metadata={"name": campaign.name, "steps_count": len(steps)},
        )
        return campaign

    @classmethod
    def enroll_contacts(cls, db: Session, campaign_id: int, contact_ids: List[int], user: Optional[User] = None) -> int:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError(f"Campaign {campaign_id} not found.")

        added_count = 0
        first_step = (
            db.query(CampaignSequenceStep)
            .filter(CampaignSequenceStep.campaign_id == campaign_id, CampaignSequenceStep.step_number == 1)
            .first()
        )

        for cid in contact_ids:
            contact = db.query(Contact).filter(Contact.id == cid).first()
            if not contact:
                continue

            existing = db.query(CampaignContact).filter(
                CampaignContact.campaign_id == campaign_id,
                CampaignContact.contact_id == cid
            ).first()

            if not existing:
                # Pre-compile preview if step exists
                preview = None
                try:
                    preview = CampaignCompiler.compile_step_email(
                        db=db,
                        contact_id=cid,
                        subject_template=first_step.subject_template if first_step else None,
                        body_template=first_step.body_template if first_step else "",
                        step_number=1,
                        sender_user=user,
                    )
                except Exception as e:
                    logger.warning(f"Error pre-compiling preview for contact {cid}: {e}")

                cc = CampaignContact(
                    campaign_id=campaign_id,
                    contact_id=cid,
                    organization_id=contact.organization_id,
                    current_step_number=1,
                    status=CampaignContactStatus.READY_FOR_REVIEW.value,
                    assigned_user_id=user.id if user else None,
                    personalization_score=preview.get("personalization_score", 75.0) if preview else 75.0,
                    subject_preview=preview.get("subject", "") if preview else "",
                    body_preview=preview.get("body_html", "") if preview else "",
                    ai_cache=preview.get("ai_generated_fields") if preview else {},
                    next_action_due=datetime.now(timezone.utc),
                )
                db.add(cc)
                added_count += 1

        db.commit()
        return added_count

    @classmethod
    def quick_send(
        cls,
        db: Session,
        user: User,
        organization_ids: List[int],
        subject_template: Optional[str] = None,
        body_template: Optional[str] = None,
        campaign_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        No-approval bulk send for the Funding module (angel investors / VCs / business
        contacts) — modeled on the user's other outreach platform, which skips the
        human-review step used by client campaigns. Creates a 'funding'-category
        Campaign, enrolls each org's first contact with a valid email directly as
        APPROVED, then sends immediately via the existing send_step_email.

        send_step_email's approval gate is untouched: pre-setting status=APPROVED here
        is what lets this flow skip review, while every client campaign still requires
        a human to hit /approve.
        """
        campaign = Campaign(
            name=campaign_name or f"Funding Outreach {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}",
            category="funding",
            status=CampaignStatus.ACTIVE.value,
            created_by=user.id,
            owner_id=user.id,
        )
        db.add(campaign)
        db.flush()

        # If no template given, let the existing AI personalization engine generate
        # the whole message (opening_hook/relevant_problem/ai_value_prop/cta) — this is
        # the "AI-generated" path; a user-supplied template takes the "user template" path.
        default_subject = subject_template or "Introduction: {{organization_name}} x {{sender_name}}"
        default_body = body_template or (
            "Hi {{first_name}},\n\n{{opening_hook}}\n\n{{relevant_problem}}\n\n"
            "{{ai_value_prop}}\n\n{{cta}}\n\nBest regards,\n{{sender_name}}\n{{sender_email}}"
        )
        db.add(CampaignSequenceStep(
            campaign_id=campaign.id,
            step_number=1,
            delay_days=0,
            channel="Email",
            subject_template=default_subject,
            body_template=default_body,
        ))
        db.flush()

        now = datetime.now(timezone.utc)
        results: List[Dict[str, Any]] = []

        for org_id in organization_ids:
            contact = (
                db.query(Contact)
                .filter(Contact.organization_id == org_id, Contact.email.isnot(None), Contact.email != "")
                .order_by(Contact.id.asc())
                .first()
            )
            if not contact:
                results.append({"organization_id": org_id, "success": False, "error": "no_contact_with_email"})
                continue

            try:
                preview = CampaignCompiler.compile_step_email(
                    db=db,
                    contact_id=contact.id,
                    subject_template=default_subject,
                    body_template=default_body,
                    step_number=1,
                    sender_user=user,
                )
            except Exception as e:
                logger.warning(f"Quick-send compile failed for contact {contact.id}: {e}")
                results.append({"organization_id": org_id, "contact_id": contact.id, "success": False, "error": "compile_failed"})
                continue

            cc = CampaignContact(
                campaign_id=campaign.id,
                contact_id=contact.id,
                organization_id=org_id,
                current_step_number=1,
                status=CampaignContactStatus.APPROVED.value,
                assigned_user_id=user.id,
                approved_by=user.id,
                approved_at=now,
                personalization_score=preview.get("personalization_score", 75.0),
                subject_preview=preview.get("subject", ""),
                body_preview=preview.get("body_html", ""),
                ai_cache=preview.get("ai_generated_fields") or {},
            )
            db.add(cc)
            db.flush()

            try:
                send_res = cls.send_step_email(
                    db=db,
                    campaign_id=campaign.id,
                    contact_id=contact.id,
                    user=user,
                    subject=preview["subject"],
                    body_html=preview["body_html"],
                )
                results.append({"organization_id": org_id, "contact_id": contact.id, "success": True, **send_res})
            except Exception as e:
                logger.warning(f"Quick-send failed for contact {contact.id}: {e}")
                results.append({"organization_id": org_id, "contact_id": contact.id, "success": False, "error": str(e)})

        db.commit()

        return {
            "campaign_id": campaign.id,
            "sent": sum(1 for r in results if r.get("success")),
            "failed": sum(1 for r in results if not r.get("success")),
            "results": results,
        }

    @classmethod
    def get_campaign_stats(cls, db: Session, campaign_id: int) -> Dict[str, Any]:
        contacts = db.query(CampaignContact).filter(CampaignContact.campaign_id == campaign_id).all()
        total = len(contacts)
        pending = sum(1 for c in contacts if c.status == CampaignContactStatus.PENDING.value)
        ready = sum(1 for c in contacts if c.status == CampaignContactStatus.READY_FOR_REVIEW.value)
        sent = sum(1 for c in contacts if c.status == CampaignContactStatus.SENT.value)
        replied = sum(1 for c in contacts if c.status == CampaignContactStatus.REPLIED.value)
        paused = sum(1 for c in contacts if c.status == CampaignContactStatus.PAUSED.value)
        completed = sum(1 for c in contacts if c.status == CampaignContactStatus.COMPLETED.value)
        bounced = sum(1 for c in contacts if c.status == CampaignContactStatus.BOUNCED.value)

        # Sent total includes sent, replied, completed
        actually_sent = sent + replied + completed
        reply_rate = round((replied / actually_sent * 100), 1) if actually_sent > 0 else 0.0
        conversion_rate = round((replied / total * 100), 1) if total > 0 else 0.0

        return {
            "total_contacts": total,
            "pending": pending,
            "ready_for_review": ready,
            "sent": actually_sent,
            "replied": replied,
            "paused": paused,
            "completed": completed,
            "bounced": bounced,
            "reply_rate": reply_rate,
            "conversion_rate": conversion_rate,
            "meetings_generated": replied,
        }

    @classmethod
    def send_step_email(
        cls,
        db: Session,
        campaign_id: int,
        contact_id: int,
        user: User,
        subject: str,
        body_html: str,
    ) -> Dict[str, Any]:
        """
        Executes human-confirmed sending of a campaign step email.
        Dispatches via Gmail, logs Communication, advances sequence step.
        """
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError(f"Campaign {campaign_id} not found.")

        cc = db.query(CampaignContact).filter(
            CampaignContact.campaign_id == campaign_id,
            CampaignContact.contact_id == contact_id
        ).first()
        if not cc:
            raise ValueError(f"Contact {contact_id} is not enrolled in campaign {campaign_id}.")

        # Tier 0.4: Require approval before sending
        if cc.status not in [
            CampaignContactStatus.APPROVED.value,
            CampaignContactStatus.SENT.value,  # Allow re-sends
            CampaignContactStatus.REPLIED.value,  # Allow follow-ups
        ]:
            raise ValueError(
                f"Contact {contact_id} must be Approved before sending. "
                f"Current status: {cc.status}. Use /approve endpoint first."
            )

        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact or not contact.email:
            raise ValueError(f"Contact {contact_id} does not have a valid email address.")

        # 1. Send via Gmail API
        send_res = GmailService.send_email(
            db=db,
            gmail_account_id=campaign.gmail_account_id,
            to_email=contact.email,
            subject=subject,
            body_html=body_html,
            thread_id=cc.thread_id,
            user_id=user.id,
            campaign_contact_id=cc.id,
        )

        now = datetime.now(timezone.utc)
        cc.last_action_at = now
        cc.last_message_id = send_res.get("message_id")
        cc.thread_id = send_res.get("thread_id")

        # 2. Record Communication in existing timeline
        comm = Communication(
            organization_id=contact.organization_id,
            contact_id=contact.id,
            channel=CommunicationChannel.EMAIL.value,
            direction=CommunicationDirection.OUTGOING.value,
            subject=subject,
            summary=f"Campaign '{campaign.name}' - Step {cc.current_step_number} Email Sent",
            status=CommunicationStatus.COMPLETED.value,
            created_by=str(user.id),
            communication_date=now,
        )
        db.add(comm)

        # 3. Update Organization status if currently New
        org = db.query(Organization).filter(Organization.id == contact.organization_id).first()
        if org and org.status in [ConnectionStatus.NEW.value, ConnectionStatus.POTENTIAL.value]:
            org.status = ConnectionStatus.CONTACTED.value

        # 4. Check for Next Sequence Step
        next_step = (
            db.query(CampaignSequenceStep)
            .filter(
                CampaignSequenceStep.campaign_id == campaign_id,
                CampaignSequenceStep.step_number == cc.current_step_number + 1
            )
            .first()
        )

        if next_step:
            cc.current_step_number += 1
            cc.status = CampaignContactStatus.PENDING.value
            cc.next_action_due = now + timedelta(days=next_step.delay_days)
            # Pre-compile next step preview
            try:
                next_preview = CampaignCompiler.compile_step_email(
                    db=db,
                    contact_id=contact_id,
                    subject_template=next_step.subject_template,
                    body_template=next_step.body_template,
                    step_number=cc.current_step_number,
                    sender_user=user,
                    cached_ai_values=cc.ai_cache,
                )
                cc.subject_preview = next_preview.get("subject")
                cc.body_preview = next_preview.get("body_html")
                cc.personalization_score = next_preview.get("personalization_score", 80.0)
            except Exception as e:
                logger.warning(f"Error compiling next step preview: {e}")
        else:
            # Reached end of sequence
            cc.status = CampaignContactStatus.SENT.value
            cc.next_action_due = None

        db.commit()
        db.refresh(cc)

        log_audit_event(
            db=db,
            action="SEND_CAMPAIGN_EMAIL",
            resource_type="CampaignContact",
            resource_id=cc.id,
            user=user,
            metadata={"campaign_id": campaign_id, "step": cc.current_step_number - 1, "to": contact.email},
        )

        return {
            "success": True,
            "message_id": send_res.get("message_id"),
            "thread_id": send_res.get("thread_id"),
            "contact_id": contact_id,
            "status": cc.status,
            "next_step_number": cc.current_step_number,
            "next_action_due": cc.next_action_due,
        }

    @classmethod
    def record_reply_and_pause(
        cls,
        db: Session,
        contact_id: int,
        reply_subject: str,
        reply_snippet: str,
        campaign_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Triggered when a reply is detected from a contact.
        Pauses the campaign sequence, marks status=Replied, logs Communication, creates FollowUp.
        """
        query = db.query(CampaignContact).filter(CampaignContact.contact_id == contact_id)
        if campaign_id:
            query = query.filter(CampaignContact.campaign_id == campaign_id)
        cc = query.first()

        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact:
            raise ValueError(f"Contact {contact_id} not found.")

        now = datetime.now(timezone.utc)

        # 1. Update Campaign Contact
        if cc:
            cc.status = CampaignContactStatus.REPLIED.value
            cc.next_action_due = None
            cc.last_action_at = now
            cc.replied_at = now

        # 2. Record Inbound Communication
        comm = Communication(
            organization_id=contact.organization_id,
            contact_id=contact.id,
            channel=CommunicationChannel.EMAIL.value,
            direction=CommunicationDirection.INCOMING.value,
            subject=reply_subject or "Re: Outreach",
            summary=f"Prospect replied: {reply_snippet[:150]}...",
            status=CommunicationStatus.COMPLETED.value,
            created_by=str(user_id or 1),
            communication_date=now,
        )
        db.add(comm)

        # 3. Create high-priority Follow-up
        org = db.query(Organization).filter(Organization.id == contact.organization_id).first()
        org_name = org.name if org else "Prospect"
        followup = FollowUp(
            organization_id=contact.organization_id,
            contact_id=contact.id,
            title=f"Respond to reply from {contact.full_name} ({org_name})",
            description=f"Contact replied to outreach campaign. Snippet: '{reply_snippet}'. Review email thread and schedule demo/meeting.",
            due_at=now + timedelta(days=1),
            priority=FollowUpPriority.HIGH.value,
            status=FollowUpStatus.PENDING.value,
            created_by=user_id or 1,
        )
        db.add(followup)

        # 4. Update Organization & Contact Status
        if org:
            org.status = ConnectionStatus.RESPONDED.value
        contact.connection_status = "Responded"

        # 5. Auto-create Opportunity if none exists for this org — reply = commercial signal.
        # Skip for funding/investor campaigns: a VC reply is not a sales pipeline opportunity.
        from app.models.opportunity import Opportunity, OpportunityStage
        is_funding_campaign = bool(cc and cc.campaign and cc.campaign.category == "funding")
        existing_opp = db.query(Opportunity).filter(
            Opportunity.organization_id == contact.organization_id,
            Opportunity.is_deleted == False,
        ).first()
        opp_created = False
        if not existing_opp and not is_funding_campaign:
            new_opp = Opportunity(
                organization_id=contact.organization_id,
                name=f"{org_name} — Inbound Interest",
                stage=OpportunityStage.CONTACTED.value,
                estimated_value=0.0,
                probability=20,
                priority="Medium",
                next_action="Schedule discovery call to qualify opportunity",
                notes=f"Auto-created from reply by {contact.full_name}. Snippet: {reply_snippet[:200]}",
                created_by=user_id or 1,
            )
            db.add(new_opp)
            opp_created = True

        # 6. Auto-schedule meeting if meeting intent / request detected in reply
        scheduled_meeting = None
        try:
            from app.services.meeting_scheduler import detect_and_schedule_meeting_from_reply
            scheduled_meeting = detect_and_schedule_meeting_from_reply(
                db=db,
                contact_id=contact.id,
                organization_id=contact.organization_id,
                reply_subject=reply_subject or "",
                reply_body=reply_snippet or "",
                user_id=user_id,
            )
            if scheduled_meeting:
                logger.info(f"Auto-scheduled meeting {scheduled_meeting.id} for contact {contact.id} ({scheduled_meeting.title})")
        except Exception as e:
            logger.warning(f"Failed to auto-detect/schedule meeting from reply: {e}")

        db.commit()

        notify_user_id = (cc.assigned_user_id if cc and cc.assigned_user_id else None) or user_id
        if notify_user_id:
            try:
                from app.services import notification_service
                notification_service.notify(
                    db,
                    user_id=notify_user_id,
                    type="REPLY_RECEIVED",
                    title=f"Reply from {contact.full_name}",
                    body=f"{org_name}: {reply_snippet[:150]}",
                    link="/business-development/leads/tracker",
                )
            except Exception as notify_err:
                logger.warning(f"Failed to send reply notification: {notify_err}")

        return {
            "success": True,
            "contact_id": contact_id,
            "status": "Replied",
            "sequence_paused": True,
            "followup_created": True,
            "opportunity_created": opp_created,
            "meeting_created": bool(scheduled_meeting),
            "meeting_id": scheduled_meeting.id if scheduled_meeting else None,
        }

    @classmethod
    def create_opportunity_from_campaign_contact(
        cls,
        db: Session,
        campaign_contact_id: int,
        user: User,
        estimated_value: Optional[float] = None,
        custom_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Confirmed bridge from an engaged CampaignContact to a commercial Opportunity in the BD pipeline.
        """
        from app.models.opportunity import Opportunity, OpportunityStage

        cc = db.query(CampaignContact).filter(CampaignContact.id == campaign_contact_id).first()
        if not cc:
            raise ValueError(f"CampaignContact {campaign_contact_id} not found.")

        contact = db.query(Contact).filter(Contact.id == cc.contact_id).first()
        org = db.query(Organization).filter(Organization.id == cc.organization_id).first()
        if not org or not contact:
            raise ValueError("Associated Organization or Contact not found.")

        # Check if an opportunity already exists for this org
        existing_opp = db.query(Opportunity).filter(
            Opportunity.organization_id == org.id,
            Opportunity.is_deleted == False
        ).first()

        if existing_opp:
            existing_opp.next_action = f"Advance discussion from campaign reply: {contact.full_name}"
            db.commit()
            return {
                "success": True,
                "opportunity_id": existing_opp.id,
                "opportunity_name": existing_opp.name,
                "stage": existing_opp.stage,
                "is_new": False,
            }

        opp_name = custom_name or f"{org.name} - Commercial Opportunity"
        val = estimated_value if estimated_value is not None else 150000.0

        new_opp = Opportunity(
            name=opp_name,
            organization_id=org.id,
            primary_contact_id=contact.id,
            stage=OpportunityStage.RESPONDED.value,
            probability=25,
            estimated_value=val,
            next_action="Schedule initial technical discovery demo & stakeholder alignment",
            owner_id=user.id,
            created_by=str(user.id),
        )
        db.add(new_opp)
        db.commit()
        db.refresh(new_opp)

        log_audit_event(
            db=db,
            action="CREATE_OPPORTUNITY_FROM_CAMPAIGN",
            resource_type="Opportunity",
            resource_id=new_opp.id,
            user=user,
            metadata={"campaign_id": cc.campaign_id, "contact_id": contact.id, "organization_id": org.id},
        )

        return {
            "success": True,
            "opportunity_id": new_opp.id,
            "opportunity_name": new_opp.name,
            "stage": new_opp.stage,
            "is_new": True,
        }

    @classmethod
    def get_campaign_roi_funnel(cls, db: Session, campaign_id: int) -> Dict[str, Any]:
        """
        Computes the complete commercial ROI funnel for a campaign:
        Leads -> Contacted/Sent -> Opened -> Replied -> Meetings -> Opportunities -> Proposals -> Won Deals -> Revenue
        """
        from app.models.meeting import Meeting
        from app.models.opportunity import Opportunity, OpportunityStage
        from app.models.proposal import Proposal
        from app.models.negotiation import Negotiation
        from app.models.customer import Customer

        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            raise ValueError(f"Campaign {campaign_id} not found.")

        contacts = db.query(CampaignContact).filter(CampaignContact.campaign_id == campaign_id).all()
        enrolled_lead_ids = [c.contact_id for c in contacts]
        enrolled_org_ids = list(set([c.organization_id for c in contacts]))

        leads_enrolled = len(contacts)
        emails_sent = len([c for c in contacts if c.last_action_at is not None or c.status in [CampaignContactStatus.SENT.value, CampaignContactStatus.REPLIED.value, CampaignContactStatus.PENDING.value]])
        emails_opened = len([c for c in contacts if (c.open_count or 0) > 0 or c.opened_at is not None])
        replies_received = len([c for c in contacts if c.status == CampaignContactStatus.REPLIED.value or c.replied_at is not None])

        # Meetings scheduled for these contacts or orgs
        meetings = db.query(Meeting).filter(
            Meeting.is_deleted == False,
            (Meeting.primary_contact_id.in_(enrolled_lead_ids) if enrolled_lead_ids else False) | 
            (Meeting.organization_id.in_(enrolled_org_ids) if enrolled_org_ids else False)
        ).all()
        meetings_scheduled = len(meetings)

        # Opportunities
        opps = db.query(Opportunity).filter(
            Opportunity.is_deleted == False,
            Opportunity.organization_id.in_(enrolled_org_ids) if enrolled_org_ids else False
        ).all()
        opportunities_created = len(opps)
        total_pipeline_value = sum([op.estimated_value or 0.0 for op in opps])

        # Proposals
        props = db.query(Proposal).filter(
            Proposal.is_deleted == False,
            Proposal.organization_id.in_(enrolled_org_ids) if enrolled_org_ids else False
        ).all()
        proposals_sent = len(props)

        # Negotiations
        negs = db.query(Negotiation).filter(
            Negotiation.is_deleted == False,
            Negotiation.organization_id.in_(enrolled_org_ids) if enrolled_org_ids else False
        ).all()
        negotiations_active = len(negs)

        # Won Deals (Partnerships or Customers)
        won_opps = [op for op in opps if op.stage in [OpportunityStage.PARTNERSHIP.value, OpportunityStage.CUSTOMER.value]]
        custs = db.query(Customer).filter(
            Customer.is_deleted == False,
            Customer.organization_id.in_(enrolled_org_ids) if enrolled_org_ids else False
        ).all()
        deals_won = len(won_opps) + len(custs)
        total_revenue_won = sum([c.contract_value or 0.0 for c in custs]) + sum([op.estimated_value or 0.0 for op in won_opps])

        # Conversion Percentages
        sent_to_open_pct = round((emails_opened / emails_sent * 100.0), 1) if emails_sent > 0 else 0.0
        open_to_reply_pct = round((replies_received / emails_opened * 100.0), 1) if emails_opened > 0 else (round((replies_received / emails_sent * 100.0), 1) if emails_sent > 0 else 0.0)
        reply_to_meeting_pct = round((meetings_scheduled / replies_received * 100.0), 1) if replies_received > 0 else 0.0
        meeting_to_opp_pct = round((opportunities_created / meetings_scheduled * 100.0), 1) if meetings_scheduled > 0 else 0.0
        opp_to_deal_pct = round((deals_won / opportunities_created * 100.0), 1) if opportunities_created > 0 else 0.0
        overall_lead_to_deal_pct = round((deals_won / leads_enrolled * 100.0), 1) if leads_enrolled > 0 else 0.0

        return {
            "campaign_id": campaign.id,
            "campaign_name": campaign.name,
            "target_industry": campaign.target_industry,
            "leads_enrolled": leads_enrolled,
            "emails_sent": emails_sent,
            "emails_opened": emails_opened,
            "replies_received": replies_received,
            "meetings_scheduled": meetings_scheduled,
            "opportunities_created": opportunities_created,
            "proposals_sent": proposals_sent,
            "negotiations_active": negotiations_active,
            "deals_won": deals_won,
            "total_pipeline_value": total_pipeline_value,
            "total_revenue_won": total_revenue_won,
            "sent_to_open_pct": sent_to_open_pct,
            "open_to_reply_pct": open_to_reply_pct,
            "reply_to_meeting_pct": reply_to_meeting_pct,
            "meeting_to_opp_pct": meeting_to_opp_pct,
            "opp_to_deal_pct": opp_to_deal_pct,
            "overall_lead_to_deal_pct": overall_lead_to_deal_pct,
        }
