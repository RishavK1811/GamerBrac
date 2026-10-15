from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.tournament import Tournament, TournamentStatus, ParticipantStatus
from app.models.user import UserRole


def test_my_teams_endpoint(client: TestClient, create_user, auth_headers):
    captain = create_user("cap_my_teams", "cap_my_teams@gb.com")
    member = create_user("mem_my_teams", "mem_my_teams@gb.com")
    outsider = create_user("out_my_teams", "out_my_teams@gb.com")

    # Captain creates team
    team_res = client.post(
        "/api/v1/teams",
        json={"name": "Alpha Squad", "tag": "ALPH", "primary_game": "BGMI"},
        headers=auth_headers(captain),
    )
    assert team_res.status_code == 201
    team_id = team_res.json()["id"]

    # Captain adds member
    client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"username_or_email": "mem_my_teams", "role": "player"},
        headers=auth_headers(captain),
    )

    # Captain queries /teams/my
    res_cap = client.get("/api/v1/teams/my", headers=auth_headers(captain))
    assert res_cap.status_code == 200
    assert len(res_cap.json()) == 1
    assert res_cap.json()[0]["name"] == "Alpha Squad"

    # Member queries /teams/my
    res_mem = client.get("/api/v1/teams/my", headers=auth_headers(member))
    assert res_mem.status_code == 200
    assert len(res_mem.json()) == 1
    assert res_mem.json()[0]["name"] == "Alpha Squad"

    # Outsider queries /teams/my
    res_out = client.get("/api/v1/teams/my", headers=auth_headers(outsider))
    assert res_out.status_code == 200
    assert len(res_out.json()) == 0


def test_roster_limit_enforced(client: TestClient, create_user, auth_headers):
    captain = create_user("cap_limit", "cap_limit@gb.com")

    # Create Free Fire MAX team (max 6 members)
    team_res = client.post(
        "/api/v1/teams",
        json={"name": "Fire Squad", "tag": "FIRE", "primary_game": "Free Fire MAX"},
        headers=auth_headers(captain),
    )
    team_id = team_res.json()["id"]

    # Add 5 more players (total 6 with captain)
    for i in range(1, 6):
        player = create_user(f"ff_ply_{i}", f"ff_ply_{i}@gb.com")
        add_res = client.post(
            f"/api/v1/teams/{team_id}/members",
            json={"username_or_email": player.username, "role": "player"},
            headers=auth_headers(captain),
        )
        assert add_res.status_code == 201

    # Attempting to add 7th member must be rejected
    extra_player = create_user("ff_extra", "ff_extra@gb.com")
    fail_res = client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"username_or_email": extra_player.username, "role": "player"},
        headers=auth_headers(captain),
    )
    assert fail_res.status_code == 400
    assert "roster is full" in fail_res.json()["detail"].lower()


def test_team_game_compatibility_enforced(
    client: TestClient, db_session: Session, create_user, auth_headers
):
    organizer = create_user("org_compat", "org_compat@gb.com", role=UserRole.ORGANIZER)
    captain = create_user("cap_compat", "cap_compat@gb.com")

    # Create BGMI squad tournament
    now = datetime.now(timezone.utc)
    t = Tournament(
        title="BGMI Pro League",
        game_title="BGMI",
        format="squad",
        status=TournamentStatus.REGISTRATION_OPEN,
        max_participants=16,
        current_participants=0,
        registration_deadline=now + timedelta(days=2),
        start_datetime=now + timedelta(days=3),
        organizer_id=organizer.id,
        is_free_entry=True,
    )
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)

    # Captain creates a VALORANT team
    val_team = client.post(
        "/api/v1/teams",
        json={"name": "Spike Squad", "tag": "SPIK", "primary_game": "VALORANT"},
        headers=auth_headers(captain),
    ).json()

    # Attempting to register VALORANT team for BGMI tournament must fail
    res = client.post(
        f"/api/v1/tournaments/{t.id}/register",
        json={"team_id": val_team["id"]},
        headers=auth_headers(captain),
    )
    assert res.status_code == 400
    assert "does not match tournament game" in res.json()["detail"]


def test_my_tournaments_endpoint(
    client: TestClient, db_session: Session, create_user, auth_headers
):
    organizer = create_user("org_mytourney", "org_mytourney@gb.com", role=UserRole.ORGANIZER)
    player = create_user("ply_mytourney", "ply_mytourney@gb.com")

    # Create tournament
    now = datetime.now(timezone.utc)
    t = Tournament(
        title="Solo Showdown India",
        game_title="Free Fire MAX",
        format="solo",
        status=TournamentStatus.REGISTRATION_OPEN,
        max_participants=30,
        current_participants=0,
        registration_deadline=now + timedelta(days=1),
        start_datetime=now + timedelta(days=2),
        organizer_id=organizer.id,
        is_free_entry=True,
    )
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)

    # Initially /tournaments/my is empty
    empty_res = client.get("/api/v1/tournaments/my", headers=auth_headers(player))
    assert empty_res.status_code == 200
    assert len(empty_res.json()) == 0

    # Player registers
    reg_res = client.post(
        f"/api/v1/tournaments/{t.id}/register",
        json={},
        headers=auth_headers(player),
    )
    assert reg_res.status_code == 201

    # Now /tournaments/my returns the registered tournament
    my_res = client.get("/api/v1/tournaments/my", headers=auth_headers(player))
    assert my_res.status_code == 200
    data = my_res.json()
    assert len(data) == 1
    assert data[0]["tournament_id"] == t.id
    assert data[0]["tournament_title"] == "Solo Showdown India"
    assert data[0]["participant_status"] == ParticipantStatus.REGISTERED.value


def test_duplicate_game_uid_conflict(client: TestClient, create_user, auth_headers):
    player1 = create_user("uid_p1", "uid_p1@gb.com")
    player2 = create_user("uid_p2", "uid_p2@gb.com")

    # Player 1 links UID
    p1_res = client.post(
        "/api/v1/players/game-accounts",
        json={"game_title": "BGMI", "in_game_name": "SniperGod", "in_game_id": "5512349912"},
        headers=auth_headers(player1),
    )
    assert p1_res.status_code == 201

    # Player 2 attempts to link the exact same UID
    p2_res = client.post(
        "/api/v1/players/game-accounts",
        json={"game_title": "BGMI", "in_game_name": "Imposter", "in_game_id": "5512349912"},
        headers=auth_headers(player2),
    )
    assert p2_res.status_code == 400
    assert "already registered to another player" in p2_res.json()["detail"].lower()


def test_player_profile_update(client: TestClient, create_user, auth_headers):
    player = create_user("profile_guy", "profile_guy@gb.com")

    update_payload = {
        "display_name": "Pro Sniper 2026",
        "bio": "Competitive BGMI and VALORANT fragger from Delhi.",
        "phone_number": "+91 9876543210",
        "state_region": "Delhi",
    }
    res = client.put(
        "/api/v1/players/profile",
        json=update_payload,
        headers=auth_headers(player),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["display_name"] == "Pro Sniper 2026"
    assert data["bio"] == "Competitive BGMI and VALORANT fragger from Delhi."
    assert data["phone_number"] == "+91 9876543210"
    assert data["state_region"] == "Delhi"
