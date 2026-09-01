"""
Token Encryption — Fernet-based encryption for OAuth tokens at rest.
Tokens are encrypted before DB write, decrypted only when Gmail API needs them.

Production: TOKEN_ENCRYPTION_KEY MUST be set. Fails hard if missing.
Development: Falls back to plaintext with a warning (convenience only).
"""
import base64
import logging
import os
from typing import Optional

logger = logging.getLogger("elly.token_encryption")

_fernet = None

# Production mode: fail hard if encryption key is missing
_IS_PRODUCTION = os.environ.get("ELLY_ENV", "").lower() in ("production", "prod", "deploy")


def _get_fernet():
    """Lazy-init Fernet cipher from TOKEN_ENCRYPTION_KEY."""
    global _fernet
    if _fernet is not None:
        return _fernet
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        if _IS_PRODUCTION:
            raise RuntimeError(
                "FATAL: cryptography package required in production for token encryption. "
                "Install with: pip install cryptography"
            )
        logger.warning("cryptography package not installed — token encryption disabled (dev mode)")
        return None
    from app.core.config import settings
    key = settings.TOKEN_ENCRYPTION_KEY
    if not key:
        if _IS_PRODUCTION:
            raise RuntimeError(
                "FATAL: TOKEN_ENCRYPTION_KEY not set. "
                "OAuth tokens CANNOT be stored securely without encryption. "
                "Generate a key with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        logger.warning("TOKEN_ENCRYPTION_KEY not set — token encryption disabled (dev mode)")
        return None
    try:
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
        return _fernet
    except Exception as e:
        logger.error("Invalid TOKEN_ENCRYPTION_KEY: %s", e)
        return None


def encrypt_token(plaintext: Optional[str]) -> Optional[str]:
    """Encrypt a token string. Returns None if None input or encryption unavailable."""
    if not plaintext:
        return plaintext
    f = _get_fernet()
    if not f:
        if _IS_PRODUCTION:
            raise RuntimeError("Cannot encrypt token: Fernet not available in production")
        return plaintext  # plaintext fallback in dev only
    try:
        return f.encrypt(plaintext.encode()).decode()
    except Exception as e:
        logger.error("Token encryption failed: %s", e)
        if _IS_PRODUCTION:
            raise
        return plaintext


def decrypt_token(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypt an encrypted token string. Returns None if None input or decryption unavailable."""
    if not ciphertext:
        return ciphertext
    f = _get_fernet()
    if not f:
        if _IS_PRODUCTION:
            raise RuntimeError("Cannot decrypt token: Fernet not available in production")
        return ciphertext  # assume plaintext if no key (dev only)
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except Exception:
        # Already plaintext (not encrypted) — return as-is for migration
        return ciphertext


def is_encrypted(value: Optional[str]) -> bool:
    """Check if a value appears to be Fernet-encrypted (starts with gAAAAA)."""
    return bool(value and value.startswith("gAAAAA"))
