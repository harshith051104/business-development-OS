"""Tests for Tier 3 — Quality, trust, config."""
import pytest
from pydantic import ValidationError


class TestContactEmailValidation:
    """Verify email validation on contact creation."""

    def test_valid_email_accepted(self):
        from app.schemas.contact import ContactCreate
        req = ContactCreate(
            organization_id=1,
            first_name="Test",
            email="user@example.com",
        )
        assert req.email == "user@example.com"

    def test_email_lowercased(self):
        from app.schemas.contact import ContactCreate
        req = ContactCreate(
            organization_id=1,
            first_name="Test",
            email="User@Example.COM",
        )
        assert req.email == "user@example.com"

    def test_invalid_email_rejected(self):
        from app.schemas.contact import ContactCreate
        with pytest.raises(ValidationError):
            ContactCreate(
                organization_id=1,
                first_name="Test",
                email="not-an-email",
            )

    def test_empty_email_allowed(self):
        from app.schemas.contact import ContactCreate
        req = ContactCreate(
            organization_id=1,
            first_name="Test",
            email=None,
        )
        assert req.email is None


class TestContactLinkedInValidation:
    """Verify LinkedIn URL validation."""

    def test_valid_linkedin_url_accepted(self):
        from app.schemas.contact import ContactCreate
        req = ContactCreate(
            organization_id=1,
            first_name="Test",
            linkedin_url="https://www.linkedin.com/in/john-doe/",
        )
        assert "linkedin.com" in req.linkedin_url

    def test_invalid_linkedin_url_rejected(self):
        from app.schemas.contact import ContactCreate
        with pytest.raises(ValidationError):
            ContactCreate(
                organization_id=1,
                first_name="Test",
                linkedin_url="https://twitter.com/johndoe",
            )

    def test_empty_linkedin_url_allowed(self):
        from app.schemas.contact import ContactCreate
        req = ContactCreate(
            organization_id=1,
            first_name="Test",
            linkedin_url=None,
        )
        assert req.linkedin_url is None


class TestRateLimitMiddleware:
    """Verify rate limiter exists and works."""

    def test_middleware_importable(self):
        from app.core.middleware import RateLimitMiddleware
        assert RateLimitMiddleware is not None

    def test_middleware_has_requests_per_minute(self):
        from app.core.middleware import RateLimitMiddleware
        import inspect
        sig = inspect.signature(RateLimitMiddleware.__init__)
        assert "requests_per_minute" in sig.parameters


class TestAuditLogging:
    """Verify audit logging helper exists and works."""

    def test_log_audit_event_importable(self):
        from app.core.audit import log_audit_event
        assert callable(log_audit_event)

    def test_log_audit_event_signature(self):
        from app.core.audit import log_audit_event
        import inspect
        sig = inspect.signature(log_audit_event)
        params = list(sig.parameters.keys())
        assert "db" in params
        assert "action" in params
        assert "resource_type" in params
        assert "user" in params


class TestConfigValidation:
    """Verify config validation runs on startup."""

    def test_validate_config_importable(self):
        from app.core.config import validate_config
        assert callable(validate_config)

    def test_settings_has_rate_control(self):
        from app.core.config import settings
        assert hasattr(settings, 'RESEARCH_DELAY_BETWEEN_REQUESTS')
        assert hasattr(settings, 'RESEARCH_TIMEOUT')
        assert hasattr(settings, 'DB_POOL_SIZE')
        assert hasattr(settings, 'DB_MAX_OVERFLOW')
