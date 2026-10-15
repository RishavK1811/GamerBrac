from fastapi.testclient import TestClient


def test_get_and_update_player_profile(client: TestClient, create_user, auth_headers):
    user = create_user(username="profiler", email="profiler@gamerbrac.com")
    headers = auth_headers(user)

    # Initial profile get
    res = client.get("/api/v1/players/profile", headers=headers)
    assert res.status_code == 200
    assert res.json()["display_name"] == "profiler"

    # Update profile
    update_payload = {
        "display_name": "GodL_Profiler",
        "bio": "Competitive Fragger | Free Fire MAX & BGMI",
        "phone_number": "+91 9876543210",
        "state_region": "Maharashtra",
    }
    update_res = client.put("/api/v1/players/profile", json=update_payload, headers=headers)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["display_name"] == "GodL_Profiler"
    assert updated_data["state_region"] == "Maharashtra"
    assert updated_data["bio"] == "Competitive Fragger | Free Fire MAX & BGMI"


def test_link_supported_game_accounts(client: TestClient, create_user, auth_headers):
    user = create_user(username="multi_title_pro", email="multi@gamerbrac.com")
    headers = auth_headers(user)

    # 1. Link Free Fire MAX
    ff_res = client.post(
        "/api/v1/players/game-accounts",
        json={
            "game_title": "Free Fire MAX",
            "in_game_name": "FireDemon_99",
            "in_game_id": "FF-UID-987654321",
        },
        headers=headers,
    )
    assert ff_res.status_code == 201
    assert ff_res.json()["game_title"] == "Free Fire MAX"

    # 2. Link BGMI
    bgmi_res = client.post(
        "/api/v1/players/game-accounts",
        json={
            "game_title": "BGMI",
            "in_game_name": "Mortal_Vibe",
            "in_game_id": "5123456789",
        },
        headers=headers,
    )
    assert bgmi_res.status_code == 201

    # 3. Link VALORANT
    val_res = client.post(
        "/api/v1/players/game-accounts",
        json={
            "game_title": "VALORANT",
            "in_game_name": "JettReaver",
            "in_game_id": "Jett#IND1",
        },
        headers=headers,
    )
    assert val_res.status_code == 201

    # List all linked accounts
    list_res = client.get("/api/v1/players/game-accounts", headers=headers)
    assert list_res.status_code == 200
    accounts = list_res.json()
    assert len(accounts) == 3
    titles = [a["game_title"] for a in accounts]
    assert "Free Fire MAX" in titles
    assert "BGMI" in titles
    assert "VALORANT" in titles


def test_link_unsupported_game_title_fails(client: TestClient, create_user, auth_headers):
    user = create_user(username="fake_gamer", email="fake@gamerbrac.com")
    headers = auth_headers(user)

    res = client.post(
        "/api/v1/players/game-accounts",
        json={
            "game_title": "Fortnite",  # Unsupported
            "in_game_name": "FortnitePro",
            "in_game_id": "FN-1234",
        },
        headers=headers,
    )
    assert res.status_code == 422


def test_prevent_duplicate_game_title_for_same_player(client: TestClient, create_user, auth_headers):
    user = create_user(username="duplicate_title_user", email="duptitle@gamerbrac.com")
    headers = auth_headers(user)

    # First link BGMI
    res1 = client.post(
        "/api/v1/players/game-accounts",
        json={
            "game_title": "BGMI",
            "in_game_name": "FirstIGN",
            "in_game_id": "5111111111",
        },
        headers=headers,
    )
    assert res1.status_code == 201

    # Attempt to link second BGMI account
    res2 = client.post(
        "/api/v1/players/game-accounts",
        json={
            "game_title": "BGMI",
            "in_game_name": "SecondIGN",
            "in_game_id": "5222222222",
        },
        headers=headers,
    )
    assert res2.status_code == 400
    assert "already linked an account for 'bgmi'" in res2.json()["detail"].lower()


def test_prevent_duplicate_game_uid_across_different_players(client: TestClient, create_user, auth_headers):
    player1 = create_user(username="player_alpha", email="alpha@gamerbrac.com")
    player2 = create_user(username="player_beta", email="beta@gamerbrac.com")

    # Player 1 links Free Fire UID
    res1 = client.post(
        "/api/v1/players/game-accounts",
        json={
            "game_title": "Free Fire MAX",
            "in_game_name": "AlphaSniper",
            "in_game_id": "FF-GLOBAL-1000",
        },
        headers=auth_headers(player1),
    )
    assert res1.status_code == 201

    # Player 2 attempts to claim the same UID
    res2 = client.post(
        "/api/v1/players/game-accounts",
        json={
            "game_title": "Free Fire MAX",
            "in_game_name": "ImposterAlpha",
            "in_game_id": "FF-GLOBAL-1000",
        },
        headers=auth_headers(player2),
    )
    assert res2.status_code == 400
    assert "already registered to another player" in res2.json()["detail"].lower()


def test_unlink_game_account(client: TestClient, create_user, auth_headers):
    player = create_user(username="unlink_player", email="unlink@gamerbrac.com")
    headers = auth_headers(player)

    create_res = client.post(
        "/api/v1/players/game-accounts",
        json={
            "game_title": "VALORANT",
            "in_game_name": "ViperMain",
            "in_game_id": "Viper#SEA",
        },
        headers=headers,
    )
    account_id = create_res.json()["id"]

    # Delete
    del_res = client.delete(f"/api/v1/players/game-accounts/{account_id}", headers=headers)
    assert del_res.status_code == 200

    # Verify deleted
    list_res = client.get("/api/v1/players/game-accounts", headers=headers)
    assert len(list_res.json()) == 0
