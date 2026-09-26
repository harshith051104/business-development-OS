"""
Provider health tracking for external services.

Tracks: OpenOutreach, Tavily, Serper, ScrapeGraphAI, BetterContact, LLM providers.
Exposes health to admin diagnostics. Never exposes API keys.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class ProviderStatus:
    name: str
    status: str = "UNKNOWN"  # AVAILABLE, UNAVAILABLE, UNKNOWN
    last_checked: float = 0.0
    last_error: Optional[str] = None
    latency_ms: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "status": self.status,
            "last_checked": self.last_checked,
            "last_error": self.last_error,
            "latency_ms": self.latency_ms,
        }


class ProviderHealthTracker:
    """Singleton tracker for all external provider health."""

    _instance: Optional["ProviderHealthTracker"] = None

    def __init__(self):
        self._providers: Dict[str, ProviderStatus] = {}
        self._init_providers()

    @classmethod
    def get_instance(cls) -> "ProviderHealthTracker":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _init_providers(self):
        for name in ["OpenOutreach", "Tavily", "Serper", "ScrapeGraphAI", "BetterContact", "LLM", "PublicWeb"]:
            self._providers[name] = ProviderStatus(name=name)

    def record_success(self, provider: str, latency_ms: float = 0.0):
        if provider not in self._providers:
            self._providers[provider] = ProviderStatus(name=provider)
        self._providers[provider].status = "AVAILABLE"
        self._providers[provider].last_checked = time.time()
        self._providers[provider].last_error = None
        self._providers[provider].latency_ms = latency_ms

    def record_failure(self, provider: str, error: str):
        if provider not in self._providers:
            self._providers[provider] = ProviderStatus(name=provider)
        self._providers[provider].status = "UNAVAILABLE"
        self._providers[provider].last_checked = time.time()
        self._providers[provider].last_error = error

    def get_status(self, provider: str) -> Dict[str, Any]:
        if provider not in self._providers:
            return {"name": provider, "status": "UNKNOWN"}
        return self._providers[provider].to_dict()

    def get_all_status(self) -> Dict[str, Any]:
        """Return health for all providers. No API keys exposed."""
        from app.core.config import settings
        result = {}

        # Check which providers have keys configured
        configured = {
            "Tavily": bool(settings.TAVILY_API_KEY),
            "Serper": bool(settings.SERPER_API_KEY),
            "BetterContact": bool(settings.BETTERCONTACT_API_KEY),
            "LLM": bool(settings.GROQ_API_KEY or settings.NVIDIA_NIM_API_KEY or settings.GEMINI_API_KEY),
            "OpenOutreach": bool(getattr(settings, "OPENOUTREACH_ENABLED", True)),
            "ScrapeGraphAI": bool(settings.SCRAPEGRAPH_ENABLED),
            "PublicWeb": bool(settings.TAVILY_API_KEY or settings.SERPER_API_KEY),
        }

        for name, status in self._providers.items():
            info = status.to_dict()
            is_configured = configured.get(name, False)
            info["configured"] = is_configured

            # BetterContact has explicit DISABLED state
            if name == "BetterContact":
                if not settings.BETTERCONTACT_ENABLED:
                    info["status"] = "DISABLED"
                elif status.status == "UNKNOWN" and is_configured:
                    info["status"] = "CONFIGURED"
                elif status.status == "UNKNOWN" and not is_configured:
                    info["status"] = "NOT_CONFIGURED"
            elif status.status == "UNKNOWN" and is_configured:
                info["status"] = "CONFIGURED"
            elif status.status == "UNKNOWN" and not is_configured:
                info["status"] = "NOT_CONFIGURED"

            result[name] = info

        return result
