from datetime import datetime, time, timedelta, timezone
from typing import List, Optional
import zoneinfo
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.config import settings
from app.core.database import get_db
from app.core.tournament_config import (
    ALLOWED_ENTRY_FEES_PER_PLAYER,
    TOURNAMENT_MODES,
    calculate_prize_pool,
    calculate_rank_distribution,
    calculate_team_entry_fee,
    get_min_participation_target,
    get_mode_config,
    get_team_size,
)
from app.models.player import SupportedGame
from app.models.team import Team, TeamMember
from app.models.tournament import (
    ALLOWED_TRANSITIONS,
    ParticipantStatus,
    Tournament,
    TournamentFormat,
    TournamentParticipant,
    TournamentStatus,
)
from app.models.user import User, UserRole
from app.schemas.tournament import (
    GameModeConfigItem,
    ParticipantResponse,
    ParticipantStatusUpdate,
    ParticipantSummary,
    PlatformModesConfigResponse,
    RankPayoutAllocation,
    RegisterRequest,
    TournamentCreate,
    TournamentFinancialPreview,
    TournamentListItem,
    TournamentResponse,
    TournamentStatusUpdate,
    TournamentUpdate,
    WithdrawResponse,
    MyRegistrationItem,
)

router = APIRouter(prefix="/tournaments", tags=["tournaments"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TEAM_FORMATS = {TournamentFormat.DUO, TournamentFormat.SQUAD, TournamentFormat.FIVE_V_FIVE}
KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")


def get_kolkata_week_bounds(dt: datetime) -> tuple[datetime, datetime]:
    """
    Given a datetime, interpret it in the Asia/Kolkata timezone and calculate
    the calendar Monday 00:00:00.000000 to Sunday 23:59:59.999999 week boundaries.
    Returns the start and end as UTC datetimes.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt_kolkata = dt.astimezone(KOLKATA_TZ)
    monday = dt_kolkata.date() - timedelta(days=dt_kolkata.weekday())
    sunday = monday + timedelta(days=6)
    start_k = datetime.combine(monday, time.min, tzinfo=KOLKATA_TZ)
    end_k = datetime.combine(sunday, time.max, tzinfo=KOLKATA_TZ)
    return start_k.astimezone(timezone.utc), end_k.astimezone(timezone.utc)


def check_weekly_free_tournament_conflict(
    db: Session,
    start_dt: datetime,
    exclude_tournament_id: Optional[str] = None,
) -> None:
    """
    Validate that at most ONE active free tournament is scheduled per calendar week
    in Asia/Kolkata timezone across the entire platform.
    Raises HTTP 409 Conflict if another active free tournament already exists.
    """
    week_start_utc, week_end_utc = get_kolkata_week_bounds(start_dt)
    q = db.query(Tournament).filter(
        Tournament.is_free_entry == True,
        Tournament.status != TournamentStatus.CANCELLED,
        Tournament.start_datetime >= week_start_utc,
        Tournament.start_datetime <= week_end_utc,
    )
    if exclude_tournament_id:
        q = q.filter(Tournament.id != exclude_tournament_id)

    conflict = q.first()
    if conflict:
        start_ist_str = week_start_utc.astimezone(KOLKATA_TZ).strftime("%Y-%m-%d")
        end_ist_str = week_end_utc.astimezone(KOLKATA_TZ).strftime("%Y-%m-%d")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"A free tournament of the week is already scheduled for the week of "
                f"{start_ist_str} to {end_ist_str} (Asia/Kolkata): '{conflict.title}'. "
                f"Only one free tournament is permitted per calendar week across the platform."
            ),
        )


def _get_tournament_or_404(db: Session, tournament_id: str) -> Tournament:
    t = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found.")
    return t


def _assert_owner_or_admin(tournament: Tournament, current_user: User) -> None:
    """Raise 403 unless the current user is the tournament organizer or an admin."""
    if current_user.role != UserRole.ADMIN and tournament.organizer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this tournament.",
        )


def _get_confirmed_participants(tournament: Tournament) -> List[TournamentParticipant]:
    """
    Returns confirmed, eligible tournament participants.
    Excludes withdrawn and disqualified participants.
    For team formats: excludes incomplete teams (where team member count < required team size).
    """
    fmt_val = tournament.format.value if hasattr(tournament.format, "value") else str(tournament.format)
    team_size = get_team_size(tournament.game_title, fmt_val)
    is_team = TournamentFormat(fmt_val) in _TEAM_FORMATS

    eligible = []
    for p in tournament.participants:
        if p.status in (ParticipantStatus.WITHDRAWN, ParticipantStatus.DISQUALIFIED):
            continue
        if is_team:
            if not p.team:
                continue
            members_count = len(p.team.members) if p.team.members else 0
            if members_count < team_size:
                continue
        else:
            if not p.user_id:
                continue
        eligible.append(p)
    return eligible


def _build_tournament_response(t: Tournament) -> TournamentResponse:
    fmt_val = t.format.value if hasattr(t.format, "value") else str(t.format)
    team_size = get_team_size(t.game_title, fmt_val)
    entry_fee = t.entry_fee_per_player or 0
    team_entry_fee = calculate_team_entry_fee(entry_fee, t.game_title, fmt_val)
    max_player_slots = t.max_participants * team_size
    current_player_slots = t.current_participants * team_size

    min_teams_30pct, min_players_30pct = get_min_participation_target(
        t.game_title, fmt_val, t.max_participants
    )
    confirmed = _get_confirmed_participants(t)
    confirmed_entries_count = len(confirmed)
    confirmed_players_count = confirmed_entries_count * team_size
    min_participation_met = confirmed_entries_count >= min_teams_30pct

    requires_cancellation = (
        entry_fee > 0
        and t.status in (TournamentStatus.REGISTRATION_CLOSED, TournamentStatus.CHECK_IN)
        and not min_participation_met
    )

    _, prize_pool_preview, _ = calculate_prize_pool(
        confirmed_entries_count, entry_fee, t.game_title, fmt_val
    )

    participant_summaries = []
    for p in t.participants:
        participant_summaries.append(
            ParticipantSummary(
                id=p.id,
                user_id=p.user_id,
                team_id=p.team_id,
                status=p.status,
                registered_at=p.registered_at,
                checked_in_at=p.checked_in_at,
                username=p.username,
                team_name=p.team_name,
                team_tag=p.team_tag,
            )
        )

    return TournamentResponse(
        id=t.id,
        title=t.title,
        description=t.description,
        game_title=t.game_title,
        format=t.format,
        status=t.status,
        max_participants=t.max_participants,
        current_participants=t.current_participants,
        registration_deadline=t.registration_deadline,
        check_in_deadline=t.check_in_deadline,
        start_datetime=t.start_datetime,
        organizer_id=t.organizer_id,
        is_free_entry=t.is_free_entry,
        entry_fee_per_player=entry_fee,
        require_complete_teams=bool(t.require_complete_teams),
        rules=t.rules,
        prize_pool_description=t.prize_pool_description,
        created_at=t.created_at,
        updated_at=t.updated_at,
        participants=participant_summaries,
        team_size=team_size,
        team_entry_fee=team_entry_fee,
        max_player_slots=max_player_slots,
        current_player_slots=current_player_slots,
        min_participants_30pct=min_teams_30pct,
        min_players_30pct=min_players_30pct,
        confirmed_entries_count=confirmed_entries_count,
        confirmed_players_count=confirmed_players_count,
        min_participation_met=min_participation_met,
        requires_cancellation=requires_cancellation,
        prize_pool_preview=prize_pool_preview,
    )


def _build_tournament_list_item(t: Tournament) -> TournamentListItem:
    fmt_val = t.format.value if hasattr(t.format, "value") else str(t.format)
    team_size = get_team_size(t.game_title, fmt_val)
    entry_fee = t.entry_fee_per_player or 0
    team_entry_fee = calculate_team_entry_fee(entry_fee, t.game_title, fmt_val)
    max_player_slots = t.max_participants * team_size
    min_teams_30pct, _ = get_min_participation_target(
        t.game_title, fmt_val, t.max_participants
    )
    confirmed = _get_confirmed_participants(t)
    confirmed_entries_count = len(confirmed)
    min_participation_met = confirmed_entries_count >= min_teams_30pct

    return TournamentListItem(
        id=t.id,
        title=t.title,
        game_title=t.game_title,
        format=t.format,
        status=t.status,
        max_participants=t.max_participants,
        current_participants=t.current_participants,
        registration_deadline=t.registration_deadline,
        start_datetime=t.start_datetime,
        organizer_id=t.organizer_id,
        is_free_entry=t.is_free_entry,
        entry_fee_per_player=entry_fee,
        require_complete_teams=bool(t.require_complete_teams),
        team_size=team_size,
        team_entry_fee=team_entry_fee,
        max_player_slots=max_player_slots,
        min_participants_30pct=min_teams_30pct,
        confirmed_entries_count=confirmed_entries_count,
        min_participation_met=min_participation_met,
    )


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=List[TournamentListItem])
def list_tournaments(
    game: Optional[SupportedGame] = Query(None, description="Filter by game title"),
    status_filter: Optional[TournamentStatus] = Query(None, alias="status"),
    organizer_id: Optional[str] = Query(None, description="Filter by organizer user ID"),
    is_free_entry: Optional[bool] = Query(None, description="Filter by free entry (True) or paid/entry (False)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Public: paginated tournament listing with optional game, status, organizer, and free_entry filters."""
    q = db.query(Tournament)
    if game:
        q = q.filter(Tournament.game_title == game.value)
    if status_filter:
        q = q.filter(Tournament.status == status_filter)
    if organizer_id:
        q = q.filter(Tournament.organizer_id == organizer_id)
    if is_free_entry is not None:
        q = q.filter(Tournament.is_free_entry == is_free_entry)
    tournaments = q.order_by(Tournament.start_datetime.asc()).offset(skip).limit(limit).all()
    return [_build_tournament_list_item(t) for t in tournaments]


@router.get("/modes/config", response_model=PlatformModesConfigResponse)
def get_tournament_modes_config():
    """Public: retrieve platform-wide authoritative game modes, capacities, and entry fee tiers."""
    mode_items = []
    for game_name, formats in TOURNAMENT_MODES.items():
        for fmt, cfg in formats.items():
            mode_items.append(
                GameModeConfigItem(
                    game_title=game_name,
                    format=fmt,
                    team_size=cfg["team_size"],
                    max_teams=cfg["max_teams"],
                    max_player_slots=cfg["max_player_slots"],
                    min_teams_30pct=cfg["min_teams_30pct"],
                    min_players_30pct=cfg["min_players_30pct"],
                )
            )
    return PlatformModesConfigResponse(
        modes=mode_items,
        allowed_entry_fees_per_player=ALLOWED_ENTRY_FEES_PER_PLAYER,
        paid_tournaments_enabled=settings.PAID_TOURNAMENTS_ENABLED,
    )


@router.get(
    "/my",
    response_model=List[MyRegistrationItem],
    summary="Get current user's registered tournaments",
)
def get_my_tournaments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[MyRegistrationItem]:
    """Retrieve all tournaments where the current user (or their team) is registered."""
    user_team_ids = [
        tm.team_id
        for tm in db.query(TeamMember.team_id).filter(TeamMember.user_id == current_user.id).all()
    ]
    filters = [TournamentParticipant.user_id == current_user.id]
    if user_team_ids:
        filters.append(TournamentParticipant.team_id.in_(user_team_ids))

    participants = (
        db.query(TournamentParticipant)
        .filter(or_(*filters))
        .order_by(TournamentParticipant.registered_at.desc())
        .all()
    )

    seen_ids = set()
    result = []
    for p in participants:
        if p.id in seen_ids:
            continue
        seen_ids.add(p.id)
        t = p.tournament
        team_name = p.team.name if p.team else None
        team_tag = p.team.tag if p.team else None

        result.append(
            MyRegistrationItem(
                participant_id=p.id,
                tournament_id=t.id,
                user_id=p.user_id,
                tournament_title=t.title,
                game_title=t.game_title,
                format=t.format,
                status=t.status.value,
                max_participants=t.max_participants,
                current_participants=t.current_participants,
                start_datetime=t.start_datetime,
                registration_deadline=t.registration_deadline,
                check_in_deadline=t.check_in_deadline,
                participant_status=p.status,
                registered_at=p.registered_at,
                checked_in_at=p.checked_in_at,
                team_id=p.team_id,
                team_name=team_name,
                team_tag=team_tag,
            )
        )
    return result


@router.get("/{tournament_id}", response_model=TournamentResponse)
def get_tournament(tournament_id: str, db: Session = Depends(get_db)):
    """Public: full tournament details including participants list."""
    tournament = _get_tournament_or_404(db, tournament_id)
    return _build_tournament_response(tournament)


# ---------------------------------------------------------------------------
# Organizer / Admin: create & manage
# ---------------------------------------------------------------------------

@router.post("", response_model=TournamentResponse, status_code=status.HTTP_201_CREATED)
def create_tournament(
    payload: TournamentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """Create a new tournament (organizer or admin)."""
    if current_user.role == UserRole.ORGANIZER and not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organizer account is pending admin approval.",
        )

    now = datetime.now(timezone.utc)
    reg_deadline = (
        payload.registration_deadline
        if payload.registration_deadline.tzinfo is not None
        else payload.registration_deadline.replace(tzinfo=timezone.utc)
    )
    if reg_deadline <= now:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="registration_deadline must be in the future.",
        )

    start_dt = (
        payload.start_datetime
        if payload.start_datetime.tzinfo is not None
        else payload.start_datetime.replace(tzinfo=timezone.utc)
    ).astimezone(timezone.utc)

    if payload.is_free_entry:
        check_weekly_free_tournament_conflict(db, start_dt)

    # Resolve capacity and validate format compatibility
    mode_cfg = get_mode_config(payload.game_title.value, payload.format.value)
    if not mode_cfg:
        allowed = list(TOURNAMENT_MODES.get(payload.game_title.value, {}).keys())
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Format '{payload.format.value}' is not supported for '{payload.game_title.value}'. Allowed: {allowed}",
        )
    max_cap = payload.max_participants or mode_cfg["max_teams"]

    entry_fee = 0 if payload.is_free_entry else payload.entry_fee_per_player

    tournament = Tournament(
        title=payload.title,
        description=payload.description,
        game_title=payload.game_title.value,
        format=payload.format,
        max_participants=max_cap,
        registration_deadline=reg_deadline,
        check_in_deadline=payload.check_in_deadline,
        start_datetime=start_dt,
        organizer_id=current_user.id,
        is_free_entry=payload.is_free_entry,
        entry_fee_per_player=entry_fee,
        require_complete_teams=payload.require_complete_teams,
        rules=payload.rules,
        prize_pool_description=payload.prize_pool_description,
        status=TournamentStatus.DRAFT,
        current_participants=0,
    )
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return _build_tournament_response(tournament)


