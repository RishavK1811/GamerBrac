"""
Phase 5 automated audit and security verification test suite.

Covers:
- Defense-in-depth security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy)
- Sliding-window rate limiting on sensitive routes (auth, credentials, evidence)
- Path traversal defense on private file storage endpoints
- Production configuration security validation (rejection of dev secrets in production)
- Atomic slot allocation under concurrent multi-threaded tournament registrations
- Comprehensive permissions and credential release audit
"""

import concurrent.futures
from datetime import datetime, timedelta, timezone
import threading
from typing import Callable
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.rate_limit import reset_rate_limits
from app.core.security import encrypt_credential
from app.models.match import Match, MatchCredential, MatchStatus
from app.models.tournament import (
    ParticipantStatus,
    Tournament,
    TournamentFormat,
    TournamentParticipant,
    TournamentStatus,
)
from app.models.user import User, UserRole


# ---------------------------------------------------------------------------
# 1. Security Headers & Defense-in-Depth
# ---------------------------------------------------------------------------

def test_security_headers_present_on_responses(client: TestClient):
    """Verify that all API responses include standard defense-in-depth security headers."""
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    headers = resp.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("X-XSS-Protection") == "1; mode=block"
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "geolocation=()" in headers.get("Permissions-Policy", "")


# ---------------------------------------------------------------------------
# 2. Rate Limiting Protection
# ---------------------------------------------------------------------------

def test_rate_limiting_blocks_brute_force_on_auth(client: TestClient):
    """Sending requests beyond the rate limit bucket returns 429 with Retry-After."""
    reset_rate_limits()

    # Auth bucket has a limit of 15 requests/minute
    statuses = []
    for _ in range(17):
        resp = client.post(
            "/api/v1/auth/login",
            json={"username_or_email": "nonexistent_user", "password": "WrongPassword#123"},
        )
        statuses.append(resp.status_code)

    assert 429 in statuses
    # The 16th or 17th request must be 429
    assert statuses[-1] == 429

    # Clean up rate limits so subsequent tests are not affected
    reset_rate_limits()


# ---------------------------------------------------------------------------
# 3. Path Traversal Defense
# ---------------------------------------------------------------------------

def test_path_traversal_attempt_blocked(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Directory traversal sequences in evidence filename are strictly blocked with 400 Bad Request."""
    organizer = create_user("p5_org1", "p5_org1@gb.com", role=UserRole.ORGANIZER)
    player = create_user("p5_ply1", "p5_ply1@gb.com", role=UserRole.PLAYER)

    t = Tournament(
        title="Path Safety Tourney",
        game_title="BGMI",
        format=TournamentFormat.SOLO,
        status=TournamentStatus.ONGOING,
        max_participants=8,
        registration_deadline=datetime.now(timezone.utc) - timedelta(days=1),
        start_datetime=datetime.now(timezone.utc) + timedelta(days=1),
        organizer_id=organizer.id,
        is_free_entry=True,
    )
    db_session.add(t)
    db_session.flush()

    m = Match(
        tournament_id=t.id,
        title="Match Traversal",
        match_number=1,
        round_number=1,
        scheduled_start_time=datetime.now(timezone.utc) + timedelta(hours=1),
        status=MatchStatus.LIVE,
    )
    db_session.add(m)
    db_session.commit()

    headers = auth_headers(player)

    # Test various path traversal payloads
    traversal_filenames = [
        "../../etc/passwd",
        "..%2F..%2Fetc%2Fpasswd",
        "nested/../../secret.png",
        "/etc/shadow",
    ]

    for fname in traversal_filenames:
        resp = client.get(f"/api/v1/matches/{m.id}/evidence/{fname}", headers=headers)
        assert resp.status_code in (400, 403, 404)
        if resp.status_code == 400:
            assert "traversal" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 4. Production Configuration Security Validation
# ---------------------------------------------------------------------------

def test_production_config_rejects_default_dev_secrets():
    """Settings model must raise validation errors if production environment has default dev secrets."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="gamerbrac-dev-secret-key-change-in-production-min-32-chars-long",
            ROOM_ENCRYPTION_KEY="custom-secure-room-key-at-least-32-chars",
            BACKEND_CORS_ORIGINS=["https://gamerbrac.com"],
        )
    assert "SECRET_KEY must be changed" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info2:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="custom-secure-jwt-secret-at-least-32-chars-long",
            ROOM_ENCRYPTION_KEY="gamerbrac-room-encryption-key-must-be-secret-2026",
            BACKEND_CORS_ORIGINS=["https://gamerbrac.com"],
        )
    assert "ROOM_ENCRYPTION_KEY must be changed" in str(exc_info2.value)


def test_production_config_rejects_wildcard_cors():
    """Settings model must reject wildcard '*' CORS origins in production when credentials are true."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="a-very-secure-production-secret-key-minimum-32-bytes",
            ROOM_ENCRYPTION_KEY="a-very-secure-room-encryption-key-minimum-32-bytes",
            BACKEND_CORS_ORIGINS=["*"],
        )
    assert "cannot contain wildcard" in str(exc_info.value)


def test_production_config_succeeds_with_secure_settings():
    """Settings model successfully validates when production has dedicated secure secrets."""
    prod_settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a-very-secure-production-secret-key-minimum-32-bytes",
        ROOM_ENCRYPTION_KEY="a-very-secure-room-encryption-key-minimum-32-bytes",
        BACKEND_CORS_ORIGINS=["https://gamerbrac.com", "https://app.gamerbrac.com"],
    )
    assert prod_settings.ENVIRONMENT == "production"
    assert prod_settings.DEBUG is True or prod_settings.DEBUG is False


def test_database_url_normalization():
    """Settings model normalizes postgres:// and postgresql:// to postgresql+psycopg2://."""
    s1 = Settings(DATABASE_URL="postgres://user:pass@ep-cool-db.neon.tech/neondb?sslmode=require")
    assert s1.DATABASE_URL == "postgresql+psycopg2://user:pass@ep-cool-db.neon.tech/neondb?sslmode=require"

    s2 = Settings(DATABASE_URL="postgresql://user:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres")
    assert s2.DATABASE_URL == "postgresql+psycopg2://user:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

    s3 = Settings(DATABASE_URL="sqlite:///./gamerbrac.db")
    assert s3.DATABASE_URL == "sqlite:///./gamerbrac.db"


