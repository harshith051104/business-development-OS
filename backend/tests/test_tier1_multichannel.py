"""Tests for Tier 1 — Multi-channel outreach."""
import pytest
from datetime import datetime, timezone


class TestMultiChannelCommunication:
    """Verify communication model supports all channels."""

    def test_communication_model_has_all_channels(self):
        from app.models.communication import CommunicationChannel
        channels = [c.value for c in CommunicationChannel]
        assert "Email" in channels
        assert "Phone" in channels
        assert "WhatsApp" in channels
        assert "LinkedIn" in channels

    def test_communication_has_source_field(self):
        from app.models.communication import Communication
        assert hasattr(Communication, 'source')

    def test_communication_has_phone_fields(self):
        from app.models.communication import Communication
        assert hasattr(Communication, 'duration_minutes')
        assert hasattr(Communication, 'call_outcome')

    def test_communication_has_external_message_id(self):
        from app.models.communication import Communication
        assert hasattr(Communication, 'external_message_id')

    def test_communication_has_owner_id(self):
        from app.models.communication import Communication
        assert hasattr(Communication, 'owner_id')


class TestContactChannelPreferences:
    """Verify contact has channel preference fields."""

    def test_contact_has_preferred_channel(self):
        from app.models.contact import Contact
        assert hasattr(Contact, 'preferred_channel')

    def test_contact_has_do_not_contact(self):
        from app.models.contact import Contact
        assert hasattr(Contact, 'do_not_contact')


class TestCampaignSequenceStepMultiChannel:
    """Verify campaign sequence steps support multi-channel."""

    def test_sequence_step_has_channel(self):
        from app.models.campaign import CampaignSequenceStep
        assert hasattr(CampaignSequenceStep, 'channel')

    def test_campaign_contact_has_approval_fields(self):
        from app.models.campaign import CampaignContact, CampaignContactStatus
        assert hasattr(CampaignContact, 'approved_by')
        assert hasattr(CampaignContact, 'approved_at')
        assert hasattr(CampaignContact, 'rejected_by')
        assert hasattr(CampaignContact, 'rejected_at')
        assert hasattr(CampaignContact, 'rejection_reason')
        # New statuses
        statuses = [s.value for s in CampaignContactStatus]
        assert "Draft" in statuses
        assert "Approved" in statuses
        assert "Rejected" in statuses


class TestQuickLogSchemas:
    """Verify Pydantic schemas for quick-log endpoints."""

    def test_phone_call_log_schema(self):
        from app.routers.communications import PhoneCallLogRequest
        req = PhoneCallLogRequest(
            organization_id=1,
            contact_id=1,
            direction="Outgoing",
            subject="Follow-up call",
            content="Discussed pricing",
            duration_minutes=15,
            call_outcome="connected",
        )
        assert req.organization_id == 1
        assert req.duration_minutes == 15
        assert req.call_outcome == "connected"

    def test_whatsapp_log_schema(self):
        from app.routers.communications import WhatsAppLogRequest
        req = WhatsAppLogRequest(
            organization_id=1,
            contact_id=1,
            direction="Incoming",
            content="Yes, let's schedule",
            external_message_id="wa_msg_123",
        )
        assert req.direction == "Incoming"
        assert req.external_message_id == "wa_msg_123"

    def test_linkedin_log_schema(self):
        from app.routers.communications import LinkedInLogRequest
        req = LinkedInLogRequest(
            organization_id=1,
            contact_id=1,
            direction="Outgoing",
            content="Connection request sent",
        )
        assert req.direction == "Outgoing"


class TestCommunicationSchemaNewFields:
    """Verify CommunicationCreate schema has new fields."""

    def test_create_schema_has_source(self):
        from app.schemas.communication import CommunicationCreate
        req = CommunicationCreate(
            organization_id=1,
            subject="Test",
            channel="Phone",
            source="manual",
            duration_minutes=10,
            call_outcome="voicemail",
        )
        assert req.source == "manual"
        assert req.duration_minutes == 10
        assert req.call_outcome == "voicemail"

    def test_out_schema_has_owner_id(self):
        from app.schemas.communication import CommunicationOut
        schema = CommunicationOut.model_fields
        assert "owner_id" in schema
        assert "source" in schema
        assert "duration_minutes" in schema
        assert "call_outcome" in schema
        assert "external_message_id" in schema
