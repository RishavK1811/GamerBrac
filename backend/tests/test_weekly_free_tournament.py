"""
Tests for Weekly Free Tournament Enforcement and Paid / Entry Tournament Support.

Covers:
- At most 1 free tournament per calendar week in Asia/Kolkata timezone (Mon 00:00:00 to Sun 23:59:59.999999).
- Scheduling a second free tournament in the same Asia/Kolkata week returns HTTP 409 Conflict.
- Scheduling free tournaments in different weeks succeeds.
- Precise Asia/Kolkata boundaries: Sunday 23:59:59 IST vs Monday 00:00:00 IST are in different weeks.
- Paid tournaments (is_free_entry=False) do not trigger or violate the weekly free limit.
- Multiple paid tournaments in the same week are permitted.
- Updates without week change do not self-conflict.
- Updating start_datetime of a free tournament into an already-booked week returns HTTP 409.
- Updating is_free_entry from False to True in an already-booked week returns HTTP 409.
- Cancelled free tournaments do not block scheduling a new free tournament in that week.
- Authorization: Player / Unverified organizer cannot create tournaments (HTTP 403).
- Query filtering: GET /api/v1/tournaments?is_free_entry=true|false.
"""
from datetime import datetime, timedelta
from typing import Callable
import zoneinfo
import pytest
from fastapi.testclient import TestClient

from app.models.user import UserRole

KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")


def _make_tournament_payload(
    start_dt: datetime,
    is_free_entry: bool = True,
    title: str = "Weekly Free Cup",
) -> dict:
    reg_deadline = start_dt - timedelta(days=2)
    return {
        "title": title,
        "description": "Official community cup",
        "game_title": "BGMI",
        "format": "squad",
        "max_participants": 16,
        "registration_deadline": reg_deadline.isoformat(),
        "start_datetime": start_dt.isoformat(),
        "is_free_entry": is_free_entry,
        "rules": "Standard rules apply.",
    }


def test_create_single_free_tournament_succeeds(
    client: TestClient,
    create_user: Callable,
    auth_headers: Callable,
):
    organizer = create_user("org_w1", "org_w1@gb.com", role=UserRole.ORGANIZER, is_verified=True)
    headers = auth_headers(organizer)

    # Wednesday 14:00 IST in a future week
    start_dt = datetime(2027, 3, 10, 14, 0, 0, tzinfo=KOLKATA_TZ)
    payload = _make_tournament_payload(start_dt, is_free_entry=True, title="Week 10 Free Cup")

    resp = client.post("/api/v1/tournaments", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Week 10 Free Cup"
    assert data["is_free_entry"] is True


def test_create_second_free_tournament_in_same_week_fails_409(
    client: TestClient,
    create_user: Callable,
    auth_headers: Callable,
):
    organizer = create_user("org_w2", "org_w2@gb.com", role=UserRole.ORGANIZER, is_verified=True)
    headers = auth_headers(organizer)

    # Tuesday 10:00 IST
    tuesday_dt = datetime(2027, 3, 16, 10, 0, 0, tzinfo=KOLKATA_TZ)
    payload1 = _make_tournament_payload(tuesday_dt, is_free_entry=True, title="Tuesday Free Cup")
    resp1 = client.post("/api/v1/tournaments", json=payload1, headers=headers)
    assert resp1.status_code == 201

    # Friday 18:00 IST in the same calendar week
    friday_dt = datetime(2027, 3, 19, 18, 0, 0, tzinfo=KOLKATA_TZ)
    payload2 = _make_tournament_payload(friday_dt, is_free_entry=True, title="Friday Free Cup")
    resp2 = client.post("/api/v1/tournaments", json=payload2, headers=headers)
    assert resp2.status_code == 409
    detail = resp2.json()["detail"]
    assert "already scheduled" in detail
    assert "Tuesday Free Cup" in detail
    assert "Asia/Kolkata" in detail


def test_create_free_tournament_in_different_weeks_succeeds(
    client: TestClient,
    create_user: Callable,
    auth_headers: Callable,
):
    organizer = create_user("org_w3", "org_w3@gb.com", role=UserRole.ORGANIZER, is_verified=True)
    headers = auth_headers(organizer)

    # Week 1: Thursday
    w1_dt = datetime(2027, 4, 1, 15, 0, 0, tzinfo=KOLKATA_TZ)
    payload1 = _make_tournament_payload(w1_dt, is_free_entry=True, title="April Week 1 Free Cup")
    resp1 = client.post("/api/v1/tournaments", json=payload1, headers=headers)
    assert resp1.status_code == 201

    # Week 2: Wednesday of next week
    w2_dt = datetime(2027, 4, 7, 15, 0, 0, tzinfo=KOLKATA_TZ)
    payload2 = _make_tournament_payload(w2_dt, is_free_entry=True, title="April Week 2 Free Cup")
    resp2 = client.post("/api/v1/tournaments", json=payload2, headers=headers)
    assert resp2.status_code == 201


def test_boundary_sunday_night_vs_monday_morning(
    client: TestClient,
    create_user: Callable,
    auth_headers: Callable,
):
    organizer = create_user("org_w4", "org_w4@gb.com", role=UserRole.ORGANIZER, is_verified=True)
    headers = auth_headers(organizer)

    # Sunday 2027-05-02 23:59:59 IST (Week A)
    sunday_dt = datetime(2027, 5, 2, 23, 59, 59, tzinfo=KOLKATA_TZ)
    payload_sun = _make_tournament_payload(sunday_dt, is_free_entry=True, title="Sunday Finale Free")
    resp_sun = client.post("/api/v1/tournaments", json=payload_sun, headers=headers)
    assert resp_sun.status_code == 201

    # Monday 2027-05-03 00:00:00 IST (Week B - exactly next second / new week)
    monday_dt = datetime(2027, 5, 3, 0, 0, 0, tzinfo=KOLKATA_TZ)
    payload_mon = _make_tournament_payload(monday_dt, is_free_entry=True, title="Monday Opener Free")
    resp_mon = client.post("/api/v1/tournaments", json=payload_mon, headers=headers)
    assert resp_mon.status_code == 201

    # Another on Sunday 2027-05-02 18:00:00 IST should conflict with Week A
    same_sun_dt = datetime(2027, 5, 2, 18, 0, 0, tzinfo=KOLKATA_TZ)
    payload_conflict = _make_tournament_payload(same_sun_dt, is_free_entry=True, title="Sunday Afternoon Free")
    resp_conflict = client.post("/api/v1/tournaments", json=payload_conflict, headers=headers)
    assert resp_conflict.status_code == 409


def test_multiple_paid_tournaments_allowed_in_same_week(
    client: TestClient,
    create_user: Callable,
    auth_headers: Callable,
):
    organizer = create_user("org_w5", "org_w5@gb.com", role=UserRole.ORGANIZER, is_verified=True)
    headers = auth_headers(organizer)
    w_dt = datetime(2027, 6, 9, 14, 0, 0, tzinfo=KOLKATA_TZ)

    # 1 Free tournament
    resp_free = client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(w_dt, is_free_entry=True, title="Free Weekly"),
        headers=headers,
    )
    assert resp_free.status_code == 201

    # 1st Paid tournament in same week
    resp_paid1 = client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(w_dt + timedelta(hours=2), is_free_entry=False, title="Pro Series 1"),
        headers=headers,
    )
    assert resp_paid1.status_code == 201
    assert resp_paid1.json()["is_free_entry"] is False

    # 2nd Paid tournament in same week
    resp_paid2 = client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(w_dt + timedelta(hours=4), is_free_entry=False, title="Pro Series 2"),
        headers=headers,
    )
    assert resp_paid2.status_code == 201
    assert resp_paid2.json()["is_free_entry"] is False


