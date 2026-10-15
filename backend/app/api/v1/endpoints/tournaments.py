from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.player import SupportedGame
from app.models.team import Team
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
    ParticipantResponse,
    ParticipantStatusUpdate,
    ParticipantSummary,
    RegisterRequest,
    TournamentCreate,
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

_TEAM_FORMATS = {TournamentFormat.SQUAD, TournamentFormat.FIVE_V_FIVE}


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


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=List[TournamentListItem])
def list_tournaments(
    game: Optional[SupportedGame] = Query(None, description="Filter by game title"),
    status_filter: Optional[TournamentStatus] = Query(None, alias="status"),
    organizer_id: Optional[str] = Query(None, description="Filter by organizer user ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Public: paginated tournament listing with optional game, status, and organizer filters."""
    q = db.query(Tournament)
    if game:
        q = q.filter(Tournament.game_title == game.value)
    if status_filter:
        q = q.filter(Tournament.status == status_filter)
    if organizer_id:
        q = q.filter(Tournament.organizer_id == organizer_id)
    return q.order_by(Tournament.start_datetime.asc()).offset(skip).limit(limit).all()


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
    participants = (
        db.query(TournamentParticipant)
        .filter(TournamentParticipant.user_id == current_user.id)
        .order_by(TournamentParticipant.registered_at.desc())
        .all()
    )

    result = []
    for p in participants:
        t = p.tournament
        team_name = p.team.name if p.team else None
        team_tag = p.team.tag if p.team else None

        result.append(
            MyRegistrationItem(
                participant_id=p.id,
                tournament_id=t.id,
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
    return _get_tournament_or_404(db, tournament_id)


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

    tournament = Tournament(
        title=payload.title,
        description=payload.description,
        game_title=payload.game_title.value,
        format=payload.format,
        max_participants=payload.max_participants,
        registration_deadline=payload.registration_deadline,
        check_in_deadline=payload.check_in_deadline,
        start_datetime=payload.start_datetime,
        organizer_id=current_user.id,
        is_free_entry=True,
        rules=payload.rules,
        prize_pool_description=payload.prize_pool_description,
        status=TournamentStatus.DRAFT,
        current_participants=0,
    )
    db.add(tournament)
    db.commit()
    db.refresh(tournament)
    return tournament


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
    return tournament


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

    tournament.status = target
    tournament.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tournament)
    return tournament


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
