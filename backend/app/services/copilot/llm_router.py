"""
Multi-LLM Router with automatic fallback, retry with backoff, and shared context.

Provider chain:
  1. Groq (GPT-OSS 120B) -- primary fast copilot
  2. NVIDIA (Nemotron 3 Super 120B A12B) -- agent/tool-calling fallback
  3. Google (Gemini 3.7 Flash) -- complex/multimodal fallback

Retry policy per provider:
  - Up to 3 retries with exponential backoff (1s, 2s, 4s)
  - Retries on transient failures: 429, 500, 502, 503, 504, timeout/network
  - Does NOT retry: 401, 402, 400, other non-transient errors

When all retries for a provider are exhausted, falls back to next provider
with the EXACT same conversation context. No data lost.
"""
from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# -- Retry configuration --
MAX_RETRIES_PER_PROVIDER = 3
BASE_DELAY_SECONDS = 1.0
BACKOFF_MULTIPLIER = 2.0

# Transient HTTP status codes that warrant retry
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

# -- Provider definitions --

PROVIDERS = [
    {
        "name": "groq",
        "base_url": "https://api.groq.com/openai/v1",
        "model": "openai/gpt-oss-120b",
        "priority": 1,
        "role": "primary fast copilot",
    },
    {
        "name": "nvidia",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "model": "nvidia/llama-3.3-nemotron-super-49b-v1",
        "priority": 2,
        "role": "agent/tool-calling fallback",
    },
    {
        "name": "gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-2.5-flash",
        "priority": 3,
        "role": "complex/multimodal fallback",
    },
]


# -- Data classes --

@dataclass
class LLMToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class LLMResponse:
    content: Optional[str] = None
    tool_calls: list[LLMToolCall] = field(default_factory=list)
    provider: str = ""
    model: str = ""
    usage: dict[str, int] = field(default_factory=dict)
    finish_reason: str = ""


@dataclass
class LLMUsage:
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0


# -- Exceptions --

class LLMProviderError(Exception):
    def __init__(self, provider: str, status: int, detail: str):
        self.provider = provider
        self.status = status
        self.detail = detail
        super().__init__(f"{provider}: HTTP {status} -- {detail}")


class AllProvidersExhausted(Exception):
    def __init__(self, errors: list[LLMProviderError]):
        self.errors = errors
        summary = "; ".join(f"{e.provider}({e.status})" for e in errors)
        super().__init__(f"All LLM providers failed: {summary}")


# -- Router --

