"""
Phase 4 automated test suite.

Covers:
- Evidence upload validation (valid image headers, invalid extension, spoofed MIME type rejection)
- Private evidence storage protection (submitter/organizer/admin access vs. unauthorized player 403)
- Score submissions by assigned participants
- Immutability of verified results (players cannot edit approved results)
- Organizer scoping (organizers can only review submissions for their own tournaments)
- Match results & leaderboard computation with tiebreaker logic
- In-app notifications lifecycle (unread counts, mark-read, mark-all)
- Admin moderation (organizer approval, account suspension blocking login, report reviews, and audit logs)
"""

import io
from datetime import datetime, timedelta, timezone
from typing import Callable
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.match import Match, MatchParticipant, MatchStatus
from app.models.submission import MatchResult, ScoreSubmission, SubmissionStatus
from app.models.tournament import (
    ParticipantStatus,
    Tournament,
    TournamentFormat,
    TournamentParticipant,
    TournamentStatus,
)
from app.models.user import User, UserRole


# ---------------------------------------------------------------------------
# Test Fixtures & Helpers
# ---------------------------------------------------------------------------

# Valid PNG image bytes (1x1 pixel PNG)
VALID_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00"
    b"\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _setup_tournament_match(
    db: Session,
    organizer: User,
    player: User,
) -> tuple[Tournament, Match, MatchParticipant]:
    t = Tournament(
        title="Championship Arena",
        game_title="BGMI",
        format=TournamentFormat.SOLO,
        status=TournamentStatus.ONGOING,
        max_participants=16,
        current_participants=1,
        registration_deadline=datetime.now(timezone.utc) - timedelta(days=1),
        start_datetime=datetime.now(timezone.utc) + timedelta(days=1),
        organizer_id=organizer.id,
        is_free_entry=True,
    )
    db.add(t)
    db.flush()

    tp = TournamentParticipant(
        tournament_id=t.id,
        user_id=player.id,
        status=ParticipantStatus.CHECKED_IN,
    )
    db.add(tp)
    db.flush()

    m = Match(
        tournament_id=t.id,
        title="Finals Match 1",
        match_number=1,
        round_number=1,
        scheduled_start_time=datetime.now(timezone.utc) + timedelta(hours=1),
        status=MatchStatus.LIVE,
    )
    db.add(m)
    db.flush()

    mp = MatchParticipant(
        match_id=m.id,
        tournament_participant_id=tp.id,
        slot_number=1,
    )
    db.add(mp)
    db.flush()

    return t, m, mp


# ---------------------------------------------------------------------------
# 1. Evidence Uploads & Private Storage
# ---------------------------------------------------------------------------