@router.put("/{tournament_id}", response_model=TournamentResponse)
def update_tournament(
    tournament_id: str,
    payload: TournamentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """Update mutable tournament fields (owner or admin only). Not allowed once ongoing/completed."""
    if current_user.role == UserRole.ORGANIZER and not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organizer account is pending admin approval.",
        )

    tournament = _get_tournament_or_404(db, tournament_id)
    _assert_owner_or_admin(tournament, current_user)

    if tournament.status in (TournamentStatus.ONGOING, TournamentStatus.COMPLETED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit a tournament that is ongoing or completed.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    # Selected entry tier must remain fixed once registration opens
    if "entry_fee_per_player" in update_data and update_data["entry_fee_per_player"] != tournament.entry_fee_per_player:
        if tournament.status != TournamentStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tournament entry fee cannot be modified after registration opens.",
            )

    if "start_datetime" in update_data and update_data["start_datetime"] is not None:
        s_dt = update_data["start_datetime"]
        if s_dt.tzinfo is None:
            s_dt = s_dt.replace(tzinfo=timezone.utc)
        update_data["start_datetime"] = s_dt.astimezone(timezone.utc)

    # Determine resulting is_free_entry and start_datetime
    target_is_free = update_data.get("is_free_entry", tournament.is_free_entry)
    target_start_dt = update_data.get("start_datetime", tournament.start_datetime)

    if target_is_free and ("start_datetime" in update_data or "is_free_entry" in update_data):
        check_weekly_free_tournament_conflict(db, target_start_dt, exclude_tournament_id=tournament.id)

    if target_is_free and "entry_fee_per_player" not in update_data:
        update_data["entry_fee_per_player"] = 0

    # Enforce: new max_participants must not drop below current registrations
    if "max_participants" in update_data:
        if update_data["max_participants"] < tournament.current_participants:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot reduce max_participants below current participant count "
                    f"({tournament.current_participants})."
                ),
            )

    for field, value in update_data.items():
        setattr(tournament, field, value)

    tournament.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tournament)
    return _build_tournament_response(tournament)


