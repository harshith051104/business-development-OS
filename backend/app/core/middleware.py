"""Simple in-memory rate limiter middleware."""
import time
from collections import defaultdict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Per-IP rate limiter. Returns 429 when limit exceeded.
    Sliding window: tracks requests in a 60s window.
    """

    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            client_key = auth_header[7:]
        else:
            client_key = request.client.host if request.client else "unknown"
        now = time.time()
        window = 60.0

        # Clean old entries
        self.requests[client_key] = [
            t for t in self.requests[client_key] if now - t < window
        ]

        if len(self.requests[client_key]) >= self.requests_per_minute:
            return Response(
                content='{"detail":"Rate limit exceeded. Try again later."}',
                status_code=429,
                media_type="application/json",
            )

        self.requests[client_key].append(now)
        return await call_next(request)
