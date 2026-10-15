from datetime import datetime, timedelta, timezone
from typing import Callable
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.tournament_config import (
    ALLOWED_ENTRY_FEES_PER_PLAYER,
    GAME_BGMI,
    GAME_FREE_FIRE,
    GAME_VALORANT,
    TOURNAMENT_MODES,
    calculate_prize_pool,
    calculate_rank_distribution,
    calculate_team_entry_fee,
    get_min_participation_target,
    get_team_size,
)
from app.models.player import SupportedGame
from app.models.team import Team, TeamMember, TeamRole
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

def _create_org(create_user: Callable, name: str = "sys_org") -> User:
    return create_user(name, f"{name}@gamerbrac.com", role=UserRole.ORGANIZER, is_verified=True)


def _create_full_team(
    db: Session,
    captain: User,
    create_user: Callable,
    name: str,
    tag: str,
    game: str,
    size: int,
) -> Team:
    """Creates a team with exact roster size (1 captain + (size - 1) players)."""
    team = Team(
        name=name,
        tag=tag,
        primary_game=game,
        captain_id=captain.id,
    )
    db.add(team)
    db.flush()

    # Add captain as member
    c_member = TeamMember(team_id=team.id, user_id=captain.id, role=TeamRole.CAPTAIN)
    db.add(c_member)

    # Add other members
    for i in range(1, size):
        member_user = create_user(f"{tag.lower()}_mem_{i}", f"{tag.lower()}_mem_{i}@gamerbrac.com", role=UserRole.PLAYER)
        m = TeamMember(team_id=team.id, user_id=member_user.id, role=TeamRole.PLAYER)
        db.add(m)

    db.commit()
    db.refresh(team)
    return team


# ---------------------------------------------------------------------------
# 1. Authoritative Game Modes & Exact Capacities
# ---------------------------------------------------------------------------

def test_authoritative_game_modes_and_capacities_config():
    """Verify exact capacities specified for Free Fire MAX, BGMI, and VALORANT."""
    # Free Fire MAX
    ff = TOURNAMENT_MODES[GAME_FREE_FIRE]
    assert ff["squad"]["max_teams"] == 13
    assert ff["squad"]["team_size"] == 4
    assert ff["squad"]["max_player_slots"] == 52
    assert ff["duo"]["max_teams"] == 25
    assert ff["duo"]["team_size"] == 2
    assert ff["duo"]["max_player_slots"] == 50
    assert ff["solo"]["max_teams"] == 50
    assert ff["solo"]["team_size"] == 1
    assert ff["solo"]["max_player_slots"] == 50

    # BGMI
    bgmi = TOURNAMENT_MODES[GAME_BGMI]
    assert bgmi["solo"]["max_teams"] == 100
    assert bgmi["solo"]["team_size"] == 1
    assert bgmi["solo"]["max_player_slots"] == 100
    assert bgmi["squad"]["max_teams"] == 25
    assert bgmi["squad"]["team_size"] == 4
    assert bgmi["squad"]["max_player_slots"] == 100
    assert bgmi["duo"]["max_teams"] == 50
    assert bgmi["duo"]["team_size"] == 2
    assert bgmi["duo"]["max_player_slots"] == 100

    # VALORANT (Strictly 1v1 Solo and 2v2 Duo)
    val = TOURNAMENT_MODES[GAME_VALORANT]
    assert set(val.keys()) == {"solo", "duo"}
    assert val["solo"]["max_teams"] == 50
    assert val["solo"]["team_size"] == 1
    assert val["solo"]["max_player_slots"] == 50
    assert val["solo"]["min_teams_30pct"] == 15
    assert val["solo"]["min_players_30pct"] == 15

    assert val["duo"]["max_teams"] == 25
    assert val["duo"]["team_size"] == 2
    assert val["duo"]["max_player_slots"] == 50
    assert val["duo"]["min_teams_30pct"] == 8
    assert val["duo"]["min_players_30pct"] == 16


