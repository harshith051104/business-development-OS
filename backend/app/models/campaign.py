from datetime import datetime, timezone
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.token_encryption import encrypt_token, decrypt_token


class CampaignStatus(str, enum.Enum):
    DRAFT = "Draft"
    ACTIVE = "Active"
    PAUSED = "Paused"
    COMPLETED = "Completed"


class CampaignContactStatus(str, enum.Enum):
    DRAFT = "Draft"
    PENDING = "Pending"
    READY_FOR_REVIEW = "Ready_For_Review"
    APPROVED = "Approved"
    SENT = "Sent"
    REPLIED = "Replied"
    PAUSED = "Paused"
    COMPLETED = "Completed"
    BOUNCED = "Bounced"
    REJECTED = "Rejected"


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), default=CampaignStatus.DRAFT.value, nullable=False, index=True)
    category = Column(String(50), default="client", nullable=False, index=True)  # "client" | "funding"
    sender_email = Column(String(255), nullable=True)
    gmail_account_id = Column(String(100), nullable=True)
    target_industry = Column(String(100), nullable=True)
    whatsapp_message_template = Column(Text, nullable=True)  # merge fields: {{first_name}} {{last_name}} {{company}} {{sender_name}}
    linkedin_connection_note_template = Column(Text, nullable=True)  # sent with the connect request, same merge fields
    linkedin_first_message_template = Column(Text, nullable=True)  # sent once connected, same merge fields

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    owner = relationship("User", foreign_keys=[owner_id])
    sequence_steps = relationship("CampaignSequenceStep", back_populates="campaign", cascade="all, delete-orphan", order_by="CampaignSequenceStep.step_number")
    campaign_contacts = relationship("CampaignContact", back_populates="campaign", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Campaign id={self.id} name='{self.name}' status='{self.status}'>"


class CampaignSequenceStep(Base):
    __tablename__ = "campaign_sequence_steps"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)  # 1, 2, 3, 4...
    delay_days = Column(Integer, default=0, nullable=False)  # 0 for initial, 3, 7, 14 for follow-ups
    channel = Column(String(50), default="Email", nullable=False)
    subject_template = Column(String(255), nullable=True)
    body_template = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship
    campaign = relationship("Campaign", back_populates="sequence_steps")

    def __repr__(self):
        return f"<CampaignSequenceStep id={self.id} campaign_id={self.campaign_id} step={self.step_number} delay={self.delay_days}d>"


