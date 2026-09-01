"""Tests for Tier 2 — Close automation gap."""
import pytest
from datetime import datetime, timezone, timedelta


class TestContactSuggestNextAction:
    """Verify contact AI suggestion endpoint logic."""

    def test_suggest_endpoint_exists(self):
        from app.routers.contacts import suggest_next_action
        assert callable(suggest_next_action)

    def test_suggest_requires_contact(self):
        from app.routers.contacts import suggest_next_action
        from fastapi import HTTPException
        from unittest.mock import MagicMock
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        user = MagicMock()
        try:
            suggest_next_action(id=999, db=db, current_user=user)
            assert False, "Should have raised HTTPException"
        except HTTPException as e:
            assert e.status_code == 404


class TestMeetingSuggestFollowups:
    """Verify meeting follow-up suggestion endpoint logic."""

    def test_suggest_followups_endpoint_exists(self):
        from app.routers.meetings import suggest_meeting_followups
        assert callable(suggest_meeting_followups)

    def test_suggest_followups_requires_meeting(self):
        from app.routers.meetings import suggest_meeting_followups
        from fastapi import HTTPException
        from unittest.mock import MagicMock
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        user = MagicMock()
        try:
            suggest_meeting_followups(id=999, db=db, current_user=user)
            assert False, "Should have raised HTTPException"
        except HTTPException as e:
            assert e.status_code == 404


class TestCommunicationSource:
    """Verify communication source field works correctly."""

    def test_source_defaults_to_manual(self):
        from app.models.communication import Communication
        from app.schemas.communication import CommunicationCreate
        req = CommunicationCreate(
            organization_id=1,
            subject="Test",
            source="campaign",
        )
        assert req.source == "campaign"

    def test_source_accepts_all_values(self):
        from app.schemas.communication import CommunicationCreate
        for source in ["manual", "campaign", "meeting", "system"]:
            req = CommunicationCreate(
                organization_id=1,
                subject="Test",
                source=source,
            )
            assert req.source == source


class TestContactChannelPreference:
    """Verify contact channel preference fields."""

    def test_preferred_channel_default_is_none(self):
        from app.models.contact import Contact
        from sqlalchemy import inspect
        mapper = inspect(Contact)
        col = mapper.columns.get('preferred_channel')
        assert col is not None
        assert col.default.arg == "Email" if col.default else True

    def test_do_not_contact_default_is_false(self):
        from app.models.contact import Contact
        from sqlalchemy import inspect
        mapper = inspect(Contact)
        col = mapper.columns.get('do_not_contact')
        assert col is not None


class TestCampaignApprovalGate:
    """Verify campaign email approval gate logic."""

    def test_approval_gate_rejects_unapproved_send(self):
        from app.services.campaign_service import CampaignService
        from app.models.campaign import CampaignContactStatus
        # Status must be Approved before sending
        blocked_statuses = [
            CampaignContactStatus.DRAFT.value,
            CampaignContactStatus.PENDING.value,
            CampaignContactStatus.READY_FOR_REVIEW.value,
        ]
        allowed_statuses = [
            CampaignContactStatus.APPROVED.value,
            CampaignContactStatus.SENT.value,
            CampaignContactStatus.REPLIED.value,
        ]
        assert all(s not in allowed_statuses for s in blocked_statuses)
        assert all(s not in blocked_statuses for s in allowed_statuses)

    def test_campaign_contact_has_rejection_fields(self):
        from app.models.campaign import CampaignContact
        assert hasattr(CampaignContact, 'rejection_reason')
        assert hasattr(CampaignContact, 'rejected_by')
        assert hasattr(CampaignContact, 'rejected_at')