def test_modes_config_public_endpoint(client: TestClient):
    """GET /api/v1/tournaments/modes/config returns authoritative modes, entry tiers, and gate."""
    resp = client.get("/api/v1/tournaments/modes/config")
    assert resp.status_code == 200
    data = resp.json()

    assert data["allowed_entry_fees_per_player"] == [0, 5, 10, 25, 50]
    assert data["paid_tournaments_enabled"] is False

    modes = {(m["game_title"], m["format"]): m for m in data["modes"]}
    assert modes[("Free Fire MAX", "squad")]["max_teams"] == 13
    assert modes[("Free Fire MAX", "squad")]["max_player_slots"] == 52
    assert modes[("Free Fire MAX", "duo")]["max_teams"] == 25
    assert modes[("Free Fire MAX", "duo")]["max_player_slots"] == 50
    assert modes[("Free Fire MAX", "solo")]["max_teams"] == 50
    assert modes[("BGMI", "solo")]["max_teams"] == 100
    assert modes[("BGMI", "squad")]["max_teams"] == 25
    assert modes[("BGMI", "duo")]["max_teams"] == 50
    assert modes[("VALORANT", "solo")]["max_teams"] == 50
    assert modes[("VALORANT", "solo")]["max_player_slots"] == 50
    assert modes[("VALORANT", "duo")]["max_teams"] == 25
    assert modes[("VALORANT", "duo")]["max_player_slots"] == 50
    assert ("VALORANT", "5v5") not in modes


# ---------------------------------------------------------------------------
# 2. Complete Team Requirements & Incomplete Team Exclusion
# ---------------------------------------------------------------------------

def test_complete_team_registration_enforcement(
    client: TestClient,
    db_session: Session,
    create_user: Callable,
    auth_headers: Callable,
):
    """When require_complete_teams is True, teams with insufficient members are rejected with 400."""
    org = _create_org(create_user, "org_comp1")
    cap = create_user("cap_comp1", "cap_comp1@gamerbrac.com", role=UserRole.PLAYER)
    now = datetime.now(timezone.utc)

    # Create squad tournament (requires 4 members) with require_complete_teams=True
    resp_create = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Strict Squad Cup",
            "game_title": "Free Fire MAX",
            "format": "squad",
            "max_participants": 13,
            "registration_deadline": (now + timedelta(days=2)).isoformat(),
            "start_datetime": (now + timedelta(days=5)).isoformat(),
            "is_free_entry": True,
            "require_complete_teams": True,
        },
        headers=auth_headers(org),
    )
    assert resp_create.status_code == 201
    t_id = resp_create.json()["id"]

    # Open registration
    client.patch(f"/api/v1/tournaments/{t_id}/status", json={"status": "registration_open"}, headers=auth_headers(org))

    # Create incomplete team (only 2 members out of 4)
    team_incomplete = _create_full_team(db_session, cap, create_user, "Incomplete Squad", "INC", "Free Fire MAX", size=2)

    # Attempt to register incomplete team
    resp_reg = client.post(
        f"/api/v1/tournaments/{t_id}/register",
        json={"team_id": team_incomplete.id},
        headers=auth_headers(cap),
    )
    assert resp_reg.status_code == 400
    assert "at least 4 members are required" in resp_reg.json()["detail"]