class CampaignContact(Base):
    __tablename__ = "campaign_contacts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    current_step_number = Column(Integer, default=1, nullable=False)
    status = Column(String(50), default=CampaignContactStatus.PENDING.value, nullable=False, index=True)
    
    personalization_score = Column(Float, default=0.0, nullable=False)
    subject_preview = Column(String(255), nullable=True)
    body_preview = Column(Text, nullable=True)
    ai_cache = Column(JSON, nullable=True)  # Cached AI snippets (value prop, hook, cta)
    
    last_action_at = Column(DateTime, nullable=True)
    next_action_due = Column(DateTime, nullable=True)
    last_message_id = Column(String(255), nullable=True)
    thread_id = Column(String(255), nullable=True)
    
    # Tracking metrics
    opened_at = Column(DateTime, nullable=True)
    open_count = Column(Integer, default=0, nullable=False)
    clicked_at = Column(DateTime, nullable=True)
    click_count = Column(Integer, default=0, nullable=False)
    replied_at = Column(DateTime, nullable=True)

    # Lead tracker milestone checkboxes (manual, outside the automated send/open/click/reply above)
    linkedin_followed = Column(Boolean, default=False, nullable=False)
    linkedin_connection_sent = Column(Boolean, default=False, nullable=False)
    linkedin_connection_accepted = Column(Boolean, default=False, nullable=False)
    linkedin_first_message_sent = Column(Boolean, default=False, nullable=False)
    linkedin_reply_received = Column(Boolean, default=False, nullable=False)
    followup_1_sent = Column(Boolean, default=False, nullable=False)
    followup_2_sent = Column(Boolean, default=False, nullable=False)
    followup_3_sent = Column(Boolean, default=False, nullable=False)
    meeting_scheduled = Column(Boolean, default=False, nullable=False)
    opportunity_closed = Column(Boolean, default=False, nullable=False)
    whatsapp_message_sent = Column(Boolean, default=False, nullable=False)
    assigned_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # WhatsApp send-automation bookkeeping (not a tracker checkbox — internal state for the queue)
    whatsapp_sent_at = Column(DateTime, nullable=True)
    whatsapp_invalid_number = Column(Boolean, default=False, nullable=False)
    whatsapp_failed_attempts = Column(Integer, default=0, nullable=False)
    whatsapp_last_attempt_at = Column(DateTime, nullable=True)

    # LinkedIn send-automation bookkeeping (the milestone checkboxes themselves already existed above)
    linkedin_failed_attempts = Column(Integer, default=0, nullable=False)
    linkedin_last_attempt_at = Column(DateTime, nullable=True)
    linkedin_unavailable = Column(Boolean, default=False, nullable=False)  # no Connect/Message action possible on this profile
    focus = Column(String(255), nullable=True)
    tracker_notes = Column(Text, nullable=True)
    next_followup_at = Column(DateTime, nullable=True)

    # Approval tracking
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    campaign = relationship("Campaign", back_populates="campaign_contacts")
    contact = relationship("Contact", foreign_keys=[contact_id])
    organization = relationship("Organization", foreign_keys=[organization_id])
    approver = relationship("User", foreign_keys=[approved_by])
    rejector = relationship("User", foreign_keys=[rejected_by])
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])

    def __repr__(self):
        return f"<CampaignContact id={self.id} campaign_id={self.campaign_id} contact_id={self.contact_id} status='{self.status}'>"


# Lead tracker milestone checkbox field names -> human label
LEAD_TRACKER_CHECKBOX_LABELS: dict = {
    "linkedin_followed": "Followed on LinkedIn",
    "linkedin_connection_sent": "Connection Sent",
    "linkedin_connection_accepted": "Connection Accepted",
    "linkedin_first_message_sent": "First Message Sent",
    "linkedin_reply_received": "LinkedIn Reply",
    "followup_1_sent": "Follow-up #1",
    "followup_2_sent": "Follow-up #2",
    "followup_3_sent": "Follow-up #3",
    "meeting_scheduled": "Meeting Scheduled",
    "opportunity_closed": "Opportunity Closed",
    "whatsapp_message_sent": "WhatsApp Message Sent",
}

LEAD_TRACKER_CHECKBOX_FIELDS = list(LEAD_TRACKER_CHECKBOX_LABELS.keys())


class CampaignContactTimeline(Base):
    __tablename__ = "campaign_contact_timeline"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    campaign_contact_id = Column(Integer, ForeignKey("campaign_contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(50), nullable=False)
    description = Column(String(500), nullable=False, default="")
    event_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    campaign_contact = relationship("CampaignContact", foreign_keys=[campaign_contact_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<CampaignContactTimeline id={self.id} campaign_contact_id={self.campaign_contact_id} event='{self.event_type}'>"


class GmailAccount(Base):
    __tablename__ = "gmail_accounts"

    id = Column(String(100), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=True)
    access_token_encrypted = Column("access_token", Text, nullable=False)
    refresh_token_encrypted = Column("refresh_token", Text, nullable=True)
    token_uri = Column(String(255), default="https://oauth2.googleapis.com/token", nullable=False)
    client_id = Column(String(255), nullable=True)
    client_secret = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationship
    user = relationship("User", foreign_keys=[user_id])

    @property
    def access_token(self):
        return decrypt_token(self.access_token_encrypted)

    @access_token.setter
    def access_token(self, value):
        self.access_token_encrypted = encrypt_token(value)

    @property
    def refresh_token(self):
        return decrypt_token(self.refresh_token_encrypted)

    @refresh_token.setter
    def refresh_token(self, value):
        self.refresh_token_encrypted = encrypt_token(value)

    def __repr__(self):
        return f"<GmailAccount id='{self.id}' email='{self.email}' active={self.is_active}>"
