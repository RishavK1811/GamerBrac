import io
import os
import shutil
import tempfile
from unittest.mock import MagicMock
import pytest
from pydantic import ValidationError
from starlette.requests import Request

from app.core.config import Settings, settings
from app.core.rate_limit import (
    RATE_LIMITS,
    get_client_ip,
    is_ip_trusted,
    reset_rate_limits,
)
from app.services.storage import (
    LocalStorageService,
    S3StorageService,
    get_storage_service,
)


# ---------------------------------------------------------------------------
# 1. Storage Adapter Tests (Local & Mocked S3)
# ---------------------------------------------------------------------------

def test_local_storage_lifecycle():
    """Verify LocalStorageService correctly saves, streams, verifies, and deletes files."""
    temp_dir = tempfile.mkdtemp()
    try:
        storage = LocalStorageService(base_dir=temp_dir)
        filename = "test_evidence.png"
        content = b"\x89PNG\r\n\x1a\nfake-image-bytes"

        assert not storage.file_exists(filename)

        # Save
        storage.save_file(filename, content, "image/png")
        assert storage.file_exists(filename)

        # Stream
        stream_gen, content_type = storage.get_file_stream(filename)
        assert content_type == "image/png"
        read_bytes = b"".join(list(stream_gen))
        assert read_bytes == content

        # Delete
        assert storage.delete_file(filename)
        assert not storage.file_exists(filename)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_s3_storage_mocked_lifecycle():
    """Verify S3StorageService interfaces with S3 client without real credentials."""
    mock_s3 = MagicMock()
    storage = S3StorageService(
        endpoint_url="https://fake-r2.cloudflarestorage.com",
        bucket_name="gamerbrac-evidence",
        access_key_id="fake-key",
        secret_access_key="fake-secret",
        region_name="auto",
        s3_client=mock_s3,
    )

    filename = "match_screen.png"
    content = b"\x89PNG\r\n\x1a\ns3-mock-data"

    # Save
    storage.save_file(filename, content, "image/png")
    mock_s3.put_object.assert_called_once_with(
        Bucket="gamerbrac-evidence",
        Key="match_screen.png",
        Body=content,
        ContentType="image/png",
    )

    # Exists check
    mock_s3.head_object.return_value = {"ContentLength": len(content)}
    assert storage.file_exists(filename) is True
    mock_s3.head_object.assert_called_once_with(
        Bucket="gamerbrac-evidence",
        Key="match_screen.png",
    )

    # Stream
    mock_body = MagicMock()
    mock_body.read.side_effect = [content, b""]
    mock_s3.get_object.return_value = {
        "ContentType": "image/png",
        "Body": mock_body,
    }

    stream_gen, content_type = storage.get_file_stream(filename)
    assert content_type == "image/png"
    read_data = b"".join(list(stream_gen))
    assert read_data == content

    # Delete
    assert storage.delete_file(filename) is True
    mock_s3.delete_object.assert_called_once_with(
        Bucket="gamerbrac-evidence",
        Key="match_screen.png",
    )


def test_storage_production_config_validation():
    """When STORAGE_BACKEND is s3 in production, endpoint, bucket and credentials must be set."""
    with pytest.raises(ValidationError) as exc:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-secure-production-secret-key-min-32-chars",
            ROOM_ENCRYPTION_KEY="a-secure-room-key-min-32-chars-long",
            BACKEND_CORS_ORIGINS=["https://gamerbrac.pages.dev"],
            STORAGE_BACKEND="s3",
            # Missing S3_ENDPOINT_URL, S3_BUCKET_NAME, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
        )
    assert "STORAGE_BACKEND is 's3'" in str(exc.value)

    # Successful validation when provided
    valid_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a-secure-production-secret-key-min-32-chars",
        ROOM_ENCRYPTION_KEY="a-secure-room-key-min-32-chars-long",
        BACKEND_CORS_ORIGINS=["https://gamerbrac.pages.dev"],
        STORAGE_BACKEND="s3",
        S3_ENDPOINT_URL="https://account.r2.cloudflarestorage.com",
        S3_BUCKET_NAME="gamerbrac-evidence",
        S3_ACCESS_KEY_ID="test-access-key",
        S3_SECRET_ACCESS_KEY="test-secret-key",
    )
    assert valid_settings.STORAGE_BACKEND == "s3"


# ---------------------------------------------------------------------------
# 2. Rate Limiting, CIDR Matching & X-Forwarded-For Spoofing Defense Tests
# ---------------------------------------------------------------------------

def test_is_ip_trusted_cidr_and_single():
    """Verify is_ip_trusted correctly matches IP addresses, CIDR blocks, and hostnames."""
    trusted = ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "localhost", "testclient"]

    # Exact matches
    assert is_ip_trusted("127.0.0.1", trusted) is True
    assert is_ip_trusted("localhost", trusted) is True
    assert is_ip_trusted("testclient", trusted) is True

    # CIDR subnet matches
    assert is_ip_trusted("10.0.0.1", trusted) is True
    assert is_ip_trusted("10.244.15.89", trusted) is True
    assert is_ip_trusted("172.16.0.1", trusted) is True
    assert is_ip_trusted("172.31.255.255", trusted) is True

    # Non-matches
    assert is_ip_trusted("192.168.1.1", trusted) is False
    assert is_ip_trusted("203.0.113.5", trusted) is False
    assert is_ip_trusted("172.32.0.1", trusted) is False
    assert is_ip_trusted("", trusted) is False
    assert is_ip_trusted("invalid-ip-string", trusted) is False