def test_incomplete_teams_excluded_from_confirmed_entries_and_prize_pool(
    client: TestClient,
    db_session: Session,
    create_user: Callable,
    auth_headers: Callable,
):
    """Incomplete squads or duos are excluded from confirmed team entries."""
    org = _create_org(create_user, "org_incomp_ex")
    cap1 = create_user("cap_full_1", "cap_f1@gamerbrac.com", role=UserRole.PLAYER)
    cap2 = create_user("cap_part_2", "cap_p2@gamerbrac.com", role=UserRole.PLAYER)
    now = datetime.now(timezone.utc)

    # Squad tournament with require_complete_teams=False
    t = Tournament(
        title="Open Squad Cup",
        game_title="BGMI",
        format=TournamentFormat.SQUAD,
        status=TournamentStatus.REGISTRATION_OPEN,
        max_participants=25,
        current_participants=0,
        registration_deadline=now + timedelta(days=2),
        start_datetime=now + timedelta(days=5),
        organizer_id=org.id,
        is_free_entry=True,
        require_complete_teams=False,
    )
    db_session.add(t)
    db_session.commit()

    # Team 1: Complete (4 members)
    team1 = _create_full_team(db_session, cap1, create_user, "Full Squad One", "FS1", "BGMI", size=4)
    # Team 2: Incomplete (1 member)
    team2 = _create_full_team(db_session, cap2, create_user, "Solo Squad Two", "SS2", "BGMI", size=1)

    # Register both teams
    reg1 = client.post(f"/api/v1/tournaments/{t.id}/register", json={"team_id": team1.id}, headers=auth_headers(cap1))
    assert reg1.status_code == 201

    reg2 = client.post(f"/api/v1/tournaments/{t.id}/register", json={"team_id": team2.id}, headers=auth_headers(cap2))
    assert reg2.status_code == 201

    # Fetch tournament details
    resp = client.get(f"/api/v1/tournaments/{t.id}")
    assert resp.status_code == 200
    data = resp.json()

    # Total registrations = 2, but confirmed complete entries = 1!
    assert data["current_participants"] == 2
    assert data["confirmed_entries_count"] == 1
    assert data["confirmed_players_count"] == 4


# ---------------------------------------------------------------------------
# 3. Entry Fee Calculations & Fixed published rate
# ---------------------------------------------------------------------------

def test_entry_fee_multipliers_and_tiers():
    """Verify ₹5, ₹10, ₹25, ₹50 tiers across Solo, Duo, and Squad (VALORANT strictly 1v1 & 2v2)."""
    for fee in [5, 10, 25, 50]:
        assert calculate_team_entry_fee(fee, "Free Fire MAX", "solo") == fee * 1
        assert calculate_team_entry_fee(fee, "Free Fire MAX", "duo") == fee * 2
        assert calculate_team_entry_fee(fee, "Free Fire MAX", "squad") == fee * 4
        assert calculate_team_entry_fee(fee, "VALORANT", "solo") == fee * 1
        assert calculate_team_entry_fee(fee, "VALORANT", "duo") == fee * 2

    # VALORANT 2v2 specific calculations: ₹5 -> ₹10, ₹10 -> ₹20, ₹25 -> ₹50, ₹50 -> ₹100
    assert calculate_team_entry_fee(5, "VALORANT", "duo") == 10
    assert calculate_team_entry_fee(10, "VALORANT", "duo") == 20
    assert calculate_team_entry_fee(25, "VALORANT", "duo") == 50
    assert calculate_team_entry_fee(50, "VALORANT", "duo") == 100

    # Specific prompt examples
    assert calculate_team_entry_fee(5, "BGMI", "squad") == 20   # ₹5/player squad = ₹20
    assert calculate_team_entry_fee(10, "BGMI", "duo") == 20    # ₹10/player duo = ₹20
    assert calculate_team_entry_fee(25, "BGMI", "squad") == 100 # ₹25/player squad = ₹100
    assert calculate_team_entry_fee(50, "BGMI", "duo") == 100   # ₹50/player duo = ₹100


def test_entry_fee_locked_once_published(
    client: TestClient,
    db_session: Session,
    create_user: Callable,
    auth_headers: Callable,
):
    """An entry tier cannot be altered once registration opens."""
    org = _create_org(create_user, "org_lock_fee")
    now = datetime.now(timezone.utc)

    # Create paid tournament in draft
    resp = client.post(
        "/api/v1/tournaments",
        json={
            "title": "Paid Lock Cup",
            "game_title": "BGMI",
            "format": "solo",
            "max_participants": 100,
            "registration_deadline": (now + timedelta(days=2)).isoformat(),
            "start_datetime": (now + timedelta(days=5)).isoformat(),
            "is_free_entry": False,
            "entry_fee_per_player": 25,
        },
        headers=auth_headers(org),
    )
    assert resp.status_code == 201
    t_id = resp.json()["id"]

    # Open registration
    client.patch(f"/api/v1/tournaments/{t_id}/status", json={"status": "registration_open"}, headers=auth_headers(org))

    # Attempt to change entry fee after registration opened
    update_resp = client.put(
        f"/api/v1/tournaments/{t_id}",
        json={"entry_fee_per_player": 50},
        headers=auth_headers(org),
    )
    assert update_resp.status_code == 400
    assert "entry fee cannot be modified after registration opens" in update_resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 4. Prize Pool & Deterministic Largest-Remainder Distribution