@router.patch("/{tournament_id}/status", response_model=TournamentResponse)
def update_tournament_status(
    tournament_id: str,
    payload: TournamentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """Advance (or cancel) the tournament status (owner or admin only)."""
    tournament = _get_tournament_or_404(db, tournament_id)
    _assert_owner_or_admin(tournament, current_user)

    current = tournament.status
    target = payload.status

    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot transition from '{current.value}' to '{target.value}'. "
                f"Allowed: {[s.value for s in allowed] or 'none (terminal state)'}."
            ),
        )

    # Minimum 30% participation rule enforcement for paid tournaments
    if target in (TournamentStatus.CHECK_IN, TournamentStatus.ONGOING):
        if tournament.entry_fee_per_player > 0:
            fmt_val = tournament.format.value if hasattr(tournament.format, "value") else str(tournament.format)
            min_teams, min_players = get_min_participation_target(
                tournament.game_title, fmt_val, tournament.max_participants
            )
            confirmed = _get_confirmed_participants(tournament)
            if len(confirmed) < min_teams:
                entity = "teams" if TournamentFormat(fmt_val) in _TEAM_FORMATS else "players"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Minimum 30% participation threshold not met. "
                        f"Required: {min_teams} confirmed {entity} ({min_players} players), "
                        f"but only {len(confirmed)} confirmed {entity} registered. "
                        f"Tournament requires cancellation under platform rules."
                    ),
                )

    tournament.status = target
    tournament.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tournament)
    return _build_tournament_response(tournament)


