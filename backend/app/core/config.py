import os
import secrets
import sys
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List


def _get_jwt_secret(debug: bool) -> str:
    """Return JWT_SECRET_KEY from env. Auto-generates only in DEBUG mode — in
    production leaves it empty so validate_config() catches it and refuses to boot,
    rather than silently satisfying the length check with a throwaway secret."""
    env_val = os.environ.get("JWT_SECRET_KEY", "")
    if env_val:
        return env_val
    if not debug:
        return ""
    secret = secrets.token_hex(32)
    print(
        "\n[SECURITY] JWT_SECRET_KEY not set in .env — auto-generated for this dev session.\n"
        "           Tokens will be INVALID after restart. Set JWT_SECRET_KEY in .env for production.\n",
        file=sys.stderr,
    )
    return secret


class Settings(BaseSettings):
    APP_NAME: str = "ELLY Business Development Portal"
    APP_VERSION: str = "1.0.0"
    # Secure by default — local dev sets DEBUG=true explicitly in .env.
    DEBUG: bool = False
    DATABASE_URL: str = "sqlite:///./bd_portal.db"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    
    # JWT Security Settings — MUST set JWT_SECRET_KEY in .env for production
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Token Encryption — Fernet key for encrypting OAuth tokens at rest
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    TOKEN_ENCRYPTION_KEY: str = ""

    # Rate Limiting
    GMAIL_RATE_LIMIT_PER_HOUR: int = 20  # Max emails per hour via Gmail API
    GMAIL_RATE_LIMIT_PER_DAY: int = 100  # Max emails per day via Gmail API

    # CORS
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"])

    # LLM Provider Settings
    GROQ_API_KEY: str = ""
    NVIDIA_NIM_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    LLM_PRIMARY_PROVIDER: str = "groq"
    LLM_MAX_AGENT_ITERATIONS: int = 10
    LLM_TIMEOUT_SECONDS: int = 30
    LLM_FALLBACK_ENABLED: bool = True

    # External Lead Discovery API Keys
    TAVILY_API_KEY: str = ""
    SERPER_API_KEY: str = ""

    # Google Sheets Auto-Save
    GOOGLE_SHEETS_CREDENTIALS_FILE: str = ""
    GOOGLE_SHEETS_SPREADSHEET_ID: str = ""

    # Scrapegraph Deep Scraping
    SCRAPEGRAPH_ENABLED: bool = True
    RESEARCH_CACHE_TTL_HOURS: int = 24

    # Research Pipeline
    RESEARCH_MAX_CONCURRENCY: int = 5
    RESEARCH_VERSION: str = "phase20-v1"
    RESEARCH_DELAY_BETWEEN_REQUESTS: float = 1.5  # seconds between ScrapeGraphAI calls
    RESEARCH_TIMEOUT: int = 60  # seconds per ScrapeGraphAI request

    # External Enrichment
    OPENOUTREACH_ENABLED: bool = True
    BETTERCONTACT_API_KEY: str = ""
    BETTERCONTACT_ENABLED: bool = False

    # Google Maps API
    GOOGLE_MAPS_API_KEY: str = ""

    # Local Google Maps scraper (gosom/google-maps-scraper, see deployment/google-maps-scraper)
    GMAPS_SCRAPER_ENABLED: bool = True
    GMAPS_SCRAPER_URL: str = "http://localhost:8095"
    GMAPS_SCRAPER_DEPTH: int = 5  # keep low; high depth risks temporary Google IP blocks
    GMAPS_SCRAPER_MAX_TIME_SECONDS: int = 90
    GMAPS_SCRAPER_EXTRACT_EMAILS: bool = False  # scraper-side email crawl overruns max_time by minutes; the executive finder scrapes site emails instead
    GMAPS_SCRAPER_PROXIES: List[str] = Field(default=[])  # socks5://user:pass@host:port, http://...

    # Google Calendar API
    GOOGLE_CALENDAR_CREDENTIALS_FILE: str = ""  # OAuth2 credentials JSON
    GOOGLE_CALENDAR_ID: str = "primary"

    # Gmail API
    GMAIL_CREDENTIALS_FILE: str = ""  # OAuth2 credentials JSON (same Google Cloud project)
    GMAIL_SENDER_EMAIL: str = ""  # Default sender email address (fallback only)

    # Public base URL this backend is reachable at (e.g. an ngrok tunnel URL in dev,
    # or the real domain in prod). Required for open-pixel/click-tracking links embedded
    # in outbound campaign emails to resolve — if unset, tracking injection is skipped
    # rather than emailing a broken localhost link.
    PUBLIC_BASE_URL: str = ""

    # Inbound webhook HMAC signing secret (shared across sources at this scale).
    # Required in production -- set WEBHOOK_INBOUND_SECRET in .env.
    WEBHOOK_INBOUND_SECRET: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
# Apply JWT secret fallback after init (env not available at class-level default)
if not settings.JWT_SECRET_KEY:
    settings.JWT_SECRET_KEY = _get_jwt_secret(settings.DEBUG)


def validate_config():
    """Validate critical config on startup. In production (DEBUG=false), refuses to
    start rather than merely warning — a silently-insecure prod deploy is worse than
    a deploy that won't boot until fixed."""
    warnings = []
    errors = []
    if not settings.DEBUG:
        if not settings.JWT_SECRET_KEY or len(settings.JWT_SECRET_KEY) < 32:
            errors.append("JWT_SECRET_KEY is too short or missing — set a fixed 32+ char secret in .env")
        if not settings.TOKEN_ENCRYPTION_KEY:
            errors.append(
                "TOKEN_ENCRYPTION_KEY missing — OAuth tokens would be stored in plaintext. "
                "Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        if not settings.WEBHOOK_INBOUND_SECRET:
            errors.append("WEBHOOK_INBOUND_SECRET missing — inbound webhooks would accept unsigned requests")
        if not settings.GROQ_API_KEY and not settings.NVIDIA_NIM_API_KEY and not settings.GEMINI_API_KEY:
            warnings.append("No LLM API keys configured — AI features will fail")
    for w in warnings:
        print(f"\n[CONFIG WARNING] {w}", file=sys.stderr)
    if errors:
        for e in errors:
            print(f"\n[CONFIG ERROR] {e}", file=sys.stderr)
        print(
            "\nRefusing to start with DEBUG=false and the above unresolved. "
            "Fix .env, or set DEBUG=true for local development only.\n",
            file=sys.stderr,
        )
        sys.exit(1)


validate_config()