class LLMRouter:
    """
    Multi-LLM router with automatic fallback.

    Usage:
        router = LLMRouter(api_keys={"groq": "gsk_...", "nvidia": "nvapi-...", "gemini": "AIza..."})
        response = router.chat(messages=[...], tools=[...])
    """

    def __init__(self, api_keys: dict[str, str] | None = None, providers: list[dict] | None = None):
        self._providers = providers or PROVIDERS
        self._api_keys = api_keys or {}
        self._client = httpx.Client(timeout=60.0)
        self._usage_log: list[LLMUsage] = []

    def _get_api_key(self, provider_name: str) -> str:
        if provider_name in self._api_keys and self._api_keys[provider_name]:
            return self._api_keys[provider_name]
        env_map = {
            "groq": "GROQ_API_KEY",
            "nvidia": "NVIDIA_NIM_API_KEY",
            "gemini": "GEMINI_API_KEY",
        }
        env_name = env_map.get(provider_name, f"{provider_name.upper()}_API_KEY")
        return os.environ.get(env_name, "")

    def _call_provider(
        self,
        provider: dict,
        messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        api_key = self._get_api_key(provider["name"])
        if not api_key:
            raise LLMProviderError(provider["name"], 0, "No API key configured")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        payload: dict[str, Any] = {
            "model": provider["model"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        start = time.monotonic()
        try:
            resp = self._client.post(
                f"{provider['base_url']}/chat/completions",
                headers=headers,
                json=payload,
            )
        except httpx.TimeoutException:
            raise LLMProviderError(provider["name"], 408, "Request timed out")
        except httpx.RequestError as e:
            raise LLMProviderError(provider["name"], 0, f"Network error: {e}")

        latency_ms = (time.monotonic() - start) * 1000

        if resp.status_code == 429:
            raise LLMProviderError(provider["name"], 429, "Rate limited")
        if resp.status_code == 401:
            raise LLMProviderError(provider["name"], 401, "Invalid API key")
        if resp.status_code == 402:
            raise LLMProviderError(provider["name"], 402, "Out of credits")
        if resp.status_code >= 400:
            detail = resp.text[:500]
            raise LLMProviderError(provider["name"], resp.status_code, detail)

        data = resp.json()
        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})
        usage = data.get("usage", {})

        self._usage_log.append(LLMUsage(
            provider=provider["name"],
            model=provider["model"],
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            latency_ms=latency_ms,
        ))

        tool_calls = []
        for tc in message.get("tool_calls", []):
            func = tc.get("function", {})
            args_str = func.get("arguments", "{}")
            try:
                args = json.loads(args_str) if isinstance(args_str, str) else args_str
            except json.JSONDecodeError:
                args = {}
            tool_calls.append(LLMToolCall(
                id=tc.get("id", ""),
                name=func.get("name", ""),
                arguments=args,
            ))

        return LLMResponse(
            content=message.get("content"),
            tool_calls=tool_calls,
            provider=provider["name"],
            model=provider["model"],
            usage={
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            },
            finish_reason=choice.get("finish_reason", ""),
        )

    def _is_retryable(self, error: LLMProviderError) -> bool:
        """Check if an error is transient and worth retrying."""
        return error.status in RETRYABLE_STATUS_CODES

    def chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        """
        Try providers in priority order with per-provider retry + backoff.
        Full context preserved across fallbacks -- same messages, same tools.
        """
        sorted_providers = sorted(self._providers, key=lambda p: p["priority"])
        errors: list[LLMProviderError] = []

        for provider in sorted_providers:
            last_error = None
            for attempt in range(MAX_RETRIES_PER_PROVIDER):
                try:
                    response = self._call_provider(
                        provider, messages, tools, temperature, max_tokens
                    )
                    if errors or attempt > 0:
                        logger.info(
                            "LLM %s succeeded on attempt %d (after %s retries)",
                            provider["name"], attempt + 1, attempt,
                        )
                    return response
                except LLMProviderError as e:
                    last_error = e
                    if not self._is_retryable(e):
                        # Non-transient error: skip retries, move to next provider
                        logger.warning(
                            "LLM %s non-retryable error (HTTP %d), skipping to next provider",
                            provider["name"], e.status,
                        )
                        break
                    # Transient error: retry with backoff
                    delay = BASE_DELAY_SECONDS * (BACKOFF_MULTIPLIER ** attempt)
                    logger.warning(
                        "LLM %s attempt %d/%d failed (HTTP %d), retrying in %.1fs",
                        provider["name"], attempt + 1, MAX_RETRIES_PER_PROVIDER,
                        e.status, delay,
                    )
                    time.sleep(delay)
                    last_error = e

            # All retries exhausted for this provider
            if last_error:
                errors.append(last_error)
                logger.warning(
                    "LLM %s exhausted %d retries, moving to next provider",
                    provider["name"], MAX_RETRIES_PER_PROVIDER,
                )

        raise AllProvidersExhausted(errors)

    def chat_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        tool_executor: callable,
        max_rounds: int = 5,
        temperature: float = 0.3,
    ) -> LLMResponse:
        """
        Multi-round tool-calling loop.
        LLM requests tools -> we execute -> LLM sees results -> repeat.
        Stops when LLM returns content (no more tool calls) or max rounds hit.
        """
        current_messages = list(messages)

        for round_num in range(max_rounds):
            response = self.chat(current_messages, tools, temperature)

            if not response.tool_calls:
                return response

            for tc in response.tool_calls:
                try:
                    result = tool_executor(tc.name, tc.arguments)
                    result_str = json.dumps(result, default=str)
                except Exception as e:
                    result_str = json.dumps({"error": str(e)})

                current_messages.append({
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [{
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.name, "arguments": json.dumps(tc.arguments)},
                    }],
                })
                current_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result_str,
                })

        return response

    @property
    def usage_log(self) -> list[LLMUsage]:
        return list(self._usage_log)

    @property
    def total_tokens_used(self) -> int:
        return sum(u.total_tokens for u in self._usage_log)