# ---------------------------------------------------------------------------

def test_prize_pool_formula_and_deterministic_largest_remainder():
    """
    Prize pool = floor(65% * eligible confirmed collected entry fees).
    Payouts = 50%, 25%, 15%, 7%, 3% using deterministic largest-remainder rounding.
    Sum of rank payouts must strictly equal prize_pool.
    """
    # 25 squads of ₹25/player = 25 * ₹100 = ₹2,500 gross.
    # Prize pool = floor(0.65 * 2500) = ₹1,625. Reserve = ₹875.
    gross, pool, reserve = calculate_prize_pool(25, 25, "BGMI", "squad")
    assert gross == 2500
    assert pool == 1625
    assert reserve == 875
    assert pool + reserve == gross

    ranks = calculate_rank_distribution(pool, is_team_format=True)
    assert len(ranks) == 5
    assert sum(r["amount"] for r in ranks) == pool
    assert ranks[0]["rank"] == 1 and ranks[0]["percentage"] == 50.0
    assert ranks[1]["rank"] == 2 and ranks[1]["percentage"] == 25.0
    assert ranks[2]["rank"] == 3 and ranks[2]["percentage"] == 15.0
    assert ranks[3]["rank"] == 4 and ranks[3]["percentage"] == 7.0
    assert ranks[4]["rank"] == 5 and ranks[4]["percentage"] == 3.0

    # Test edge cases where remainders have fractional tokens
    for test_pool in [0, 1, 3, 7, 10, 65, 100, 650, 1625, 5200]:
        dist = calculate_rank_distribution(test_pool)
        assert sum(r["amount"] for r in dist) == test_pool
        assert all(isinstance(r["amount"], int) for r in dist)
        assert all(r["amount"] >= 0 for r in dist)


# ---------------------------------------------------------------------------
# 5. Minimum 30% Participation Rule
# ---------------------------------------------------------------------------

def test_minimum_30_percent_participation_targets():
    """Verify ceiling(30% capacity) targets specified in prompt."""
    # Free Fire MAX Squad (cap 13): 4 complete teams, 16 players
    teams, players = get_min_participation_target(GAME_FREE_FIRE, "squad", 13)
    assert teams == 4 and players == 16

    # Free Fire MAX Duo (cap 25): 8 complete teams, 16 players
    teams, players = get_min_participation_target(GAME_FREE_FIRE, "duo", 25)
    assert teams == 8 and players == 16

    # Free Fire MAX Solo (cap 50): 15 players
    teams, players = get_min_participation_target(GAME_FREE_FIRE, "solo", 50)
    assert teams == 15 and players == 15

    # BGMI Solo (cap 100): 30 players
    teams, players = get_min_participation_target(GAME_BGMI, "solo", 100)
    assert teams == 30 and players == 30

    # BGMI Squad (cap 25): 8 complete teams, 32 players
    teams, players = get_min_participation_target(GAME_BGMI, "squad", 25)
    assert teams == 8 and players == 32

    # BGMI Duo (cap 50): 15 complete teams, 30 players
    teams, players = get_min_participation_target(GAME_BGMI, "duo", 50)
    assert teams == 15 and players == 30

    # VALORANT 1v1 Solo (cap 50): 15 players (ceiling of 30% of 50)
    teams, players = get_min_participation_target(GAME_VALORANT, "solo", 50)
    assert teams == 15 and players == 15

    # VALORANT 2v2 Duo (cap 25): 8 complete teams (ceiling of 30% of 25), 16 players
    teams, players = get_min_participation_target(GAME_VALORANT, "duo", 25)
    assert teams == 8 and players == 16