def test_get_client_ip_untrusted_peer_ignores_forwarded_for():
    """An untrusted network peer must never have its X-Forwarded-For trusted."""
    scope = {
        "type": "http",
        "client": ("203.0.113.195", 12345),
        "headers": [(b"x-forwarded-for", b"1.1.1.1, 10.0.0.1")],
    }
    req = Request(scope)
    # Even though header claims 1.1.1.1, peer is 203.0.113.195 (not trusted)
    assert get_client_ip(req) == "203.0.113.195"


def test_get_client_ip_trusted_peer_strips_trusted_and_ignores_spoofed_leftmost():
    """When peer is a trusted reverse proxy, right-to-left parsing picks the true client, ignoring spoofed leftmost."""
    # Configure trusted proxies
    original_proxies = getattr(settings, "TRUSTED_PROXIES", [])
    settings.TRUSTED_PROXIES = ["10.0.0.0/8", "172.16.0.0/12"]

    try:
        # Scenario: Attacker at 198.51.100.44 sent 'X-Forwarded-For: 1.1.1.1'.
        # Proxy at 10.0.0.2 appended real client 198.51.100.44.
        # Header received: '1.1.1.1, 198.51.100.44'
        scope = {
            "type": "http",
            "client": ("10.0.0.2", 54321),  # Direct connection from trusted Render load balancer
            "headers": [(b"x-forwarded-for", b"1.1.1.1, 198.51.100.44")],
        }
        req = Request(scope)
        # Must resolve to 198.51.100.44 (NOT spoofed 1.1.1.1)
        assert get_client_ip(req) == "198.51.100.44"
    finally:
        settings.TRUSTED_PROXIES = original_proxies


def test_get_client_ip_multi_hop_trusted_proxies():
    """Walks right-to-left through multiple trusted proxy hops (e.g. Cloudflare -> Render -> App)."""
    original_proxies = getattr(settings, "TRUSTED_PROXIES", [])
    settings.TRUSTED_PROXIES = ["10.0.0.0/8", "172.16.0.0/12"]

    try:
        # Real client 203.0.113.77 -> Cloudflare (172.16.0.5) -> Render (10.0.0.2)
        scope = {
            "type": "http",
            "client": ("10.0.0.2", 54321),
            "headers": [(b"x-forwarded-for", b"203.0.113.77, 172.16.0.5")],
        }
        req = Request(scope)
        assert get_client_ip(req) == "203.0.113.77"
    finally:
        settings.TRUSTED_PROXIES = original_proxies


def test_get_client_ip_malformed_header_handling():
    """Handles malformed headers gracefully without raising exceptions."""
    original_proxies = getattr(settings, "TRUSTED_PROXIES", [])
    settings.TRUSTED_PROXIES = ["10.0.0.0/8"]

    try:
        scope = {
            "type": "http",
            "client": ("10.0.0.2", 54321),
            "headers": [(b"x-forwarded-for", b"<script>alert(1)</script>, not-an-ip, 203.0.113.88")],
        }
        req = Request(scope)
        assert get_client_ip(req) == "203.0.113.88"

        # Completely invalid header falls back safely to peer host
        scope_garbage = {
            "type": "http",
            "client": ("10.0.0.2", 54321),
            "headers": [(b"x-forwarded-for", b"invalid, garbage, header")],
        }
        req_garbage = Request(scope_garbage)
        assert get_client_ip(req_garbage) == "10.0.0.2"
    finally:
        settings.TRUSTED_PROXIES = original_proxies


# ---------------------------------------------------------------------------
# 3. Aligned Auth Rate Limit Smoke Test (15 Allowed, 16+ Throttled)
# ---------------------------------------------------------------------------

def test_auth_rate_limit_15_req_threshold(client):
    """
    Asserts exact code rate limit behavior for auth bucket:
    15 requests per 60 seconds are allowed; request 16 and above return HTTP 429.
    """
    reset_rate_limits()
    test_ip = "198.51.100.99"

    # Send 18 requests from the same IP (peer header simulation)
    # Using invalid credentials so auth returns 401 until rate limit kicks in
    statuses = []
    for i in range(18):
        resp = client.post(
            "/api/v1/auth/login",
            json={"username_or_email": "nonexistent_smoketest@example.com", "password": "WrongPassword123!"},
            headers={"X-Forwarded-For": f"{test_ip}"},
        )
        statuses.append(resp.status_code)

    # First 15 must be 401 (processed by auth endpoint)
    assert statuses[:15] == [401] * 15, f"Expected 15 401s, got: {statuses[:15]}"

    # Requests 16, 17, 18 must be 429 (throttled by RateLimitMiddleware)
    assert statuses[15:] == [429, 429, 429], f"Expected 3 429s, got: {statuses[15:]}"

    reset_rate_limits()