def test_update_free_tournament_without_date_change_succeeds(
    client: TestClient,
    create_user: Callable,
    auth_headers: Callable,
):
    organizer = create_user("org_w6", "org_w6@gb.com", role=UserRole.ORGANIZER, is_verified=True)
    headers = auth_headers(organizer)
    dt = datetime(2027, 7, 14, 15, 0, 0, tzinfo=KOLKATA_TZ)
    resp = client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(dt, is_free_entry=True, title="Original Free Title"),
        headers=headers,
    )
    assert resp.status_code == 201
    tourney_id = resp.json()["id"]

    # Update title and max_participants
    update_resp = client.put(
        f"/api/v1/tournaments/{tourney_id}",
        json={"title": "Updated Free Title", "max_participants": 32},
        headers=headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Updated Free Title"
    assert update_resp.json()["max_participants"] == 32


def test_update_free_tournament_to_conflicting_week_fails_409(
    client: TestClient,
    create_user: Callable,
    auth_headers: Callable,
):
    organizer = create_user("org_w7", "org_w7@gb.com", role=UserRole.ORGANIZER, is_verified=True)
    headers = auth_headers(organizer)

    # Week 1
    w1_dt = datetime(2027, 8, 4, 15, 0, 0, tzinfo=KOLKATA_TZ)
    resp1 = client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(w1_dt, is_free_entry=True, title="Week 1 Boss"),
        headers=headers,
    )
    assert resp1.status_code == 201

    # Week 2
    w2_dt = datetime(2027, 8, 11, 15, 0, 0, tzinfo=KOLKATA_TZ)
    resp2 = client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(w2_dt, is_free_entry=True, title="Week 2 Free"),
        headers=headers,
    )
    assert resp2.status_code == 201
    w2_id = resp2.json()["id"]

    # Try moving Week 2 tournament into Week 1
    move_resp = client.put(
        f"/api/v1/tournaments/{w2_id}",
        json={"start_datetime": (w1_dt + timedelta(hours=3)).isoformat()},
        headers=headers,
    )
    assert move_resp.status_code == 409
    assert "already scheduled" in move_resp.json()["detail"]