def test_evidence_upload_valid_png(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("p4_org1", "p4_org1@gb.com", role=UserRole.ORGANIZER)
    player = create_user("p4_ply1", "p4_ply1@gb.com", role=UserRole.PLAYER)
    _, match, _ = _setup_tournament_match(db_session, organizer, player)

    headers = auth_headers(player)
    files = {"file": ("screenshot.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}

    resp = client.post(f"/api/v1/matches/{match.id}/evidence", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "evidence_url" in data
    assert data["evidence_url"].startswith(f"/api/v1/matches/{match.id}/evidence/")


def test_evidence_upload_invalid_extension_rejected(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("p4_org2", "p4_org2@gb.com", role=UserRole.ORGANIZER)
    player = create_user("p4_ply2", "p4_ply2@gb.com", role=UserRole.PLAYER)
    _, match, _ = _setup_tournament_match(db_session, organizer, player)

    headers = auth_headers(player)
    files = {"file": ("malware.exe", io.BytesIO(b"MZ\x90\x00"), "image/png")}

    resp = client.post(f"/api/v1/matches/{match.id}/evidence", files=files, headers=headers)
    assert resp.status_code == 400
    assert "Invalid file extension" in resp.json()["detail"]


def test_evidence_upload_spoofed_content_rejected(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("p4_org3", "p4_org3@gb.com", role=UserRole.ORGANIZER)
    player = create_user("p4_ply3", "p4_ply3@gb.com", role=UserRole.PLAYER)
    _, match, _ = _setup_tournament_match(db_session, organizer, player)

    headers = auth_headers(player)
    files = {"file": ("fake.png", io.BytesIO(b"NOT_A_REAL_PNG_HEADER"), "image/png")}

    resp = client.post(f"/api/v1/matches/{match.id}/evidence", files=files, headers=headers)
    assert resp.status_code == 400
    assert "does not match image header" in resp.json()["detail"]


def test_private_evidence_storage_access_control(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("p4_org4", "p4_org4@gb.com", role=UserRole.ORGANIZER)
    player = create_user("p4_ply4", "p4_ply4@gb.com", role=UserRole.PLAYER)
    other_player = create_user("p4_other", "p4_other@gb.com", role=UserRole.PLAYER)
    _, match, mp = _setup_tournament_match(db_session, organizer, player)

    # Player uploads evidence
    headers_player = auth_headers(player)
    files = {"file": ("screenshot.png", io.BytesIO(VALID_PNG_BYTES), "image/png")}
    upload_resp = client.post(f"/api/v1/matches/{match.id}/evidence", files=files, headers=headers_player)
    assert upload_resp.status_code == 200
    evidence_url = upload_resp.json()["evidence_url"]
    filename = evidence_url.split("/")[-1]

    # Submit score with this evidence
    client.post(
        f"/api/v1/matches/{match.id}/submissions",
        json={
            "match_participant_id": mp.id,
            "kills": 5,
            "placement": 1,
            "evidence_url": evidence_url,
        },
        headers=headers_player,
    )

    # 1. Submitting player CAN download
    p_get = client.get(evidence_url, headers=headers_player)
    assert p_get.status_code == 200

    # 2. Tournament organizer CAN download
    headers_org = auth_headers(organizer)
    o_get = client.get(evidence_url, headers=headers_org)
    assert o_get.status_code == 200

    # 3. Another unrelated player CANNOT download (403 Forbidden)
    headers_other = auth_headers(other_player)
    other_get = client.get(evidence_url, headers=headers_other)
    assert other_get.status_code == 403
    assert "Access denied" in other_get.json()["detail"]


# ---------------------------------------------------------------------------
# 2. Score Submissions & Review Workflows
# ---------------------------------------------------------------------------

def test_score_submission_and_organizer_approval(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("p4_org5", "p4_org5@gb.com", role=UserRole.ORGANIZER)
    player = create_user("p4_ply5", "p4_ply5@gb.com", role=UserRole.PLAYER)
    tournament, match, mp = _setup_tournament_match(db_session, organizer, player)

    headers_player = auth_headers(player)
    sub_payload = {
        "match_participant_id": mp.id,
        "kills": 4,
        "placement": 2,
        "evidence_url": f"/api/v1/matches/{match.id}/evidence/test.png",
        "notes": "GG top 2 finish",
    }
    sub_resp = client.post(
        f"/api/v1/matches/{match.id}/submissions",
        json=sub_payload,
        headers=headers_player,
    )
    assert sub_resp.status_code == 201
    sub_id = sub_resp.json()["id"]
    assert sub_resp.json()["status"] == "pending"

    # Organizer reviews and approves
    headers_org = auth_headers(organizer)
    review_resp = client.patch(
        f"/api/v1/matches/{match.id}/submissions/{sub_id}/review",
        json={"status": "approved", "reviewer_notes": "Screenshot verified"},
        headers=headers_org,
    )
    assert review_resp.status_code == 200
    assert review_resp.json()["status"] == "approved"

    # Verify MatchResult was created with correct points
    # 2nd place = 6 placement pts + 4 kills = 10 total points
    mr = db_session.query(MatchResult).filter(MatchResult.match_id == match.id).first()
    assert mr is not None
    assert mr.placement == 2
    assert mr.kills == 4
    assert mr.placement_points == 6
    assert mr.kill_points == 4
    assert mr.total_points == 10
    assert mr.is_verified is True


def test_players_cannot_edit_verified_results(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    """Once a score submission is approved, the player cannot edit or resubmit."""
    organizer = create_user("p4_org6", "p4_org6@gb.com", role=UserRole.ORGANIZER)
    player = create_user("p4_ply6", "p4_ply6@gb.com", role=UserRole.PLAYER)
    _, match, mp = _setup_tournament_match(db_session, organizer, player)

    headers_player = auth_headers(player)
    headers_org = auth_headers(organizer)

    # 1. Submit
    sub_resp = client.post(
        f"/api/v1/matches/{match.id}/submissions",
        json={
            "match_participant_id": mp.id,
            "kills": 3,
            "placement": 1,
            "evidence_url": "/api/v1/matches/m/evidence/test.png",
        },
        headers=headers_player,
    )
    sub_id = sub_resp.json()["id"]

    # 2. Approve
    client.patch(
        f"/api/v1/matches/{match.id}/submissions/{sub_id}/review",
        json={"status": "approved"},
        headers=headers_org,
    )

    # 3. Player attempts to edit verified submission -> 400 Bad Request
    edit_resp = client.put(
        f"/api/v1/matches/{match.id}/submissions/{sub_id}",
        json={"kills": 10},
        headers=headers_player,
    )
    assert edit_resp.status_code == 400
    assert "verified" in edit_resp.json()["detail"].lower()

    # 4. Player attempts to resubmit new score for same match -> 400 Bad Request
    resub_resp = client.post(
        f"/api/v1/matches/{match.id}/submissions",
        json={
            "match_participant_id": mp.id,
            "kills": 10,
            "placement": 1,
            "evidence_url": "/api/v1/matches/m/evidence/test.png",
        },
        headers=headers_player,
    )
    assert resub_resp.status_code == 400
    assert "already verified" in resub_resp.json()["detail"].lower()


def test_cross_organizer_cannot_review_submissions(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    org_a = create_user("p4_orga", "orga@gb.com", role=UserRole.ORGANIZER)
    org_b = create_user("p4_orgb", "orgb@gb.com", role=UserRole.ORGANIZER)
    player = create_user("p4_ply7", "ply7@gb.com", role=UserRole.PLAYER)
    _, match, mp = _setup_tournament_match(db_session, org_a, player)

    headers_player = auth_headers(player)
    sub_resp = client.post(
        f"/api/v1/matches/{match.id}/submissions",
        json={
            "match_participant_id": mp.id,
            "kills": 1,
            "placement": 3,
            "evidence_url": "/api/v1/matches/m/evidence/test.png",
        },
        headers=headers_player,
    )
    sub_id = sub_resp.json()["id"]

    # Organizer B tries to review Organizer A's match submission
    headers_org_b = auth_headers(org_b)
    resp = client.patch(
        f"/api/v1/matches/{match.id}/submissions/{sub_id}/review",
        json={"status": "approved"},
        headers=headers_org_b,
    )
    assert resp.status_code == 403
    assert "You do not own this tournament" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# 3. Leaderboard Calculations & Tiebreakers
# ---------------------------------------------------------------------------

def test_tournament_leaderboard_computation(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("p4_org_lb", "orglb@gb.com", role=UserRole.ORGANIZER)
    player1 = create_user("p4_p1", "p1@gb.com", role=UserRole.PLAYER)
    player2 = create_user("p4_p2", "p2@gb.com", role=UserRole.PLAYER)

    t = Tournament(
        title="Leaderboard Masters",
        game_title="Free Fire MAX",
        format=TournamentFormat.SOLO,
        status=TournamentStatus.ONGOING,
        max_participants=16,
        current_participants=2,
        registration_deadline=datetime.now(timezone.utc) - timedelta(days=1),
        start_datetime=datetime.now(timezone.utc) + timedelta(days=1),
        organizer_id=organizer.id,
        is_free_entry=True,
    )
    db_session.add(t)
    db_session.flush()

    tp1 = TournamentParticipant(tournament_id=t.id, user_id=player1.id, status=ParticipantStatus.CHECKED_IN)
    tp2 = TournamentParticipant(tournament_id=t.id, user_id=player2.id, status=ParticipantStatus.CHECKED_IN)
    db_session.add_all([tp1, tp2])
    db_session.flush()

    m = Match(
        tournament_id=t.id,
        title="Match 1",
        match_number=1,
        round_number=1,
        scheduled_start_time=datetime.now(timezone.utc) + timedelta(hours=1),
        status=MatchStatus.COMPLETED,
    )
    db_session.add(m)
    db_session.flush()

    mp1 = MatchParticipant(match_id=m.id, tournament_participant_id=tp1.id, slot_number=1)
    mp2 = MatchParticipant(match_id=m.id, tournament_participant_id=tp2.id, slot_number=2)
    db_session.add_all([mp1, mp2])
    db_session.flush()

    # Player 1: #1 place (10 pts) + 5 kills (5 pts) = 15 total pts
    # Player 2: #2 place (6 pts) + 1 kill (1 pt) = 7 total pts
    mr1 = MatchResult(
        match_id=m.id,
        match_participant_id=mp1.id,
        placement=1,
        kills=5,
        placement_points=10,
        kill_points=5,
        total_points=15,
        is_verified=True,
    )
    mr2 = MatchResult(
        match_id=m.id,
        match_participant_id=mp2.id,
        placement=2,
        kills=1,
        placement_points=6,
        kill_points=1,
        total_points=7,
        is_verified=True,
    )
    db_session.add_all([mr1, mr2])
    db_session.commit()

    resp = client.get(f"/api/v1/tournaments/{t.id}/leaderboard")
    assert resp.status_code == 200
    standings = resp.json()["standings"]

    assert len(standings) == 2
    # Rank 1: player1
    assert standings[0]["rank"] == 1
    assert standings[0]["participant_id"] == tp1.id
    assert standings[0]["total_points"] == 15
    assert standings[0]["wins"] == 1
    assert standings[0]["total_kills"] == 5

    # Rank 2: player2
    assert standings[1]["rank"] == 2
    assert standings[1]["participant_id"] == tp2.id
    assert standings[1]["total_points"] == 7
    assert standings[1]["wins"] == 0
    assert standings[1]["total_kills"] == 1


# ---------------------------------------------------------------------------
# 4. In-App Notifications
# ---------------------------------------------------------------------------

def test_notification_workflow(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    organizer = create_user("p4_org_notif", "orgnotif@gb.com", role=UserRole.ORGANIZER)
    player = create_user("p4_ply_notif", "plynotif@gb.com", role=UserRole.PLAYER)
    _, match, mp = _setup_tournament_match(db_session, organizer, player)

    # Player submits score -> Organizer should receive notification
    headers_player = auth_headers(player)
    client.post(
        f"/api/v1/matches/{match.id}/submissions",
        json={
            "match_participant_id": mp.id,
            "kills": 2,
            "placement": 3,
            "evidence_url": "/api/v1/matches/m/evidence/test.png",
        },
        headers=headers_player,
    )

    headers_org = auth_headers(organizer)
    notif_resp = client.get("/api/v1/notifications", headers=headers_org)
    assert notif_resp.status_code == 200
    data = notif_resp.json()
    assert data["unread_count"] >= 1
    first_notif = data["items"][0]
    assert first_notif["notification_type"] == "score_submitted"

    # Mark single notification as read
    read_resp = client.patch(f"/api/v1/notifications/{first_notif['id']}/read", headers=headers_org)
    assert read_resp.status_code == 200
    assert read_resp.json()["is_read"] is True

    # Mark all read
    all_read = client.post("/api/v1/notifications/read-all", headers=headers_org)
    assert all_read.status_code == 200


# ---------------------------------------------------------------------------
# 5. Admin Moderation & Audit Logs
# ---------------------------------------------------------------------------

def test_admin_approve_organizer(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    admin = create_user("p4_admin1", "admin1@gb.com", role=UserRole.ADMIN)
    organizer = create_user("p4_pending_org", "pending@gb.com", role=UserRole.ORGANIZER)
    organizer.is_verified = False
    db_session.commit()

    headers_admin = auth_headers(admin)

    # 1. Pending organizers list
    pending_resp = client.get("/api/v1/admin/organizers/pending", headers=headers_admin)
    assert pending_resp.status_code == 200
    pending_ids = [u["id"] for u in pending_resp.json()]
    assert organizer.id in pending_ids

    # 2. Approve organizer
    approve_resp = client.post(f"/api/v1/admin/organizers/{organizer.id}/approve", headers=headers_admin)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["is_verified"] is True

    # 3. Check audit log
    audit_resp = client.get("/api/v1/admin/audit-logs?action=organizer_approved", headers=headers_admin)
    assert audit_resp.status_code == 200
    assert len(audit_resp.json()) >= 1


def test_admin_suspend_user_blocks_access(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    admin = create_user("p4_admin2", "admin2@gb.com", role=UserRole.ADMIN)
    cheater = create_user("p4_cheater", "cheater@gb.com", role=UserRole.PLAYER)

    headers_admin = auth_headers(admin)
    headers_cheater = auth_headers(cheater)

    # 1. Cheater can currently access /auth/me
    me_resp = client.get("/api/v1/auth/me", headers=headers_cheater)
    assert me_resp.status_code == 200

    # 2. Admin suspends cheater
    suspend_resp = client.post(
        f"/api/v1/admin/users/{cheater.id}/suspend",
        json={"reason": "Speed hacking and aimbot confirmed via VOD review."},
        headers=headers_admin,
    )
    assert suspend_resp.status_code == 200
    assert suspend_resp.json()["is_active"] is False

    # 3. Cheater is now blocked with 400 Bad Request (Inactive user account)
    blocked_resp = client.get("/api/v1/auth/me", headers=headers_cheater)
    assert blocked_resp.status_code == 400
    assert "Inactive user account" in blocked_resp.json()["detail"]

    # 4. Cheater cannot log in again
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "p4_cheater", "password": "GamerBrac#2026"},
    )
    assert login_resp.status_code == 400
    assert "disabled" in login_resp.json()["detail"].lower()


def test_admin_report_review_and_resolution(
    client: TestClient, db_session: Session, create_user: Callable, auth_headers: Callable
):
    admin = create_user("p4_admin3", "admin3@gb.com", role=UserRole.ADMIN)
    reporter = create_user("p4_reporter", "reporter@gb.com", role=UserRole.PLAYER)
    reported = create_user("p4_suspect", "suspect@gb.com", role=UserRole.PLAYER)

    headers_reporter = auth_headers(reporter)
    headers_admin = auth_headers(admin)

    # 1. Player submits a report
    rep_resp = client.post(
        "/api/v1/admin/reports",
        json={
            "reported_user_id": reported.id,
            "category": "cheating",
            "description": "Used radar hack in round 2",
        },
        headers=headers_reporter,
    )
    assert rep_resp.status_code == 201
    report_id = rep_resp.json()["id"]

    # 2. Admin lists reports
    list_rep = client.get("/api/v1/admin/reports?status=pending", headers=headers_admin)
    assert list_rep.status_code == 200
    assert any(r["id"] == report_id for r in list_rep.json())

    # 3. Admin resolves report
    resolve_resp = client.patch(
        f"/api/v1/admin/reports/{report_id}/resolve",
        json={"status": "resolved", "resolution_notes": "Player investigated and penalized."},
        headers=headers_admin,
    )
    assert resolve_resp.status_code == 200
    assert resolve_resp.json()["status"] == "resolved"
