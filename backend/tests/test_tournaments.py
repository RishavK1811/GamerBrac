"""
Phase 2 tournament tests.

Covers:
- Public listing and detail endpoints
- Organizer create / update / status transition
- Authorization: player cannot create; non-owner cannot edit
- Status gate: registration only when REGISTRATION_OPEN
- Deadline gate: registration rejected after deadline
- Capacity gate: registration rejected when full
- Duplicate registration: same user twice → 400
- Team registration: only captain can register team
- Team duplicate: same team registered twice → 400
- Check-in: only when tournament is in CHECK_IN status and user is registered
- Withdrawal: decrements participant count, idempotent guard
- Concurrent-ish registration: exact capacity boundary
"""
import pytest
from datetime import datetime, timedelta, timezone
from typing import Callable
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.tournament import (
    Tournament,
    TournamentParticipant,
    TournamentFormat,
    TournamentStatus,
    ParticipantStatus,
)
from app.models.user import UserRole, User
from app.models.team import Team, TeamMember, TeamRole


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _future(days: int = 7) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _past(days: int = 1) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _tournament_payload(**overrides) -> dict:
    defaults = {
        "title": "GamerBrac Open 2026",
        "game_title": "BGMI",
        "format": "squad",
        "max_participants": 16,
        "registration_deadline": _future(3),
        "start_datetime": _future(7),
    }
    defaults.update(overrides)
    return defaults


def _create_tournament(
    db: Session,
    organizer: User,
    *,
    status: TournamentStatus = TournamentStatus.REGISTRATION_OPEN,
    max_participants: int = 4,
    current_participants: int = 0,
    registration_deadline: datetime | None = None,
) -> Tournament:
    if registration_deadline is None:
        registration_deadline = datetime.now(timezone.utc) + timedelta(days=3)
    t = Tournament(
        title="Test Tournament",
        game_title="BGMI",
        format=TournamentFormat.SOLO,
        status=status,
        max_participants=max_participants,
        current_participants=current_participants,
        registration_deadline=registration_deadline,
        start_datetime=datetime.now(timezone.utc) + timedelta(days=7),
        organizer_id=organizer.id,
        is_free_entry=True,
    )
    db.add(t)
    db.flush()
    return t


def _add_participant(
    db: Session,
    tournament: Tournament,
    user: User,
    *,
    status: ParticipantStatus = ParticipantStatus.REGISTERED,
    team_id: str | None = None,
) -> TournamentParticipant:
    p = TournamentParticipant(
        tournament_id=tournament.id,
        user_id=user.id,
        team_id=team_id,
        status=status,
    )
    db.add(p)
    tournament.current_participants += 1
    db.flush()
    return p


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

def test_list_tournaments_empty(client: TestClient):
    resp = client.get("/api/v1/tournaments")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_tournaments_with_data(
    client: TestClient, db_session: Session, create_user: Callable
):
    organizer = create_user("org1", "org1@gb.com", role=UserRole.ORGANIZER)
    _create_tournament(db_session, organizer)
    resp = client.get("/api/v1/tournaments")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["game_title"] == "BGMI"


def test_list_tournaments_game_filter(
    client: TestClient, db_session: Session, create_user: Callable
):
    organizer = create_user("org2", "org2@gb.com", role=UserRole.ORGANIZER)
    t = _create_tournament(db_session, organizer)
    # filter by VALORANT — should return 0
    resp = client.get("/api/v1/tournaments?game=VALORANT")
    assert resp.status_code == 200
    assert resp.json() == []
    # filter by BGMI — should return 1
    resp2 = client.get("/api/v1/tournaments?game=BGMI")
    assert resp2.status_code == 200
    assert len(resp2.json()) == 1