def test_update_paid_to_free_in_booked_week_fails_409(
    client: TestClient,
    create_user: Callable,
    auth_headers: Callable,
):
    organizer = create_user("org_w8", "org_w8@gb.com", role=UserRole.ORGANIZER, is_verified=True)
    headers = auth_headers(organizer)
    dt = datetime(2027, 9, 8, 15, 0, 0, tzinfo=KOLKATA_TZ)

    # Free tournament in that week
    resp_free = client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(dt, is_free_entry=True, title="Official Free Cup"),
        headers=headers,
    )
    assert resp_free.status_code == 201

    # Paid tournament in same week
    resp_paid = client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(dt + timedelta(hours=1), is_free_entry=False, title="Paid Cup"),
        headers=headers,
    )
    assert resp_paid.status_code == 201
    paid_id = resp_paid.json()["id"]

    # Attempt to change paid to free
    resp_convert = client.put(
        f"/api/v1/tournaments/{paid_id}",
        json={"is_free_entry": True},
        headers=headers,
    )
    assert resp_convert.status_code == 409
    assert "already scheduled" in resp_convert.json()["detail"]


def test_cancelled_free_tournament_allows_new_free_tournament(
    client: TestClient,
    create_user: Callable,
    auth_headers: Callable,
):
    organizer = create_user("org_w9", "org_w9@gb.com", role=UserRole.ORGANIZER, is_verified=True)
    headers = auth_headers(organizer)
    dt = datetime(2027, 10, 13, 15, 0, 0, tzinfo=KOLKATA_TZ)

    resp1 = client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(dt, is_free_entry=True, title="Draft To Cancel"),
        headers=headers,
    )
    assert resp1.status_code == 201
    t1_id = resp1.json()["id"]

    # Cancel the tournament
    cancel_resp = client.patch(
        f"/api/v1/tournaments/{t1_id}/status",
        json={"status": "cancelled"},
        headers=headers,
    )
    assert cancel_resp.status_code == 200

    # Creating a new free tournament in that same week now succeeds
    resp2 = client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(dt + timedelta(hours=2), is_free_entry=True, title="Replacement Free Cup"),
        headers=headers,
    )
    assert resp2.status_code == 201
    assert resp2.json()["title"] == "Replacement Free Cup"


def test_unauthorized_users_cannot_create_tournament(
    client: TestClient,
    create_user: Callable,
    auth_headers: Callable,
):
    player = create_user("player_w", "player_w@gb.com", role=UserRole.PLAYER)
    unverified_org = create_user("unv_org", "unv_org@gb.com", role=UserRole.ORGANIZER, is_verified=False)

    dt = datetime(2027, 11, 10, 15, 0, 0, tzinfo=KOLKATA_TZ)
    payload = _make_tournament_payload(dt, is_free_entry=True, title="Player Cup")

    # Regular player
    player_headers = auth_headers(player)
    resp = client.post("/api/v1/tournaments", json=payload, headers=player_headers)
    assert resp.status_code == 403

    # Unverified organizer
    unverified_headers = auth_headers(unverified_org)
    resp_unv = client.post("/api/v1/tournaments", json=payload, headers=unverified_headers)
    assert resp_unv.status_code == 403
    assert "pending admin approval" in resp_unv.json()["detail"]


def test_list_tournaments_is_free_entry_filter(
    client: TestClient,
    create_user: Callable,
    auth_headers: Callable,
):
    organizer = create_user("org_w10", "org_w10@gb.com", role=UserRole.ORGANIZER, is_verified=True)
    headers = auth_headers(organizer)

    dt1 = datetime(2027, 12, 1, 15, 0, 0, tzinfo=KOLKATA_TZ)
    dt2 = datetime(2027, 12, 8, 15, 0, 0, tzinfo=KOLKATA_TZ)

    # 1 Free tournament
    client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(dt1, is_free_entry=True, title="Free Filter Cup"),
        headers=headers,
    )
    # 1 Paid tournament
    client.post(
        "/api/v1/tournaments",
        json=_make_tournament_payload(dt2, is_free_entry=False, title="Paid Filter Cup"),
        headers=headers,
    )

    # Query is_free_entry=true
    resp_free = client.get("/api/v1/tournaments?is_free_entry=true")
    assert resp_free.status_code == 200
    free_items = resp_free.json()
    assert all(item["is_free_entry"] is True for item in free_items)
    assert any(item["title"] == "Free Filter Cup" for item in free_items)
    assert not any(item["title"] == "Paid Filter Cup" for item in free_items)

    # Query is_free_entry=false
    resp_paid = client.get("/api/v1/tournaments?is_free_entry=false")
    assert resp_paid.status_code == 200
    paid_items = resp_paid.json()
    assert all(item["is_free_entry"] is False for item in paid_items)
    assert any(item["title"] == "Paid Filter Cup" for item in paid_items)
    assert not any(item["title"] == "Free Filter Cup" for item in paid_items)