def test_valorant_rejects_unsupported_formats(
    client: TestClient,
    db_session: Session,
    create_user: Callable,
    auth_headers: Callable,
):
    """VALORANT only supports 'solo' (1v1) and 'duo' (2v2); other formats must be rejected."""
    org = _create_org(create_user, "org_val_unsupported")
    now = datetime.now(timezone.utc)
    resp = client.post(
        "/api/v1/tournaments",
        headers=auth_headers(org),
        json={
            "title": "Invalid VALORANT 5v5 Cup",
            "description": "Attempting to create 5v5 tournament",
            "game_title": "VALORANT",
            "format": "5v5",
            "max_participants": 16,
            "is_free_entry": True,
            "registration_deadline": (now + timedelta(days=2)).isoformat(),
            "start_datetime": (now + timedelta(days=3)).isoformat(),
        },
    )
    assert resp.status_code == 422
    assert "Format '5v5' is not supported for 'VALORANT'" in resp.json()["detail"]


def test_30_percent_participation_enforcement_at_status_transition(
    client: TestClient,
    db_session: Session,
    create_user: Callable,
    auth_headers: Callable,
):
    """Paid tournament cannot advance to check_in or ongoing if 30% threshold is unmet."""
    org = _create_org(create_user, "org_30pct")
    player1 = create_user("p1_30", "p1_30@gamerbrac.com", role=UserRole.PLAYER)
    now = datetime.now(timezone.utc)

    # BGMI Solo paid tournament (requires 30 confirmed players)
    t = Tournament(
        title="BGMI Solo Paid Cup",
        game_title="BGMI",
        format=TournamentFormat.SOLO,
        status=TournamentStatus.REGISTRATION_OPEN,
        max_participants=100,
        current_participants=1,
        registration_deadline=now + timedelta(days=2),
        start_datetime=now + timedelta(days=5),
        organizer_id=org.id,
        is_free_entry=False,
        entry_fee_per_player=10,
    )
    db_session.add(t)
    db_session.flush()

    # Register only 1 player (target is 30)
    part = TournamentParticipant(
        tournament_id=t.id,
        user_id=player1.id,
        status=ParticipantStatus.REGISTERED,
    )
    db_session.add(part)
    db_session.commit()

    # Close registration
    client.patch(
        f"/api/v1/tournaments/{t.id}/status",
        json={"status": "registration_closed"},
        headers=auth_headers(org),
    )

    # Attempt to transition to check_in -> Must be rejected with 400
    resp_checkin = client.patch(
        f"/api/v1/tournaments/{t.id}/status",
        json={"status": "check_in"},
        headers=auth_headers(org),
    )
    assert resp_checkin.status_code == 400
    assert "Minimum 30% participation threshold not met" in resp_checkin.json()["detail"]
    assert "Tournament requires cancellation" in resp_checkin.json()["detail"]

    # Verify that organizer CAN cancel the tournament
    resp_cancel = client.patch(
        f"/api/v1/tournaments/{t.id}/status",
        json={"status": "cancelled"},
        headers=auth_headers(org),
    )
    assert resp_cancel.status_code == 200
    assert resp_cancel.json()["status"] == "cancelled"


# ---------------------------------------------------------------------------
# 6. Legal / Payment Feature Gate (PAID_TOURNAMENTS_ENABLED = False)
# ---------------------------------------------------------------------------