@router.patch(
    "/{tournament_id}/participants/{participant_id}/status",
    response_model=ParticipantSummary,
)
def update_participant_status(
    tournament_id: str,
    participant_id: str,
    payload: ParticipantStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """Update participant status (e.g. check-in manually, or disqualify). (Organizer or Admin)."""
    tournament = _get_tournament_or_404(db, tournament_id)
    _assert_owner_or_admin(tournament, current_user)

    participant = (
        db.query(TournamentParticipant)
        .filter(
            TournamentParticipant.id == participant_id,
            TournamentParticipant.tournament_id == tournament_id,
        )
        .first()
    )
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found.",
        )

    old_status = participant.status
    new_status = payload.status
    participant.status = new_status

    if new_status == ParticipantStatus.CHECKED_IN and not participant.checked_in_at:
        participant.checked_in_at = datetime.now(timezone.utc)

    # Adjust current_participants count if moving in/out of disqualified/withdrawn states
    inactive_statuses = {ParticipantStatus.DISQUALIFIED, ParticipantStatus.WITHDRAWN}
    if new_status in inactive_statuses and old_status not in inactive_statuses:
        tournament.current_participants = max(0, tournament.current_participants - 1)
    elif old_status in inactive_statuses and new_status not in inactive_statuses:
        tournament.current_participants += 1

    tournament.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(participant)
    return participant


