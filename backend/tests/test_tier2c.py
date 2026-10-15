from datetime import datetime, timedelta, timezone
from typing import Callable
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.match import MatchStatus
from app.models.submission import MatchResult, SubmissionStatus
from app.models.tournament import ParticipantStatus, TournamentFormat, TournamentStatus
from app.models.user import UserRole


def _tournament_payload(title: str = "Tier 2C Championship", **overrides):
    now = datetime.now(timezone.utc)
    data = {
        "title": title,
        "description": "Tier 2C Battle Royale Championship",
        "game_title": "BGMI",
        "format": "solo",
        "max_participants": 32,
        "registration_deadline": (now + timedelta(days=2)).isoformat(),
        "check_in_deadline": (now + timedelta(days=2, hours=1)).isoformat(),
        "start_datetime": (now + timedelta(days=2, hours=2)).isoformat(),
        "rules": "Fair play only. Strictly no emulation or cheats.",
        "prize_pool_description": "Exclusive Community Trophy",
    }
    data.update(overrides)
    return data


def test_unverified_organizer_cannot_create_tournament(
    client: TestClient, create_user: Callable, auth_headers: Callable
):
    """Unverified organizers are blocked from creating tournaments with 403."""
    unverified_org = create_user(
        "tier2c_unv_org",
        "unv@gamerbrac.com",
        role=UserRole.ORGANIZER,
        is_verified=False,
    )
    headers = auth_headers(unverified_org)
    resp = client.post("/api/v1/tournaments", json=_tournament_payload(), headers=headers)
    assert resp.status_code == 403
    assert "pending admin approval" in resp.json()["detail"].lower()