def test_paid_tournaments_feature_gate_blocks_real_monetary_transactions(
    client: TestClient,
    db_session: Session,
    create_user: Callable,
    auth_headers: Callable,
):
    """Paid tournament registration and checkout are strictly blocked by PAID_TOURNAMENTS_ENABLED=False."""
    assert settings.PAID_TOURNAMENTS_ENABLED is False

    org = _create_org(create_user, "org_gate")
    player = create_user("p_gate", "p_gate@gamerbrac.com", role=UserRole.PLAYER)
    now = datetime.now(timezone.utc)

    # Create paid tournament
    t = Tournament(
        title="Gate Test Paid Tournament",
        game_title="Free Fire MAX",
        format=TournamentFormat.SOLO,
        status=TournamentStatus.REGISTRATION_OPEN,
        max_participants=50,
        current_participants=0,
        registration_deadline=now + timedelta(days=2),
        start_datetime=now + timedelta(days=5),
        organizer_id=org.id,
        is_free_entry=False,
        entry_fee_per_player=25,
    )
    db_session.add(t)
    db_session.commit()

    # Player registration must return 403 Forbidden
    reg_resp = client.post(
        f"/api/v1/tournaments/{t.id}/register",
        json={},
        headers=auth_headers(player),
    )
    assert reg_resp.status_code == 403
    assert "PAID_TOURNAMENTS_ENABLED=False" in reg_resp.json()["detail"]

    # Checkout endpoint must return 403 Forbidden
    checkout_resp = client.post(
        f"/api/v1/tournaments/{t.id}/checkout",
        headers=auth_headers(player),
    )
    assert checkout_resp.status_code == 403
    assert "disabled on GamerBrac" in checkout_resp.json()["detail"]


# ---------------------------------------------------------------------------
# 7. Financial Preview Endpoint (Admin & Owner Organizer Only)
# ---------------------------------------------------------------------------

def test_financial_preview_endpoint(
    client: TestClient,
    db_session: Session,
    create_user: Callable,
    auth_headers: Callable,
):
    """GET /api/v1/tournaments/{id}/financial-preview returns 65% prize pool, 35% reserve, and warnings."""
    org = _create_org(create_user, "org_fin")
    other_org = _create_org(create_user, "org_other")
    admin = create_user("admin_fin", "admin_fin@gamerbrac.com", role=UserRole.ADMIN)
    now = datetime.now(timezone.utc)

    t = Tournament(
        title="Financial Preview Tournament",
        game_title="BGMI",
        format=TournamentFormat.SOLO,
        status=TournamentStatus.REGISTRATION_OPEN,
        max_participants=100,
        current_participants=0,
        registration_deadline=now + timedelta(days=2),
        start_datetime=now + timedelta(days=5),
        organizer_id=org.id,
        is_free_entry=False,
        entry_fee_per_player=50,
    )
    db_session.add(t)
    db_session.flush()

    # Register 40 confirmed players
    for i in range(40):
        p_user = create_user(f"fin_p_{i}", f"fin_p_{i}@gamerbrac.com", role=UserRole.PLAYER)
        part = TournamentParticipant(
            tournament_id=t.id,
            user_id=p_user.id,
            status=ParticipantStatus.REGISTERED,
        )
        db_session.add(part)
    t.current_participants = 40
    db_session.commit()

    # Other organizer cannot view financial preview (403)
    resp_unauth = client.get(
        f"/api/v1/tournaments/{t.id}/financial-preview",
        headers=auth_headers(other_org),
    )
    assert resp_unauth.status_code == 403

    # Owner organizer can view financial preview
    # 40 players * ₹50 = ₹2,000 gross.
    # Prize pool = floor(65% * 2000) = ₹1,300.
    # Reserve = 35% * 2000 = ₹700.
    resp = client.get(
        f"/api/v1/tournaments/{t.id}/financial-preview",
        headers=auth_headers(org),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["gross_collected_fees"] == 2000
    assert data["prize_pool"] == 1300
    assert data["reserve_amount"] == 700
    assert data["confirmed_entries"] == 40
    assert len(data["payout_allocations"]) == 5
    assert sum(a["amount"] for a in data["payout_allocations"]) == 1300
    assert data["cost_safety_warning"] is not None
    assert data["is_projection_complete"] is False

    # Pass expected costs: when costs exceed reserve (e.g. ₹900 > ₹700), show deficit warning
    resp_costs = client.get(
        f"/api/v1/tournaments/{t.id}/financial-preview?expected_costs=900",
        headers=auth_headers(admin),
    )
    assert resp_costs.status_code == 200
    data_costs = resp_costs.json()
    assert data_costs["is_projection_complete"] is True
    assert "Deficit risk of ₹200" in data_costs["cost_safety_warning"]