# ---------------------------------------------------------------------------
# Player: registration, check-in, withdrawal
# ---------------------------------------------------------------------------

@router.post(
    "/{tournament_id}/register",
    response_model=ParticipantResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_for_tournament(
    tournament_id: str,
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a player (or team) for a tournament.

    Solo/Duo: ``team_id`` must be omitted or null.
    Squad/5v5: ``team_id`` is required and the current user must be the team captain.
    """
    tournament = _get_tournament_or_404(db, tournament_id)

    # Status gate
    if tournament.status != TournamentStatus.REGISTRATION_OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tournament is not open for registration.",
        )

    # Deadline gate
    now = datetime.now(timezone.utc)
    reg_deadline = (
        tournament.registration_deadline
        if tournament.registration_deadline.tzinfo is not None
        else tournament.registration_deadline.replace(tzinfo=timezone.utc)
    )
    if now > reg_deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration deadline has passed.",
        )

    # Capacity gate
    if tournament.current_participants >= tournament.max_participants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tournament is full. No slots available.",
        )

    # Legal/Payment feature gate: block real-money registration when disabled
    if tournament.entry_fee_per_player > 0 and not settings.PAID_TOURNAMENTS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Paid tournament registration and payment collection are disabled "
                "(PAID_TOURNAMENTS_ENABLED=False). Paid tournaments are currently in preview mode only."
            ),
        )

    is_team_format = TournamentFormat(tournament.format) in _TEAM_FORMATS

    # ----- Team registration -----
    if is_team_format:
        if not payload.team_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"team_id is required for {tournament.format} format.",
            )
        team = db.query(Team).filter(Team.id == payload.team_id).first()
        if not team:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found.")
        if team.captain_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the team captain can register the team.",
            )
        # Check team game compatibility
        if team.primary_game != tournament.game_title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Team's primary game '{team.primary_game}' does not match tournament game '{tournament.game_title}'.",
            )
        # Check complete team requirements if enforced
        if tournament.require_complete_teams:
            required_team_size = get_team_size(tournament.game_title, tournament.format.value)
            team_members_count = len(team.members) if team.members else 0
            if team_members_count < required_team_size:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Team '{team.name}' has {team_members_count} member(s), but at least "
                        f"{required_team_size} members are required to register for {tournament.format.value} format."
                    ),
                )
        # Check if team already registered
        existing_team = (
            db.query(TournamentParticipant)
            .filter(
                TournamentParticipant.tournament_id == tournament_id,
                TournamentParticipant.team_id == payload.team_id,
            )
            .first()
        )
        if existing_team:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This team is already registered for the tournament.",
            )

    # ----- Solo registration -----
    else:
        if payload.team_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"team_id must not be provided for {tournament.format} format.",
            )

    # Duplicate user check (catches captain re-registering same team or solo double-reg)
    existing_user = (
        db.query(TournamentParticipant)
        .filter(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.user_id == current_user.id,
        )
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already registered for this tournament.",
        )

    # Atomically verify and increment participant count
    updated_rows = (
        db.query(Tournament)
        .filter(
            Tournament.id == tournament_id,
            Tournament.current_participants < Tournament.max_participants,
            Tournament.status == TournamentStatus.REGISTRATION_OPEN,
        )
        .update(
            {
                Tournament.current_participants: Tournament.current_participants + 1,
                Tournament.updated_at: datetime.now(timezone.utc),
            },
            synchronize_session=False,
        )
    )
    if updated_rows == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tournament is full. No slots available.",
        )

    # Create registration
    participant = TournamentParticipant(
        tournament_id=tournament_id,
        user_id=current_user.id,
        team_id=payload.team_id if is_team_format else None,
        status=ParticipantStatus.REGISTERED,
    )
    db.add(participant)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Decrement back if participant creation failed due to duplicate
        db.query(Tournament).filter(Tournament.id == tournament_id).update(
            {Tournament.current_participants: Tournament.current_participants - 1},
            synchronize_session=False,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. You or your team may already be registered.",
        )

    db.refresh(participant)
    return participant


@router.post("/{tournament_id}/check-in", response_model=ParticipantResponse)
def check_in(
    tournament_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check in to a tournament (must be in check_in status and participant must be registered)."""
    tournament = _get_tournament_or_404(db, tournament_id)

    if tournament.status != TournamentStatus.CHECK_IN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tournament is not in the check-in phase.",
        )

    participant = (
        db.query(TournamentParticipant)
        .filter(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.user_id == current_user.id,
        )
        .first()
    )
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not registered for this tournament.",
        )
    if participant.status != ParticipantStatus.REGISTERED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot check in with participant status '{participant.status.value}'.",
        )

    participant.status = ParticipantStatus.CHECKED_IN
    participant.checked_in_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(participant)
    return participant