def test_get_tournament_detail(
    client: TestClient, db_session: Session, create_user: Callable
):
    organizer = create_user("org3", "org3@gb.com", role=UserRole.ORGANIZER)
    t = _create_tournament(db_session, organizer)
    resp = client.get(f"/api/v1/tournaments/{t.id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == t.id


def test_get_tournament_not_found(client: TestClient):
    resp = client.get("/api/v1/tournaments/nonexistent-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Create tournament
# ---------------------------------------------------------------------------

def test_organizer_can_create_tournament(
    client: TestClient, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("corg1", "corg1@gb.com", role=UserRole.ORGANIZER)
    headers = auth_headers(organizer)
    resp = client.post("/api/v1/tournaments", json=_tournament_payload(), headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "GamerBrac Open 2026"
    assert body["status"] == "draft"
    assert body["is_free_entry"] is True
    assert body["organizer_id"] == organizer.id


def test_player_cannot_create_tournament(
    client: TestClient, create_user: Callable, auth_headers: Callable
):
    player = create_user("cplayer1", "cplayer1@gb.com", role=UserRole.PLAYER)
    headers = auth_headers(player)
    resp = client.post("/api/v1/tournaments", json=_tournament_payload(), headers=headers)
    assert resp.status_code == 403


def test_unauthenticated_cannot_create_tournament(client: TestClient):
    resp = client.post("/api/v1/tournaments", json=_tournament_payload())
    # HTTPBearer returns 403 when no credentials are provided (auto_error=True default)
    assert resp.status_code in (401, 403)


def test_create_tournament_invalid_dates(
    client: TestClient, create_user: Callable, auth_headers: Callable
):
    """start_datetime before registration_deadline → 422."""
    organizer = create_user("corg2", "corg2@gb.com", role=UserRole.ORGANIZER)
    headers = auth_headers(organizer)
    payload = _tournament_payload(
        registration_deadline=_future(10),
        start_datetime=_future(5),  # before deadline
    )
    resp = client.post("/api/v1/tournaments", json=payload, headers=headers)
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Update tournament
# ---------------------------------------------------------------------------

def test_owner_can_update_tournament(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("uorg1", "uorg1@gb.com", role=UserRole.ORGANIZER)
    t = _create_tournament(db_session, organizer, status=TournamentStatus.DRAFT)
    headers = auth_headers(organizer)
    resp = client.put(
        f"/api/v1/tournaments/{t.id}",
        json={"title": "Updated Title"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


def test_non_owner_cannot_update_tournament(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    owner = create_user("uorg2", "uorg2@gb.com", role=UserRole.ORGANIZER)
    other = create_user("uorg3", "uorg3@gb.com", role=UserRole.ORGANIZER)
    t = _create_tournament(db_session, owner, status=TournamentStatus.DRAFT)
    headers = auth_headers(other)
    resp = client.put(
        f"/api/v1/tournaments/{t.id}",
        json={"title": "Stolen Title"},
        headers=headers,
    )
    assert resp.status_code == 403


def test_cannot_reduce_max_participants_below_current(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("uorg4", "uorg4@gb.com", role=UserRole.ORGANIZER)
    t = _create_tournament(db_session, organizer, max_participants=8, current_participants=5)
    t.status = TournamentStatus.DRAFT
    db_session.flush()
    headers = auth_headers(organizer)
    resp = client.put(
        f"/api/v1/tournaments/{t.id}",
        json={"max_participants": 3},  # 3 < 5 current
        headers=headers,
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Status transitions
# ---------------------------------------------------------------------------

def test_organizer_can_advance_status(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("torg1", "torg1@gb.com", role=UserRole.ORGANIZER)
    t = _create_tournament(db_session, organizer, status=TournamentStatus.DRAFT)
    headers = auth_headers(organizer)
    resp = client.patch(
        f"/api/v1/tournaments/{t.id}/status",
        json={"status": "registration_open"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "registration_open"


def test_invalid_status_transition_rejected(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Cannot jump from DRAFT directly to ONGOING."""
    organizer = create_user("torg2", "torg2@gb.com", role=UserRole.ORGANIZER)
    t = _create_tournament(db_session, organizer, status=TournamentStatus.DRAFT)
    headers = auth_headers(organizer)
    resp = client.patch(
        f"/api/v1/tournaments/{t.id}/status",
        json={"status": "ongoing"},
        headers=headers,
    )
    assert resp.status_code == 400


def test_completed_tournament_is_terminal(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("torg3", "torg3@gb.com", role=UserRole.ORGANIZER)
    t = _create_tournament(db_session, organizer, status=TournamentStatus.COMPLETED)
    headers = auth_headers(organizer)
    resp = client.patch(
        f"/api/v1/tournaments/{t.id}/status",
        json={"status": "cancelled"},
        headers=headers,
    )
    assert resp.status_code == 400


def test_any_non_completed_can_be_cancelled(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("torg4", "torg4@gb.com", role=UserRole.ORGANIZER)
    t = _create_tournament(db_session, organizer, status=TournamentStatus.ONGOING)
    headers = auth_headers(organizer)
    resp = client.patch(
        f"/api/v1/tournaments/{t.id}/status",
        json={"status": "cancelled"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

def test_player_can_register(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("rorg1", "rorg1@gb.com", role=UserRole.ORGANIZER)
    player = create_user("rplayer1", "rplayer1@gb.com", role=UserRole.PLAYER)
    t = _create_tournament(db_session, organizer)
    headers = auth_headers(player)
    resp = client.post(f"/api/v1/tournaments/{t.id}/register", json={}, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["user_id"] == player.id
    assert body["status"] == "registered"


def test_duplicate_registration_rejected(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("rorg2", "rorg2@gb.com", role=UserRole.ORGANIZER)
    player = create_user("rplayer2", "rplayer2@gb.com", role=UserRole.PLAYER)
    t = _create_tournament(db_session, organizer)
    _add_participant(db_session, t, player)
    headers = auth_headers(player)
    resp = client.post(f"/api/v1/tournaments/{t.id}/register", json={}, headers=headers)
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"]


def test_registration_closed_when_not_open(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("rorg3", "rorg3@gb.com", role=UserRole.ORGANIZER)
    player = create_user("rplayer3", "rplayer3@gb.com", role=UserRole.PLAYER)
    t = _create_tournament(db_session, organizer, status=TournamentStatus.DRAFT)
    headers = auth_headers(player)
    resp = client.post(f"/api/v1/tournaments/{t.id}/register", json={}, headers=headers)
    assert resp.status_code == 400
    assert "not open for registration" in resp.json()["detail"]


def test_registration_rejected_after_deadline(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("rorg4", "rorg4@gb.com", role=UserRole.ORGANIZER)
    player = create_user("rplayer4", "rplayer4@gb.com", role=UserRole.PLAYER)
    past_deadline = datetime.now(timezone.utc) - timedelta(hours=1)
    t = _create_tournament(
        db_session, organizer, registration_deadline=past_deadline
    )
    headers = auth_headers(player)
    resp = client.post(f"/api/v1/tournaments/{t.id}/register", json={}, headers=headers)
    assert resp.status_code == 400
    assert "deadline" in resp.json()["detail"]


def test_registration_rejected_when_full(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("rorg5", "rorg5@gb.com", role=UserRole.ORGANIZER)
    player = create_user("rplayer5", "rplayer5@gb.com", role=UserRole.PLAYER)
    # max=2, current=2 → full
    t = _create_tournament(db_session, organizer, max_participants=2, current_participants=2)
    headers = auth_headers(player)
    resp = client.post(f"/api/v1/tournaments/{t.id}/register", json={}, headers=headers)
    assert resp.status_code == 400
    assert "full" in resp.json()["detail"]


def test_capacity_boundary_last_slot(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Register successfully into the very last available slot."""
    organizer = create_user("rorg6", "rorg6@gb.com", role=UserRole.ORGANIZER)
    existing = create_user("rexist1", "rexist1@gb.com", role=UserRole.PLAYER)
    newcomer = create_user("rnew1", "rnew1@gb.com", role=UserRole.PLAYER)
    t = _create_tournament(db_session, organizer, max_participants=2)
    _add_participant(db_session, t, existing)  # current = 1, max = 2
    headers = auth_headers(newcomer)
    resp = client.post(f"/api/v1/tournaments/{t.id}/register", json={}, headers=headers)
    assert resp.status_code == 201


# ---------------------------------------------------------------------------
# Team registration
# ---------------------------------------------------------------------------

def _create_team(db: Session, captain: User, name: str = "Team Alpha") -> Team:
    team = Team(name=name, tag=name[:4].upper(), primary_game="BGMI", captain_id=captain.id)
    db.add(team)
    db.flush()
    member = TeamMember(team_id=team.id, user_id=captain.id, role=TeamRole.CAPTAIN)
    db.add(member)
    db.flush()
    return team


def _create_squad_tournament(db: Session, organizer: User) -> Tournament:
    t = Tournament(
        title="Squad Cup",
        game_title="BGMI",
        format=TournamentFormat.SQUAD,
        status=TournamentStatus.REGISTRATION_OPEN,
        max_participants=8,
        current_participants=0,
        registration_deadline=datetime.now(timezone.utc) + timedelta(days=3),
        start_datetime=datetime.now(timezone.utc) + timedelta(days=7),
        organizer_id=organizer.id,
        is_free_entry=True,
    )
    db.add(t)
    db.flush()
    return t


def test_captain_can_register_team(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("torg5", "torg5@gb.com", role=UserRole.ORGANIZER)
    captain = create_user("cap1", "cap1@gb.com", role=UserRole.PLAYER)
    team = _create_team(db_session, captain)
    t = _create_squad_tournament(db_session, organizer)
    headers = auth_headers(captain)
    resp = client.post(
        f"/api/v1/tournaments/{t.id}/register",
        json={"team_id": team.id},
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.json()["team_id"] == team.id


def test_non_captain_cannot_register_team(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("torg6", "torg6@gb.com", role=UserRole.ORGANIZER)
    captain = create_user("cap2", "cap2@gb.com", role=UserRole.PLAYER)
    random_user = create_user("rand1", "rand1@gb.com", role=UserRole.PLAYER)
    team = _create_team(db_session, captain)
    t = _create_squad_tournament(db_session, organizer)
    headers = auth_headers(random_user)
    resp = client.post(
        f"/api/v1/tournaments/{t.id}/register",
        json={"team_id": team.id},
        headers=headers,
    )
    assert resp.status_code == 403


def test_duplicate_team_registration_rejected(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("torg7", "torg7@gb.com", role=UserRole.ORGANIZER)
    captain = create_user("cap3", "cap3@gb.com", role=UserRole.PLAYER)
    team = _create_team(db_session, captain, name="TeamBeta")
    t = _create_squad_tournament(db_session, organizer)
    _add_participant(db_session, t, captain, team_id=team.id)
    headers = auth_headers(captain)
    resp = client.post(
        f"/api/v1/tournaments/{t.id}/register",
        json={"team_id": team.id},
        headers=headers,
    )
    assert resp.status_code == 400


def test_squad_tournament_requires_team_id(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("torg8", "torg8@gb.com", role=UserRole.ORGANIZER)
    player = create_user("sqp1", "sqp1@gb.com", role=UserRole.PLAYER)
    t = _create_squad_tournament(db_session, organizer)
    headers = auth_headers(player)
    resp = client.post(f"/api/v1/tournaments/{t.id}/register", json={}, headers=headers)
    assert resp.status_code == 422


def test_solo_tournament_rejects_team_id(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("torg9", "torg9@gb.com", role=UserRole.ORGANIZER)
    captain = create_user("cap4", "cap4@gb.com", role=UserRole.PLAYER)
    team = _create_team(db_session, captain, name="TeamGamma")
    t = _create_tournament(db_session, organizer)  # solo format
    headers = auth_headers(captain)
    resp = client.post(
        f"/api/v1/tournaments/{t.id}/register",
        json={"team_id": team.id},
        headers=headers,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Check-in
# ---------------------------------------------------------------------------

def test_player_can_check_in(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("borg1", "borg1@gb.com", role=UserRole.ORGANIZER)
    player = create_user("bplayer1", "bplayer1@gb.com", role=UserRole.PLAYER)
    t = _create_tournament(db_session, organizer, status=TournamentStatus.CHECK_IN)
    _add_participant(db_session, t, player)
    headers = auth_headers(player)
    resp = client.post(f"/api/v1/tournaments/{t.id}/check-in", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "checked_in"
    assert resp.json()["checked_in_at"] is not None


def test_check_in_not_registered(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("borg2", "borg2@gb.com", role=UserRole.ORGANIZER)
    player = create_user("bplayer2", "bplayer2@gb.com", role=UserRole.PLAYER)
    t = _create_tournament(db_session, organizer, status=TournamentStatus.CHECK_IN)
    headers = auth_headers(player)
    resp = client.post(f"/api/v1/tournaments/{t.id}/check-in", headers=headers)
    assert resp.status_code == 400
    assert "not registered" in resp.json()["detail"]


def test_check_in_wrong_status(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("borg3", "borg3@gb.com", role=UserRole.ORGANIZER)
    player = create_user("bplayer3", "bplayer3@gb.com", role=UserRole.PLAYER)
    t = _create_tournament(db_session, organizer)  # REGISTRATION_OPEN, not CHECK_IN
    _add_participant(db_session, t, player)
    headers = auth_headers(player)
    resp = client.post(f"/api/v1/tournaments/{t.id}/check-in", headers=headers)
    assert resp.status_code == 400
    assert "check-in phase" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Withdrawal
# ---------------------------------------------------------------------------

def test_player_can_withdraw(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("worg1", "worg1@gb.com", role=UserRole.ORGANIZER)
    player = create_user("wplayer1", "wplayer1@gb.com", role=UserRole.PLAYER)
    t = _create_tournament(db_session, organizer, max_participants=4)
    _add_participant(db_session, t, player)
    initial_count = t.current_participants
    headers = auth_headers(player)
    resp = client.delete(f"/api/v1/tournaments/{t.id}/register", headers=headers)
    assert resp.status_code == 200
    # Verify count decremented
    db_session.refresh(t)
    assert t.current_participants == initial_count - 1


def test_withdraw_not_registered(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("worg2", "worg2@gb.com", role=UserRole.ORGANIZER)
    player = create_user("wplayer2", "wplayer2@gb.com", role=UserRole.PLAYER)
    t = _create_tournament(db_session, organizer)
    headers = auth_headers(player)
    resp = client.delete(f"/api/v1/tournaments/{t.id}/register", headers=headers)
    assert resp.status_code == 400


def test_cannot_withdraw_from_ongoing_tournament(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("worg3", "worg3@gb.com", role=UserRole.ORGANIZER)
    player = create_user("wplayer3", "wplayer3@gb.com", role=UserRole.PLAYER)
    t = _create_tournament(db_session, organizer, status=TournamentStatus.ONGOING)
    _add_participant(db_session, t, player)
    headers = auth_headers(player)
    resp = client.delete(f"/api/v1/tournaments/{t.id}/register", headers=headers)
    assert resp.status_code == 400


def test_withdraw_already_withdrawn(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("worg4", "worg4@gb.com", role=UserRole.ORGANIZER)
    player = create_user("wplayer4", "wplayer4@gb.com", role=UserRole.PLAYER)
    t = _create_tournament(db_session, organizer)
    _add_participant(db_session, t, player, status=ParticipantStatus.WITHDRAWN)
    headers = auth_headers(player)
    resp = client.delete(f"/api/v1/tournaments/{t.id}/register", headers=headers)
    assert resp.status_code == 400
    assert "already withdrawn" in resp.json()["detail"]