def test_admin_approves_organizer_and_enables_creation(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Admin approves pending organizer, allowing them to create tournaments."""
    admin = create_user("tier2c_admin", "admin@gamerbrac.com", role=UserRole.ADMIN)
    org = create_user(
        "tier2c_pending_org2",
        "pending2@gamerbrac.com",
        role=UserRole.ORGANIZER,
        is_verified=False,
    )

    admin_headers = auth_headers(admin)
    org_headers = auth_headers(org)

    # 1. Check pending organizers list
    pending_resp = client.get("/api/v1/admin/organizers/pending", headers=admin_headers)
    assert pending_resp.status_code == 200
    pending_ids = [u["id"] for u in pending_resp.json()]
    assert org.id in pending_ids

    # 2. Approve organizer
    approve_resp = client.post(f"/api/v1/admin/organizers/{org.id}/approve", headers=admin_headers)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["is_verified"] is True

    # 3. Verified organizer creates tournament successfully
    create_resp = client.post(
        "/api/v1/tournaments",
        json=_tournament_payload("Approved Org Cup"),
        headers=org_headers,
    )
    assert create_resp.status_code == 201
    assert create_resp.json()["organizer_id"] == org.id


def test_organizer_lifecycle_and_participant_management(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Test full tournament lifecycle progression and organizer participant moderation."""
    org = create_user("tier2c_org_life", "life@gamerbrac.com", role=UserRole.ORGANIZER, is_verified=True)
    player = create_user("tier2c_player1", "p1@gamerbrac.com", role=UserRole.PLAYER)

    org_headers = auth_headers(org)
    player_headers = auth_headers(player)

    # 1. Create tournament in DRAFT
    create_resp = client.post(
        "/api/v1/tournaments",
        json=_tournament_payload("Lifecycle Tournament"),
        headers=org_headers,
    )
    assert create_resp.status_code == 201
    t_id = create_resp.json()["id"]

    # 2. Filter tournaments by organizer_id
    filter_resp = client.get(f"/api/v1/tournaments?organizer_id={org.id}")
    assert filter_resp.status_code == 200
    assert any(t["id"] == t_id for t in filter_resp.json())

    # 3. Advance to REGISTRATION_OPEN
    status_resp = client.patch(
        f"/api/v1/tournaments/{t_id}/status",
        json={"status": "registration_open"},
        headers=org_headers,
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "registration_open"

    # 4. Player registers
    reg_resp = client.post(f"/api/v1/tournaments/{t_id}/register", json={}, headers=player_headers)
    assert reg_resp.status_code == 201
    part_id = reg_resp.json()["id"]

    # 5. Advance to REGISTRATION_CLOSED then CHECK_IN
    client.patch(
        f"/api/v1/tournaments/{t_id}/status",
        json={"status": "registration_closed"},
        headers=org_headers,
    )
    client.patch(
        f"/api/v1/tournaments/{t_id}/status",
        json={"status": "check_in"},
        headers=org_headers,
    )

    # 6. Organizer manually checks in participant
    check_in_resp = client.patch(
        f"/api/v1/tournaments/{t_id}/participants/{part_id}/status",
        json={"status": "checked_in"},
        headers=org_headers,
    )
    assert check_in_resp.status_code == 200
    assert check_in_resp.json()["status"] == "checked_in"

    # 7. Organizer advances to ONGOING
    ongoing_resp = client.patch(
        f"/api/v1/tournaments/{t_id}/status",
        json={"status": "ongoing"},
        headers=org_headers,
    )
    assert ongoing_resp.status_code == 200

    # 8. Organizer disqualifies participant
    disqualify_resp = client.patch(
        f"/api/v1/tournaments/{t_id}/participants/{part_id}/status",
        json={"status": "disqualified"},
        headers=org_headers,
    )
    assert disqualify_resp.status_code == 200
    assert disqualify_resp.json()["status"] == "disqualified"

    # 9. Complete tournament (terminal state)
    comp_resp = client.patch(
        f"/api/v1/tournaments/{t_id}/status",
        json={"status": "completed"},
        headers=org_headers,
    )
    assert comp_resp.status_code == 200
    assert comp_resp.json()["status"] == "completed"

    # 10. Attempting to transition from COMPLETED is rejected
    invalid_resp = client.patch(
        f"/api/v1/tournaments/{t_id}/status",
        json={"status": "ongoing"},
        headers=org_headers,
    )
    assert invalid_resp.status_code == 400


def test_match_scheduling_and_credentials_dispatch(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Test match creation, slot assignment, and encrypted credential configuration."""
    org = create_user("tier2c_org_cred", "cred@gamerbrac.com", role=UserRole.ORGANIZER, is_verified=True)
    org_headers = auth_headers(org)

    # 1. Create tournament
    t_resp = client.post(
        "/api/v1/tournaments",
        json=_tournament_payload("Match Scheduling Event"),
        headers=org_headers,
    )
    t_id = t_resp.json()["id"]

    # 2. Schedule match
    now = datetime.now(timezone.utc)
    match_payload = {
        "title": "Grand Finals - Map 1 (Erangel)",
        "match_number": 1,
        "round_number": 1,
        "scheduled_start_time": (now + timedelta(hours=2)).isoformat(),
    }
    m_resp = client.post(
        f"/api/v1/tournaments/{t_id}/matches",
        json=match_payload,
        headers=org_headers,
    )
    assert m_resp.status_code == 201
    m_id = m_resp.json()["id"]

    # 3. Configure AES-256-GCM encrypted room credentials with release/expiry windows
    cred_payload = {
        "room_id": "BGMI-CUSTOM-ROOM-8821",
        "room_password": "SecurePassword#2026",
        "release_at": (now - timedelta(minutes=5)).isoformat(),
        "expires_at": (now + timedelta(hours=3)).isoformat(),
    }
    set_cred_resp = client.post(
        f"/api/v1/matches/{m_id}/credentials",
        json=cred_payload,
        headers=org_headers,
    )
    assert set_cred_resp.status_code == 200

    # 4. Organizer views decrypted credentials
    get_cred_resp = client.get(f"/api/v1/matches/{m_id}/credentials", headers=org_headers)
    assert get_cred_resp.status_code == 200
    assert get_cred_resp.json()["room_id"] == "BGMI-CUSTOM-ROOM-8821"
    assert get_cred_resp.json()["room_password"] == "SecurePassword#2026"


def test_admin_user_moderation_and_reports(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Test admin listing users, suspending accounts, reactivating, and resolving reports."""
    admin = create_user("tier2c_superadmin", "superadmin@gamerbrac.com", role=UserRole.ADMIN)
    target_user = create_user("bad_actor", "bad@gamerbrac.com", role=UserRole.PLAYER)
    reporter = create_user("reporter_user", "reporter@gamerbrac.com", role=UserRole.PLAYER)

    admin_headers = auth_headers(admin)
    reporter_headers = auth_headers(reporter)

    # 1. Admin lists users
    users_resp = client.get("/api/v1/admin/users?role=player", headers=admin_headers)
    assert users_resp.status_code == 200
    usernames = [u["username"] for u in users_resp.json()]
    assert target_user.username in usernames

    # 2. Admin suspends target user
    suspend_resp = client.post(
        f"/api/v1/admin/users/{target_user.id}/suspend",
        json={"reason": "Exploiting game physics glitch during tournament."},
        headers=admin_headers,
    )
    assert suspend_resp.status_code == 200
    assert suspend_resp.json()["is_active"] is False

    # 3. Admin reactivates target user
    reactivate_resp = client.post(
        f"/api/v1/admin/users/{target_user.id}/reactivate",
        headers=admin_headers,
    )
    assert reactivate_resp.status_code == 200
    assert reactivate_resp.json()["is_active"] is True

    # 4. Player submits report
    report_resp = client.post(
        "/api/v1/admin/reports",
        json={
            "reported_user_id": target_user.id,
            "category": "cheating",
            "description": "Suspected wallhack in semi-finals match.",
        },
        headers=reporter_headers,
    )
    assert report_resp.status_code == 201
    report_id = report_resp.json()["id"]

    # 5. Admin lists reports
    reports_resp = client.get("/api/v1/admin/reports", headers=admin_headers)
    assert reports_resp.status_code == 200
    assert any(r["id"] == report_id for r in reports_resp.json())

    # 6. Admin resolves report
    resolve_resp = client.patch(
        f"/api/v1/admin/reports/{report_id}/resolve",
        json={
            "status": "resolved",
            "resolution_notes": "Reviewed match recording and issued formal warning.",
        },
        headers=admin_headers,
    )
    assert resolve_resp.status_code == 200
    assert resolve_resp.json()["status"] == "resolved"

    # 7. Admin queries audit logs
    audit_resp = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert audit_resp.status_code == 200
    actions = [a["action"] for a in audit_resp.json()]
    assert "user_suspended" in actions
    assert "user_reactivated" in actions
    assert "report_resolved" in actions