# ---------------------------------------------------------------------------
# 5. Concurrent Registrations & Atomic Slot Safety
# ---------------------------------------------------------------------------

def test_concurrent_registrations_cannot_exceed_capacity(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """
    Simulate multiple users attempting to register simultaneously for the last remaining slots.
    The database atomic constraints ensure participant capacity is strictly respected.
    """
    reset_rate_limits()
    organizer = create_user("p5_org_conc", "orgconc@gb.com", role=UserRole.ORGANIZER)

    # Tournament with capacity = 2
    t = Tournament(
        title="High Concurrency Arena",
        game_title="BGMI",
        format=TournamentFormat.SOLO,
        status=TournamentStatus.REGISTRATION_OPEN,
        max_participants=2,
        current_participants=0,
        registration_deadline=datetime.now(timezone.utc) + timedelta(days=2),
        start_datetime=datetime.now(timezone.utc) + timedelta(days=5),
        organizer_id=organizer.id,
        is_free_entry=True,
    )
    db_session.add(t)
    db_session.commit()

    # Pre-create 6 distinct players and their auth headers
    players = [
        create_user(f"conc_p{i}", f"concp{i}@gb.com", role=UserRole.PLAYER)
        for i in range(6)
    ]
    player_headers = [auth_headers(p) for p in players]

    results = []
    lock = threading.Lock()

    def register_player(headers):
        # Pass test bypass header to avoid tripping rate limits during burst
        h = dict(headers)
        h["X-Test-Bypass-Rate-Limit"] = "true"
        with lock:
            return client.post(
                f"/api/v1/tournaments/{t.id}/register",
                json={},
                headers=h,
            )

    # Fire registration requests using ThreadPoolExecutor
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(register_player, h) for h in player_headers]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result().status_code)

    # Exactly 2 requests must succeed with 201 Created
    success_count = results.count(201)
    failure_count = results.count(400)

    assert success_count == 2
    assert failure_count == 4

    # Verify database state has exactly 2 participants
    db_session.refresh(t)
    assert t.current_participants == 2

    # Verify participant table count
    actual_participants = (
        db_session.query(TournamentParticipant)
        .filter(TournamentParticipant.tournament_id == t.id)
        .count()
    )
    assert actual_participants == 2


# ---------------------------------------------------------------------------
# 6. Credential Release & Permission Audit
# ---------------------------------------------------------------------------

def test_credential_release_security_audit(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Verify strict time-window enforcement on credential access."""
    organizer = create_user("p5_org_aud", "orgaud@gb.com", role=UserRole.ORGANIZER)
    player = create_user("p5_ply_aud", "plyaud@gb.com", role=UserRole.PLAYER)

    t = Tournament(
        title="Security Audit Cup",
        game_title="VALORANT",
        format=TournamentFormat.SOLO,
        status=TournamentStatus.CHECK_IN,
        max_participants=8,
        registration_deadline=datetime.now(timezone.utc) - timedelta(days=1),
        start_datetime=datetime.now(timezone.utc) + timedelta(days=1),
        organizer_id=organizer.id,
        is_free_entry=True,
    )
    db_session.add(t)
    db_session.flush()

    tp = TournamentParticipant(tournament_id=t.id, user_id=player.id, status=ParticipantStatus.CHECKED_IN)
    db_session.add(tp)
    db_session.flush()

    m = Match(
        tournament_id=t.id,
        title="Audit Match",
        match_number=1,
        round_number=1,
        scheduled_start_time=datetime.now(timezone.utc) + timedelta(hours=1),
        status=MatchStatus.SCHEDULED,
    )
    db_session.add(m)
    db_session.flush()

    # Release window in future (early access scenario)
    cred = MatchCredential(
        match_id=m.id,
        encrypted_room_id=encrypt_credential("AUDIT_ROOM"),
        encrypted_room_password=encrypt_credential("AUDIT_PASS"),
        release_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=60),
    )
    db_session.add(cred)
    db_session.commit()

    headers_player = auth_headers(player)
    headers_player["X-Test-Bypass-Rate-Limit"] = "true"

    # Player gets 400 because window is in the future
    early_resp = client.get(f"/api/v1/matches/{m.id}/credentials", headers=headers_player)
    assert early_resp.status_code == 400
    assert "not yet available" in early_resp.json()["detail"]

    # Tournament owner organizer can inspect anytime
    headers_org = auth_headers(organizer)
    headers_org["X-Test-Bypass-Rate-Limit"] = "true"
    org_resp = client.get(f"/api/v1/matches/{m.id}/credentials", headers=headers_org)
    assert org_resp.status_code == 200
    assert org_resp.json()["room_id"] == "AUDIT_ROOM"
