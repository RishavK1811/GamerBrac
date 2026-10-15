"""
Phase 3 match and room credential tests.

Covers:
- Authenticated encryption (AES-256-GCM) roundtrip, unique nonces, and tamper detection
- Match creation: organizer-owned tournaments only
- Cross-organizer rejection (Organizer B cannot create match or credentials for Organizer A's tournament)
- Secret leakage prevention: public match listing & details NEVER expose Room ID or password
- Credential management: organizer sets encrypted room ID and password with release/expiry windows
- Player check-in eligibility: only checked-in registered participants can view credentials
- Window gating:
    - Early access (before release_at) → 400 Bad Request
    - Expired access (after expires_at) → 400 Bad Request
    - Valid window (between release_at and expires_at) → 200 OK with decrypted room credentials
- Match roster management: adding and removing participants with tournament boundaries
"""

from datetime import datetime, timedelta, timezone
from typing import Callable
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import decrypt_credential, encrypt_credential
from app.models.match import Match, MatchCredential, MatchParticipant, MatchStatus
from app.models.tournament import (
    ParticipantStatus,
    Tournament,
    TournamentFormat,
    TournamentParticipant,
    TournamentStatus,
)
from app.models.user import User, UserRole


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

def _future(minutes: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def _past(minutes: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=minutes)


def _create_tournament(
    db: Session,
    organizer: User,
    *,
    status: TournamentStatus = TournamentStatus.REGISTRATION_OPEN,
) -> Tournament:
    t = Tournament(
        title="BGMI Champions Cup",
        game_title="BGMI",
        format=TournamentFormat.SOLO,
        status=status,
        max_participants=16,
        current_participants=0,
        registration_deadline=datetime.now(timezone.utc) + timedelta(days=2),
        start_datetime=datetime.now(timezone.utc) + timedelta(days=5),
        organizer_id=organizer.id,
        is_free_entry=True,
    )
    db.add(t)
    db.flush()
    return t


def _create_match(
    db: Session,
    tournament: Tournament,
    title: str = "Round 1 Match A",
) -> Match:
    m = Match(
        tournament_id=tournament.id,
        title=title,
        match_number=1,
        round_number=1,
        scheduled_start_time=datetime.now(timezone.utc) + timedelta(hours=1),
        status=MatchStatus.SCHEDULED,
    )
    db.add(m)
    db.flush()
    return m


def _register_player(
    db: Session,
    tournament: Tournament,
    player: User,
    *,
    status: ParticipantStatus = ParticipantStatus.CHECKED_IN,
) -> TournamentParticipant:
    p = TournamentParticipant(
        tournament_id=tournament.id,
        user_id=player.id,
        status=status,
    )
    db.add(p)
    tournament.current_participants += 1
    db.flush()
    return p


# ---------------------------------------------------------------------------
# 1. Authenticated Encryption Tests
# ---------------------------------------------------------------------------

def test_credential_encryption_roundtrip():
    """Verify that encrypting and decrypting with AES-256-GCM restores the original strings."""
    plain_room = "BGMI_ROOM_98765"
    plain_pass = "SecurePass#2026!"

    cipher_room = encrypt_credential(plain_room)
    cipher_pass = encrypt_credential(plain_pass)

    assert cipher_room != plain_room
    assert cipher_pass != plain_pass

    decrypted_room = decrypt_credential(cipher_room)
    decrypted_pass = decrypt_credential(cipher_pass)

    assert decrypted_room == plain_room
    assert decrypted_pass == plain_pass


def test_encryption_uses_unique_nonces():
    """Encrypting the exact same plaintext twice produces different ciphertexts."""
    plain = "IDENTICAL_SECRET_VALUE"
    c1 = encrypt_credential(plain)
    c2 = encrypt_credential(plain)
    assert c1 != c2
    assert decrypt_credential(c1) == plain
    assert decrypt_credential(c2) == plain


def test_tampered_ciphertext_fails_decryption():
    """Modifying even a single character in the ciphertext or auth tag causes decryption failure."""
    ciphertext = encrypt_credential("ROOM_1234")
    # Mutate a character in the middle
    tampered = ciphertext[:-4] + ("A" if ciphertext[-4] != "A" else "B") + ciphertext[-3:]
    with pytest.raises(Exception):
        decrypt_credential(tampered)


# ---------------------------------------------------------------------------
# 2. Match Creation & Organizer Ownership
# ---------------------------------------------------------------------------

def test_organizer_can_create_match_for_own_tournament(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("m_org1", "m_org1@gb.com", role=UserRole.ORGANIZER)
    tournament = _create_tournament(db_session, organizer)
    headers = auth_headers(organizer)

    payload = {
        "title": "Group A - Match 1",
        "match_number": 1,
        "round_number": 1,
        "scheduled_start_time": _future(120).isoformat(),
    }
    resp = client.post(
        f"/api/v1/tournaments/{tournament.id}/matches",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Group A - Match 1"
    assert data["status"] == "scheduled"
    assert data["has_credentials"] is False


def test_cross_organizer_cannot_create_match(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Organizer B cannot create matches for Organizer A's tournament."""
    org_a = create_user("m_org_a", "m_orga@gb.com", role=UserRole.ORGANIZER)
    org_b = create_user("m_org_b", "m_orgb@gb.com", role=UserRole.ORGANIZER)
    tournament_a = _create_tournament(db_session, org_a)

    headers_b = auth_headers(org_b)
    payload = {
        "title": "Unauthorized Match",
        "match_number": 1,
        "round_number": 1,
        "scheduled_start_time": _future(120).isoformat(),
    }
    resp = client.post(
        f"/api/v1/tournaments/{tournament_a.id}/matches",
        json=payload,
        headers=headers_b,
    )
    assert resp.status_code == 403
    assert "You do not own this tournament" in resp.json()["detail"]


def test_player_cannot_create_match(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("m_org2", "m_org2@gb.com", role=UserRole.ORGANIZER)
    player = create_user("m_player1", "m_player1@gb.com", role=UserRole.PLAYER)
    tournament = _create_tournament(db_session, organizer)

    headers = auth_headers(player)
    payload = {
        "title": "Player Created Match",
        "match_number": 1,
        "round_number": 1,
        "scheduled_start_time": _future(120).isoformat(),
    }
    resp = client.post(
        f"/api/v1/tournaments/{tournament.id}/matches",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 3. Secret Leakage Prevention in Public Endpoints
# ---------------------------------------------------------------------------

def test_public_endpoints_never_leak_secrets(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Verifies that public match lists and match details never leak room ID or password."""
    organizer = create_user("m_org3", "m_org3@gb.com", role=UserRole.ORGANIZER)
    tournament = _create_tournament(db_session, organizer)
    match = _create_match(db_session, tournament)

    secret_room_id = "ULTRA_SECRET_ROOM_42"
    secret_password = "ULTRA_SECRET_PASS_99"

    # Set credentials via organizer
    headers = auth_headers(organizer)
    cred_payload = {
        "room_id": secret_room_id,
        "room_password": secret_password,
        "release_at": _past(5).isoformat(),
        "expires_at": _future(60).isoformat(),
    }
    resp = client.post(
        f"/api/v1/matches/{match.id}/credentials",
        json=cred_payload,
        headers=headers,
    )
    assert resp.status_code == 200

    # 1. Public list endpoint
    list_resp = client.get(f"/api/v1/tournaments/{tournament.id}/matches")
    assert list_resp.status_code == 200
    list_text = list_resp.text
    assert secret_room_id not in list_text
    assert secret_password not in list_text
    assert "room_password" not in list_text
    assert "encrypted_room_id" not in list_text

    # 2. Public detail endpoint
    detail_resp = client.get(f"/api/v1/matches/{match.id}")
    assert detail_resp.status_code == 200
    detail_text = detail_resp.text
    assert secret_room_id not in detail_text
    assert secret_password not in detail_text
    assert "room_password" not in detail_text
    assert "encrypted_room_id" not in detail_text

    # has_credentials should be True
    assert detail_resp.json()["has_credentials"] is True


# ---------------------------------------------------------------------------
# 4. Credential Configuration & Cross-Organizer Security
# ---------------------------------------------------------------------------

def test_cross_organizer_cannot_set_credentials(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    org_a = create_user("m_org_a2", "m_orga2@gb.com", role=UserRole.ORGANIZER)
    org_b = create_user("m_org_b2", "m_orgb2@gb.com", role=UserRole.ORGANIZER)
    tournament_a = _create_tournament(db_session, org_a)
    match = _create_match(db_session, tournament_a)

    headers_b = auth_headers(org_b)
    payload = {
        "room_id": "STOLEN_ROOM",
        "room_password": "STOLEN_PASS",
        "release_at": _past(10).isoformat(),
        "expires_at": _future(30).isoformat(),
    }
    resp = client.post(
        f"/api/v1/matches/{match.id}/credentials",
        json=payload,
        headers=headers_b,
    )
    assert resp.status_code == 403
    assert "You do not own this tournament" in resp.json()["detail"]


def test_invalid_credential_window_rejected(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """release_at >= expires_at must be rejected with 422."""
    organizer = create_user("m_org4", "m_org4@gb.com", role=UserRole.ORGANIZER)
    tournament = _create_tournament(db_session, organizer)
    match = _create_match(db_session, tournament)

    headers = auth_headers(organizer)
    payload = {
        "room_id": "ROOM_1",
        "room_password": "PASS_1",
        "release_at": _future(60).isoformat(),
        "expires_at": _future(30).isoformat(),  # expires before release!
    }
    resp = client.post(
        f"/api/v1/matches/{match.id}/credentials",
        json=payload,
        headers=headers,
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 5. Access Control & Release/Expiry Window Gating
# ---------------------------------------------------------------------------

def test_unauthenticated_cannot_get_credentials(
    client: TestClient, db_session: Session, create_user: Callable
):
    organizer = create_user("m_org5", "m_org5@gb.com", role=UserRole.ORGANIZER)
    tournament = _create_tournament(db_session, organizer)
    match = _create_match(db_session, tournament)

    resp = client.get(f"/api/v1/matches/{match.id}/credentials")
    assert resp.status_code in (401, 403)


def test_unregistered_player_cannot_get_credentials(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("m_org6", "m_org6@gb.com", role=UserRole.ORGANIZER)
    tournament = _create_tournament(db_session, organizer)
    match = _create_match(db_session, tournament)

    # Set valid credentials
    cred = MatchCredential(
        match_id=match.id,
        encrypted_room_id=encrypt_credential("ROOM_A"),
        encrypted_room_password=encrypt_credential("PASS_A"),
        release_at=_past(10),
        expires_at=_future(30),
    )
    db_session.add(cred)
    db_session.flush()

    unregistered_player = create_user("m_p_unreg", "unreg@gb.com", role=UserRole.PLAYER)
    headers = auth_headers(unregistered_player)

    resp = client.get(f"/api/v1/matches/{match.id}/credentials", headers=headers)
    assert resp.status_code == 403
    assert "not registered for this tournament" in resp.json()["detail"]


def test_registered_but_unchecked_player_cannot_get_credentials(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Player with status REGISTERED (not CHECKED_IN) must be denied access."""
    organizer = create_user("m_org7", "m_org7@gb.com", role=UserRole.ORGANIZER)
    tournament = _create_tournament(db_session, organizer)
    match = _create_match(db_session, tournament)

    cred = MatchCredential(
        match_id=match.id,
        encrypted_room_id=encrypt_credential("ROOM_B"),
        encrypted_room_password=encrypt_credential("PASS_B"),
        release_at=_past(10),
        expires_at=_future(30),
    )
    db_session.add(cred)
    db_session.flush()

    player = create_user("m_p_unchecked", "unchecked@gb.com", role=UserRole.PLAYER)
    _register_player(db_session, tournament, player, status=ParticipantStatus.REGISTERED)

    headers = auth_headers(player)
    resp = client.get(f"/api/v1/matches/{match.id}/credentials", headers=headers)
    assert resp.status_code == 403
    assert "Only checked-in participants" in resp.json()["detail"]


def test_early_access_rejected_before_release(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Accessing credentials before release_at must return 400."""
    organizer = create_user("m_org8", "m_org8@gb.com", role=UserRole.ORGANIZER)
    tournament = _create_tournament(db_session, organizer)
    match = _create_match(db_session, tournament)

    # Window in future
    cred = MatchCredential(
        match_id=match.id,
        encrypted_room_id=encrypt_credential("ROOM_FUTURE"),
        encrypted_room_password=encrypt_credential("PASS_FUTURE"),
        release_at=_future(30),
        expires_at=_future(60),
    )
    db_session.add(cred)
    db_session.flush()

    player = create_user("m_p_early", "early@gb.com", role=UserRole.PLAYER)
    _register_player(db_session, tournament, player, status=ParticipantStatus.CHECKED_IN)

    headers = auth_headers(player)
    resp = client.get(f"/api/v1/matches/{match.id}/credentials", headers=headers)
    assert resp.status_code == 400
    assert "not yet available" in resp.json()["detail"]


def test_expired_access_rejected_after_expiry(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Accessing credentials after expires_at must return 400."""
    organizer = create_user("m_org9", "m_org9@gb.com", role=UserRole.ORGANIZER)
    tournament = _create_tournament(db_session, organizer)
    match = _create_match(db_session, tournament)

    # Window in past
    cred = MatchCredential(
        match_id=match.id,
        encrypted_room_id=encrypt_credential("ROOM_PAST"),
        encrypted_room_password=encrypt_credential("PASS_PAST"),
        release_at=_past(60),
        expires_at=_past(10),
    )
    db_session.add(cred)
    db_session.flush()

    player = create_user("m_p_late", "late@gb.com", role=UserRole.PLAYER)
    _register_player(db_session, tournament, player, status=ParticipantStatus.CHECKED_IN)

    headers = auth_headers(player)
    resp = client.get(f"/api/v1/matches/{match.id}/credentials", headers=headers)
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"]


def test_checked_in_player_retrieves_credentials_during_window(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Checked-in player within [release_at, expires_at] receives decrypted room ID and password."""
    organizer = create_user("m_org10", "m_org10@gb.com", role=UserRole.ORGANIZER)
    tournament = _create_tournament(db_session, organizer)
    match = _create_match(db_session, tournament)

    expected_room = "BGMI_LOBBY_777"
    expected_pass = "ChickenDinner#1"

    cred = MatchCredential(
        match_id=match.id,
        encrypted_room_id=encrypt_credential(expected_room),
        encrypted_room_password=encrypt_credential(expected_pass),
        release_at=_past(10),
        expires_at=_future(30),
    )
    db_session.add(cred)
    db_session.flush()

    player = create_user("m_p_valid", "valid@gb.com", role=UserRole.PLAYER)
    _register_player(db_session, tournament, player, status=ParticipantStatus.CHECKED_IN)

    headers = auth_headers(player)
    resp = client.get(f"/api/v1/matches/{match.id}/credentials", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["match_id"] == match.id
    assert data["room_id"] == expected_room
    assert data["room_password"] == expected_pass


def test_organizer_owner_can_always_view_credentials(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Tournament owner organizer can view credentials anytime (even before player release window)."""
    organizer = create_user("m_org11", "m_org11@gb.com", role=UserRole.ORGANIZER)
    tournament = _create_tournament(db_session, organizer)
    match = _create_match(db_session, tournament)

    cred = MatchCredential(
        match_id=match.id,
        encrypted_room_id=encrypt_credential("ORG_ROOM"),
        encrypted_room_password=encrypt_credential("ORG_PASS"),
        release_at=_future(120),  # Not yet released to players
        expires_at=_future(180),
    )
    db_session.add(cred)
    db_session.flush()

    headers = auth_headers(organizer)
    resp = client.get(f"/api/v1/matches/{match.id}/credentials", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["room_id"] == "ORG_ROOM"


# ---------------------------------------------------------------------------
# 6. Match Roster Management
# ---------------------------------------------------------------------------

def test_add_and_remove_match_participant(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("m_org12", "m_org12@gb.com", role=UserRole.ORGANIZER)
    tournament = _create_tournament(db_session, organizer)
    match = _create_match(db_session, tournament)
    player = create_user("m_p_slot", "slot@gb.com", role=UserRole.PLAYER)
    tp = _register_player(db_session, tournament, player, status=ParticipantStatus.CHECKED_IN)

    headers = auth_headers(organizer)

    # 1. Add participant to match
    add_resp = client.post(
        f"/api/v1/matches/{match.id}/participants",
        json={"tournament_participant_id": tp.id, "slot_number": 5},
        headers=headers,
    )
    assert add_resp.status_code == 201
    mp_id = add_resp.json()["id"]
    assert add_resp.json()["slot_number"] == 5

    # 2. Duplicate participant in same match is rejected
    dup_resp = client.post(
        f"/api/v1/matches/{match.id}/participants",
        json={"tournament_participant_id": tp.id, "slot_number": 6},
        headers=headers,
    )
    assert dup_resp.status_code == 400
    assert "already assigned" in dup_resp.json()["detail"]

    # 3. Check participant restriction enforcement: another checked-in player not assigned to this match gets 403
    other_player = create_user("m_p_other", "other@gb.com", role=UserRole.PLAYER)
    _register_player(db_session, tournament, other_player, status=ParticipantStatus.CHECKED_IN)
    cred = MatchCredential(
        match_id=match.id,
        encrypted_room_id=encrypt_credential("SLOT_ROOM"),
        encrypted_room_password=encrypt_credential("SLOT_PASS"),
        release_at=_past(10),
        expires_at=_future(30),
    )
    db_session.add(cred)
    db_session.flush()

    other_headers = auth_headers(other_player)
    other_resp = client.get(f"/api/v1/matches/{match.id}/credentials", headers=other_headers)
    assert other_resp.status_code == 403
    assert "not assigned to this match" in other_resp.json()["detail"]

    # 4. Assigned player CAN retrieve credentials
    assigned_headers = auth_headers(player)
    assigned_resp = client.get(f"/api/v1/matches/{match.id}/credentials", headers=assigned_headers)
    assert assigned_resp.status_code == 200
    assert assigned_resp.json()["room_id"] == "SLOT_ROOM"

    # 5. Remove participant from match
    del_resp = client.delete(
        f"/api/v1/matches/{match.id}/participants/{mp_id}",
        headers=headers,
    )
    assert del_resp.status_code == 200
