"""
Tier 3B Automated Test Suite.

Covers:
- DELETE /api/v1/teams/{team_id} (captain authorization, safe membership deletion)
- Disband team rejection when actively registered in an active tournament
- Disband team success after tournament withdrawal
- Rate limiting with X-Forwarded-For reverse proxy header
"""

from datetime import datetime, timedelta, timezone
from typing import Callable
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.rate_limit import reset_rate_limits
from app.models.team import Team, TeamMember
from app.models.tournament import (
    ParticipantStatus,
    Tournament,
    TournamentFormat,
    TournamentParticipant,
    TournamentStatus,
)
from app.models.user import User, UserRole


def test_captain_can_disband_team(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    captain = create_user("t3b_cap1", "t3b_cap1@gb.com")
    create_user("t3b_mem1", "t3b_mem1@gb.com")

    # Create team
    headers = auth_headers(captain)
    create_resp = client.post(
        "/api/v1/teams",
        json={"name": "Disband Test Team", "tag": "DTT", "primary_game": "BGMI"},
        headers=headers,
    )
    assert create_resp.status_code == 201
    team_id = create_resp.json()["id"]

    # Add member
    add_resp = client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"username_or_email": "t3b_mem1"},
        headers=headers,
    )
    assert add_resp.status_code == 201

    # Disband team
    disband_resp = client.delete(f"/api/v1/teams/{team_id}", headers=headers)
    assert disband_resp.status_code == 200
    assert "disbanded successfully" in disband_resp.json()["message"]

    # Verify team and memberships no longer exist in DB
    assert db_session.query(Team).filter(Team.id == team_id).first() is None
    assert db_session.query(TeamMember).filter(TeamMember.team_id == team_id).count() == 0


def test_non_captain_cannot_disband_team(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    captain = create_user("t3b_cap2", "t3b_cap2@gb.com")
    member = create_user("t3b_mem2", "t3b_mem2@gb.com")

    headers_cap = auth_headers(captain)
    create_resp = client.post(
        "/api/v1/teams",
        json={"name": "Captain Only Team", "tag": "COT", "primary_game": "VALORANT"},
        headers=headers_cap,
    )
    team_id = create_resp.json()["id"]

    # Member attempts to disband
    headers_mem = auth_headers(member)
    disband_resp = client.delete(f"/api/v1/teams/{team_id}", headers=headers_mem)
    assert disband_resp.status_code == 403
    assert "Only the team captain" in disband_resp.json()["detail"]


def test_cannot_disband_team_registered_in_active_tournament(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("t3b_org1", "t3b_org1@gb.com", role=UserRole.ORGANIZER)
    captain = create_user("t3b_cap3", "t3b_cap3@gb.com")

    headers_cap = auth_headers(captain)
    team_resp = client.post(
        "/api/v1/teams",
        json={"name": "Active Squad", "tag": "ASQ", "primary_game": "BGMI"},
        headers=headers_cap,
    )
    team_id = team_resp.json()["id"]

    # Create active tournament
    t = Tournament(
        title="Active Squad Cup",
        game_title="BGMI",
        format=TournamentFormat.SQUAD,
        status=TournamentStatus.REGISTRATION_OPEN,
        max_participants=16,
        current_participants=1,
        registration_deadline=datetime.now(timezone.utc) + timedelta(days=2),
        start_datetime=datetime.now(timezone.utc) + timedelta(days=3),
        organizer_id=organizer.id,
        is_free_entry=True,
    )
    db_session.add(t)
    db_session.flush()

    # Register team
    tp = TournamentParticipant(
        tournament_id=t.id,
        user_id=captain.id,
        team_id=team_id,
        status=ParticipantStatus.REGISTERED,
    )
    db_session.add(tp)
    db_session.commit()

    # Attempt to disband should be rejected
    disband_resp = client.delete(f"/api/v1/teams/{team_id}", headers=headers_cap)
    assert disband_resp.status_code == 400
    assert "Cannot disband team while actively registered" in disband_resp.json()["detail"]

    # Now withdraw team from tournament
    tp.status = ParticipantStatus.WITHDRAWN
    db_session.commit()

    # Now disband should succeed
    disband_resp2 = client.delete(f"/api/v1/teams/{team_id}", headers=headers_cap)
    assert disband_resp2.status_code == 200


def test_rate_limiting_with_forwarded_for_header(
    client: TestClient, db_session: Session, create_user: Callable
):
    reset_rate_limits()
    fake_ip = "203.0.113.195"

    # Auth rate limit is 15 requests per 60 seconds
    for _ in range(15):
        resp = client.post(
            "/api/v1/auth/login",
            json={"username_or_email": "nonexistent@gb.com", "password": "WrongPassword123!"},
            headers={"X-Forwarded-For": fake_ip},
        )
        assert resp.status_code == 401

    # 16th request from this forwarded IP should trigger 429
    blocked_resp = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "nonexistent@gb.com", "password": "WrongPassword123!"},
        headers={"X-Forwarded-For": fake_ip},
    )
    assert blocked_resp.status_code == 429
    assert "Rate limit exceeded" in blocked_resp.json()["detail"]
    assert "Retry-After" in blocked_resp.headers

    reset_rate_limits()


def test_rate_limiting_rejects_spoofed_forwarded_for_from_untrusted_client(
    client: TestClient, db_session: Session
):
    from app.core.config import settings

    reset_rate_limits()
    original_trusted = list(settings.TRUSTED_PROXIES)
    try:
        # Untrusted client host: testclient is not in trusted list
        settings.TRUSTED_PROXIES = ["192.0.2.1"]

        fake_ip = "198.51.100.77"
        for _ in range(15):
            resp = client.post(
                "/api/v1/auth/login",
                json={"username_or_email": "nonexistent@gb.com", "password": "WrongPassword123!"},
                headers={"X-Forwarded-For": fake_ip},
            )
            assert resp.status_code == 401

        # 16th request even with a changed fake IP is blocked because client_host is keyed
        blocked_resp = client.post(
            "/api/v1/auth/login",
            json={"username_or_email": "nonexistent@gb.com", "password": "WrongPassword123!"},
            headers={"X-Forwarded-For": "198.51.100.88"},
        )
        assert blocked_resp.status_code == 429
        assert "Rate limit exceeded" in blocked_resp.json()["detail"]
    finally:
        settings.TRUSTED_PROXIES = original_trusted
        reset_rate_limits()
