import ipaddress
import time
from collections import defaultdict
from typing import Dict, List, Optional, Tuple, Union
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.core.config import settings

# In-memory storage for sliding-window request timestamps: (key) -> list of timestamps
_request_records: Dict[str, List[float]] = defaultdict(list)

# Route-specific rate limits: (requests, window_seconds)
RATE_LIMITS: Dict[str, Tuple[int, int]] = {
    "auth": (15, 60),          # 15 requests per 60 seconds for login & registration
    "credentials": (30, 60),   # 30 requests per 60 seconds for room credentials
    "evidence": (30, 60),      # 30 requests per 60 seconds for evidence uploads
    "general": (300, 60),      # 300 requests per 60 seconds for general API
}


def _get_bucket_for_path(path: str) -> str:
    if "/auth/login" in path or "/auth/register" in path:
        return "auth"
    if "/credentials" in path:
        return "credentials"
    if "/evidence" in path:
        return "evidence"
    return "general"


def reset_rate_limits():
    """Helper for testing to reset rate limit tracking."""
    _request_records.clear()


def is_ip_trusted(ip_str: str, trusted_list: List[str]) -> bool:
    """
    Check if an IP address string matches any trusted proxy IP or CIDR network.
    Supports IPv4, IPv6, CIDR blocks (e.g. '10.0.0.0/8'), and named hosts ('localhost', 'testclient').
    """
    if not ip_str:
        return False

    clean_ip = ip_str.strip()
    try:
        addr = ipaddress.ip_address(clean_ip)
    except ValueError:
        # Hostname or alias match
        return clean_ip.lower() in [
            item.lower() for item in trusted_list if isinstance(item, str) and "/" not in item
        ]

    for item in trusted_list:
        if not isinstance(item, str):
            continue
        item_clean = item.strip()
        if "/" in item_clean:
            try:
                network = ipaddress.ip_network(item_clean, strict=False)
                if addr in network:
                    return True
            except ValueError:
                continue
        else:
            try:
                if addr == ipaddress.ip_address(item_clean):
                    return True
            except ValueError:
                if clean_ip.lower() == item_clean.lower():
                    return True

    return False


def get_client_ip(request: Request) -> str:
    """
    Extract the real client IP for rate limiting using secure upstream proxy sanitization.

    Security Principles:
    1. If the immediate network peer (request.client.host) is NOT in TRUSTED_PROXIES,
       any client-supplied X-Forwarded-For header is completely ignored.
    2. If the peer IS trusted, parse X-Forwarded-For right-to-left (walking backward),
       skipping hops that belong to trusted proxies.
    3. The first untrusted IP encountered from the right is the true client IP.
    4. Never blindly use the leftmost IP, which can be spoofed by an untrusted client.
    5. Safely handle malformed IP strings without exceptions.
    """
    peer_host = request.client.host if request.client else "127.0.0.1"
    trusted_proxies = getattr(
        settings, "TRUSTED_PROXIES", ["127.0.0.1", "::1", "localhost", "testclient"]
    )

    if not is_ip_trusted(peer_host, trusted_proxies):
        return peer_host

    forwarded_for = request.headers.get("X-Forwarded-For")
    if not forwarded_for:
        return peer_host

    raw_hops = [h.strip() for h in forwarded_for.split(",") if h.strip()]
    if not raw_hops:
        return peer_host

    # Walk right-to-left: the rightmost untrusted hop is the true client
    for hop in reversed(raw_hops):
        try:
            ipaddress.ip_address(hop)
        except ValueError:
            # Skip malformed non-IP headers (e.g. injection attempts)
            continue

        if not is_ip_trusted(hop, trusted_proxies):
            return hop

    # If all hops are trusted (e.g. internal health check across trusted proxies),
    # return the leftmost valid IP, or peer_host if none
    for hop in raw_hops:
        try:
            ipaddress.ip_address(hop)
            return hop
        except ValueError:
            continue

    return peer_host


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if not getattr(settings, "RATE_LIMIT_ENABLED", True):
            return await call_next(request)

        # Allow tests to bypass when needed
        if request.headers.get("X-Test-Bypass-Rate-Limit") == "true":
            return await call_next(request)

        # Only apply rate limiting to /api routes
        path = request.url.path
        if not path.startswith(settings.API_V1_STR):
            return await call_next(request)

        # Extract sanitized client IP
        client_ip = get_client_ip(request)

        bucket = _get_bucket_for_path(path)
        max_requests, window_seconds = RATE_LIMITS.get(bucket, RATE_LIMITS["general"])

        key = f"{client_ip}:{bucket}"
        now = time.time()

        # Prune expired timestamps
        timestamps = _request_records[key]
        valid_timestamps = [t for t in timestamps if now - t < window_seconds]
        _request_records[key] = valid_timestamps

        if len(valid_timestamps) >= max_requests:
            oldest = valid_timestamps[0]
            retry_after = max(1, int(window_seconds - (now - oldest)))
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded for {bucket} operations. Please wait before retrying.",
                    "retry_after_seconds": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        _request_records[key].append(now)
        response = await call_next(request)
        return response
