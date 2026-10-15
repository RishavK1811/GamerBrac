from fastapi.testclient import TestClient


def test_create_team_success(client: TestClient, create_user, auth_headers):
    captain = create_user(username="team_captain", email="captain@gamerbrac.com")
    headers = auth_headers(captain)

    payload = {
        "name": "Team Soul India",
        "tag": "SOUL",
        "primary_game": "BGMI",
        "logo_url": "https://example.com/soul.png",
    }
    response = client.post("/api/v1/teams", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Team Soul India"
    assert data["tag"] == "SOUL"
    assert data["captain_id"] == captain.id
    assert len(data["members"]) == 1
    assert data["members"][0]["username"] == "team_captain"
    assert data["members"][0]["role"] == "captain"


def test_create_team_duplicate_name_fails(client: TestClient, create_user, auth_headers):
    captain1 = create_user(username="c1", email="c1@gamerbrac.com")
    captain2 = create_user(username="c2", email="c2@gamerbrac.com")

    payload1 = {
        "name": "GodLike Esports",
        "tag": "GODL",
        "primary_game": "BGMI",
    }
    res1 = client.post("/api/v1/teams", json=payload1, headers=auth_headers(captain1))
    assert res1.status_code == 201

    payload2 = {
        "name": "godlike esports",  # Case-insensitive duplicate name
        "tag": "GLK",
        "primary_game": "BGMI",
    }
    res2 = client.post("/api/v1/teams", json=payload2, headers=auth_headers(captain2))
    assert res2.status_code == 400
    assert "already taken" in res2.json()["detail"].lower()


def test_create_team_duplicate_tag_fails(client: TestClient, create_user, auth_headers):
    captain1 = create_user(username="cap_a", email="capa@gamerbrac.com")
    captain2 = create_user(username="cap_b", email="capb@gamerbrac.com")

    res1 = client.post(
        "/api/v1/teams",
        json={"name": "Entity Gaming", "tag": "ENT", "primary_game": "BGMI"},
        headers=auth_headers(captain1),
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/v1/teams",
        json={"name": "Entertainers Clan", "tag": "ent", "primary_game": "Free Fire MAX"},
        headers=auth_headers(captain2),
    )
    assert res2.status_code == 400
    assert "tag 'ent' is already taken" in res2.json()["detail"].lower()


def test_captain_can_add_team_member(client: TestClient, create_user, auth_headers):
    captain = create_user(username="recruiter", email="recruiter@gamerbrac.com")
    recruit = create_user(username="newbie", email="newbie@gamerbrac.com")

    # Create team
    team_res = client.post(
        "/api/v1/teams",
        json={"name": "Reckoning Esports", "tag": "RCK", "primary_game": "VALORANT"},
        headers=auth_headers(captain),
    )
    team_id = team_res.json()["id"]

    # Captain adds recruit
    add_res = client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"username_or_email": "newbie", "role": "player"},
        headers=auth_headers(captain),
    )
    assert add_res.status_code == 201
    member_data = add_res.json()
    assert member_data["username"] == "newbie"
    assert member_data["role"] == "player"

    # Verify team roster has 2 members
    get_res = client.get(f"/api/v1/teams/{team_id}")
    assert len(get_res.json()["members"]) == 2


def test_non_captain_cannot_add_team_member(client: TestClient, create_user, auth_headers):
    captain = create_user(username="real_captain", email="real@gamerbrac.com")
    random_user = create_user(username="random_guy", email="random@gamerbrac.com")
    target_recruit = create_user(username="target_player", email="target@gamerbrac.com")

    team_res = client.post(
        "/api/v1/teams",
        json={"name": "Secret Org", "tag": "SCRT", "primary_game": "VALORANT"},
        headers=auth_headers(captain),
    )
    team_id = team_res.json()["id"]

    # Random non-captain tries to add member
    res = client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"username_or_email": "target_player", "role": "player"},
        headers=auth_headers(random_user),
    )
    assert res.status_code == 403
    assert "only the team captain" in res.json()["detail"].lower()


def test_add_duplicate_team_member_fails(client: TestClient, create_user, auth_headers):
    captain = create_user(username="dup_captain", email="dupcap@gamerbrac.com")
    member = create_user(username="dup_recruit", email="duprecruit@gamerbrac.com")

    team_res = client.post(
        "/api/v1/teams",
        json={"name": "Duplication Crew", "tag": "DUP", "primary_game": "BGMI"},
        headers=auth_headers(captain),
    )
    team_id = team_res.json()["id"]

    # Add recruit first time
    res1 = client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"username_or_email": "dup_recruit", "role": "player"},
        headers=auth_headers(captain),
    )
    assert res1.status_code == 201

    # Attempt adding second time
    res2 = client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"username_or_email": "dup_recruit", "role": "substitute"},
        headers=auth_headers(captain),
    )
    assert res2.status_code == 400
    assert "already a member" in res2.json()["detail"].lower()


def test_captain_cannot_remove_self(client: TestClient, create_user, auth_headers):
    captain = create_user(username="stubborn_captain", email="stubborn@gamerbrac.com")

    team_res = client.post(
        "/api/v1/teams",
        json={"name": "Lone Captain Squad", "tag": "LONE", "primary_game": "Free Fire MAX"},
        headers=auth_headers(captain),
    )
    team_id = team_res.json()["id"]

    # Captain tries to remove self
    res = client.delete(f"/api/v1/teams/{team_id}/members/{captain.id}", headers=auth_headers(captain))
    assert res.status_code == 400
    assert "captain cannot be removed" in res.json()["detail"].lower()


def test_captain_can_remove_member_and_member_can_leave(client: TestClient, create_user, auth_headers):
    captain = create_user(username="boss_cap", email="bosscap@gamerbrac.com")
    player1 = create_user(username="kicked_p1", email="kicked@gamerbrac.com")
    player2 = create_user(username="leaving_p2", email="leaving@gamerbrac.com")

    team_res = client.post(
        "/api/v1/teams",
        json={"name": "Action Squad", "tag": "ACT", "primary_game": "BGMI"},
        headers=auth_headers(captain),
    )
    team_id = team_res.json()["id"]

    # Add both players
    client.post(f"/api/v1/teams/{team_id}/members", json={"username_or_email": "kicked_p1"}, headers=auth_headers(captain))
    client.post(f"/api/v1/teams/{team_id}/members", json={"username_or_email": "leaving_p2"}, headers=auth_headers(captain))

    # 1. Captain kicks player 1
    kick_res = client.delete(f"/api/v1/teams/{team_id}/members/{player1.id}", headers=auth_headers(captain))
    assert kick_res.status_code == 200

    # 2. Player 2 leaves voluntarily
    leave_res = client.delete(f"/api/v1/teams/{team_id}/members/{player2.id}", headers=auth_headers(player2))
    assert leave_res.status_code == 200

    # Verify only captain remains
    get_res = client.get(f"/api/v1/teams/{team_id}")
    assert len(get_res.json()["members"]) == 1
