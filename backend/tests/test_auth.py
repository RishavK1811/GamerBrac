import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User, UserRole


def test_register_success(client: TestClient, db_session: Session):
    payload = {
        "username": "sniper_elite",
        "email": "sniper@gamerbrac.com",
        "password": "Password#123",
        "confirm_password": "Password#123",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "sniper_elite"
    assert data["user"]["role"] == "player"

    # Verify user saved in database with player profile
    user = db_session.query(User).filter(User.username == "sniper_elite").first()
    assert user is not None
    assert user.profile is not None
    assert user.profile.display_name == "sniper_elite"


def test_register_argon2id_password_hash(client: TestClient, db_session: Session):
    payload = {
        "username": "argon_warrior",
        "email": "warrior@gamerbrac.com",
        "password": "SecurePassword#99",
        "confirm_password": "SecurePassword#99",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201

    user = db_session.query(User).filter(User.username == "argon_warrior").first()
    assert user is not None
    # Verify hash starts with Argon2id identifier
    assert user.hashed_password.startswith("$argon2id$")
    assert "SecurePassword#99" not in user.hashed_password


def test_register_duplicate_username(client: TestClient, create_user):
    create_user(username="taken_user", email="original@gamerbrac.com")

    payload = {
        "username": "TAKEN_USER",  # Case insensitive test
        "email": "different@gamerbrac.com",
        "password": "Password#123",
        "confirm_password": "Password#123",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "username already exists" in response.json()["detail"].lower()


def test_register_duplicate_email(client: TestClient, create_user):
    create_user(username="user_one", email="duplicate@gamerbrac.com")

    payload = {
        "username": "user_two",
        "email": "DUPLICATE@GAMERBRAC.COM",  # Case insensitive test
        "password": "Password#123",
        "confirm_password": "Password#123",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "email address already exists" in response.json()["detail"].lower()


def test_prevent_self_role_escalation_at_registration(client: TestClient):
    # Attempting to assign admin role via payload must be forbidden by schema
    payload = {
        "username": "hacker_guy",
        "email": "hacker@gamerbrac.com",
        "password": "Password#123",
        "confirm_password": "Password#123",
        "role": "admin",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert "extra_forbidden" in str(response.json())


def test_register_password_complexity_validations(client: TestClient):
    base = {
        "username": "valid_user",
        "email": "valid@gamerbrac.com",
    }

    # Too short (< 8 chars)
    r = client.post("/api/v1/auth/register", json={**base, "password": "Pass#1", "confirm_password": "Pass#1"})
    assert r.status_code == 422

    # Missing uppercase
    r = client.post("/api/v1/auth/register", json={**base, "password": "password#123", "confirm_password": "password#123"})
    assert r.status_code == 422

    # Missing lowercase
    r = client.post("/api/v1/auth/register", json={**base, "password": "PASSWORD#123", "confirm_password": "PASSWORD#123"})
    assert r.status_code == 422

    # Missing digit
    r = client.post("/api/v1/auth/register", json={**base, "password": "Password#abc", "confirm_password": "Password#abc"})
    assert r.status_code == 422

    # Missing special char
    r = client.post("/api/v1/auth/register", json={**base, "password": "Password1234", "confirm_password": "Password1234"})
    assert r.status_code == 422

    # Password mismatch
    r = client.post("/api/v1/auth/register", json={**base, "password": "Password#123", "confirm_password": "Password#456"})
    assert r.status_code == 422


def test_login_success_with_username(client: TestClient, create_user):
    create_user(username="pro_gamer", email="pro@gamerbrac.com", password="ProPassword#123")

    response = client.post("/api/v1/auth/login", json={
        "username_or_email": "pro_gamer",
        "password": "ProPassword#123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["username"] == "pro_gamer"


def test_login_success_with_email(client: TestClient, create_user):
    create_user(username="email_gamer", email="myemail@gamerbrac.com", password="EmailPassword#123")

    response = client.post("/api/v1/auth/login", json={
        "username_or_email": "myemail@gamerbrac.com",
        "password": "EmailPassword#123",
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_invalid_password(client: TestClient, create_user):
    create_user(username="target_user", email="target@gamerbrac.com", password="TargetPassword#123")

    response = client.post("/api/v1/auth/login", json={
        "username_or_email": "target_user",
        "password": "WrongPassword#123",
    })
    assert response.status_code == 401
    assert "invalid username/email or password" in response.json()["detail"].lower()


def test_login_nonexistent_user(client: TestClient):
    response = client.post("/api/v1/auth/login", json={
        "username_or_email": "nonexistent_ghost",
        "password": "Password#123",
    })
    assert response.status_code == 401


def test_logout_and_token_revocation(client: TestClient, create_user):
    create_user(username="logout_user", email="logout@gamerbrac.com", password="LogoutPass#123")

    login_resp = client.post("/api/v1/auth/login", json={
        "username_or_email": "logout_user",
        "password": "LogoutPass#123",
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify token works on /me
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200

    # Logout
    logout_resp = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200

    # Verify same token is now rejected as revoked
    post_logout_resp = client.get("/api/v1/auth/me", headers=headers)
    assert post_logout_resp.status_code == 401
    assert "revoked" in post_logout_resp.json()["detail"].lower()


def test_current_user_me_unauthorized(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