@router.delete("/{tournament_id}/register", response_model=WithdrawResponse)
def withdraw_registration(
    tournament_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Withdraw from a tournament (allowed while registration is open or closed)."""
    tournament = _get_tournament_or_404(db, tournament_id)

    if tournament.status in (TournamentStatus.ONGOING, TournamentStatus.COMPLETED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot withdraw from a tournament that is already ongoing or completed.",
        )

    participant = (
        db.query(TournamentParticipant)
        .filter(
            TournamentParticipant.tournament_id == tournament_id,
            TournamentParticipant.user_id == current_user.id,
        )
        .first()
    )
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not registered for this tournament.",
        )
    if participant.status == ParticipantStatus.WITHDRAWN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already withdrawn from this tournament.",
        )

    participant.status = ParticipantStatus.WITHDRAWN
    if tournament.current_participants > 0:
        tournament.current_participants -= 1
    tournament.updated_at = datetime.now(timezone.utc)

    db.commit()
    return WithdrawResponse(message="Successfully withdrawn from the tournament.")


# ---------------------------------------------------------------------------
# Financial Preview & Monetary Feature Gate Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/{tournament_id}/financial-preview",
    response_model=TournamentFinancialPreview,
    summary="Admin/Organizer financial preview with 65% prize pool and 35% reserve calculation",
)
def get_tournament_financial_preview(
    tournament_id: str,
    expected_costs: Optional[int] = Query(None, ge=0, description="Expected operational costs in whole ₹"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """
    Admin & Owner Organizer only:
    Calculates gross collected fees, floor(65%) prize pool, 35% reserve,
    cost-safety check, deterministic largest-remainder rank allocations, and MVP disclaimer.
    Never exposes organizer profit on public pages.
    """
    tournament = _get_tournament_or_404(db, tournament_id)
    _assert_owner_or_admin(tournament, current_user)

    fmt_val = tournament.format.value if hasattr(tournament.format, "value") else str(tournament.format)
    team_size = get_team_size(tournament.game_title, fmt_val)
    team_entry_fee = calculate_team_entry_fee(tournament.entry_fee_per_player, tournament.game_title, fmt_val)

    confirmed_participants = _get_confirmed_participants(tournament)
    confirmed_entries = len(confirmed_participants)
    eligible_participants_count = confirmed_entries * team_size

    gross_collected, prize_pool, reserve_amount = calculate_prize_pool(
        confirmed_entries=confirmed_entries,
        entry_fee_per_player=tournament.entry_fee_per_player,
        game_title=tournament.game_title,
        format_val=fmt_val,
    )

    is_team = TournamentFormat(fmt_val) in _TEAM_FORMATS
    payout_data = calculate_rank_distribution(prize_pool, is_team_format=is_team)
    payout_allocations = [RankPayoutAllocation(**item) for item in payout_data]

    # Cost-safety check: verify if expected operational costs exceed the 35% reserve
    if expected_costs is not None:
        if expected_costs > reserve_amount:
            cost_safety_warning = (
                f"Expected costs (₹{expected_costs}) exceed the available 35% reserve (₹{reserve_amount}). "
                f"Deficit risk of ₹{expected_costs - reserve_amount}. Operational activation must be reviewed."
            )
        else:
            cost_safety_warning = None
        is_projection_complete = True
    else:
        cost_safety_warning = (
            "Cost data is not configured; financial projection is incomplete. "
            "The 35% reserve is NOT guaranteed profit and must cover refunds, payment gateways, servers, and taxes."
        )
        is_projection_complete = False

    disclaimer = (
        "All calculations are illustrative. Actual monetary entry fee collection and cash payouts "
        "are strictly disabled in this MVP environment (PAID_TOURNAMENTS_ENABLED=False). "
        "The 35% reserve covers payment processing, refunds, server infrastructure, and taxes."
    )

    return TournamentFinancialPreview(
        tournament_id=tournament.id,
        tournament_title=tournament.title,
        is_free_entry=tournament.is_free_entry,
        entry_fee_per_player=tournament.entry_fee_per_player,
        team_size=team_size,
        team_entry_fee=team_entry_fee,
        confirmed_entries=confirmed_entries,
        eligible_participants_count=eligible_participants_count,
        gross_collected_fees=gross_collected,
        prize_pool=prize_pool,
        prize_pool_percentage=65.0,
        reserve_amount=reserve_amount,
        reserve_percentage=35.0,
        expected_costs=expected_costs,
        cost_safety_warning=cost_safety_warning,
        is_projection_complete=is_projection_complete,
        payout_allocations=payout_allocations,
        disclaimer=disclaimer,
    )


@router.post(
    "/{tournament_id}/checkout",
    status_code=status.HTTP_403_FORBIDDEN,
    summary="Monetary checkout gate (strictly disabled)",
)
def tournament_payment_checkout(
    tournament_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Monetary checkout gate: strictly returns HTTP 403 Forbidden while PAID_TOURNAMENTS_ENABLED is False."""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Payment checkout and real-money transactions are disabled on GamerBrac (PAID_TOURNAMENTS_ENABLED=False).",
    )
