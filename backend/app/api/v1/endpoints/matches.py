from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.security import decrypt_credential, encrypt_credential
from app.models.match import (
    Match,
    MatchCredential,
    MatchParticipant,
    MatchStatus,
)
from app.models.team import TeamMember
from app.models.tournament import (
    ParticipantStatus,
    Tournament,
    TournamentParticipant,
)
from app.models.user import User, UserRole
from app.schemas.match import (
    MatchCreate,
    MatchCredentialCreate,
    MatchCredentialResponse,
    MatchListItem,
    MatchParticipantAdd,
    MatchParticipantResponse,
    MatchResponse,
    MatchStatusUpdate,
    MatchUpdate,
)

router = APIRouter(tags=["matches"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_match_or_404(db: Session, match_id: str) -> Match:
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found.",
        )
    return match


def _get_tournament_or_404(db: Session, tournament_id: str) -> Tournament:
    tournament = db.query(Tournament).filter(Tournament.id == tournament_id).first()
    if not tournament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tournament not found.",
        )
    return tournament


def _assert_tournament_owner_or_admin(tournament: Tournament, current_user: User) -> None:
    if current_user.role != UserRole.ADMIN and tournament.organizer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this tournament.",
        )


def _format_match_response(match: Match) -> MatchResponse:
    has_creds = match.credential is not None
    release_at = match.credential.release_at if has_creds else None
    expires_at = match.credential.expires_at if has_creds else None

    return MatchResponse(
        id=match.id,
        tournament_id=match.tournament_id,
        title=match.title,
        match_number=match.match_number,
        round_number=match.round_number,
        status=match.status,
        scheduled_start_time=match.scheduled_start_time,
        has_credentials=has_creds,
        release_at=release_at,
        expires_at=expires_at,
        created_at=match.created_at,
        updated_at=match.updated_at,
        participants=[
            MatchParticipantResponse.model_validate(p)
            for p in match.match_participants
        ],
    )


# ---------------------------------------------------------------------------
# Tournament Matches (Organizer Create & Public Listing)
# ---------------------------------------------------------------------------

@router.post(
    "/tournaments/{tournament_id}/matches",
    response_model=MatchResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_match_for_tournament(
    tournament_id: str,
    payload: MatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """Create a new match for a tournament (owner organizer or admin only)."""
    tournament = _get_tournament_or_404(db, tournament_id)
    _assert_tournament_owner_or_admin(tournament, current_user)

    match = Match(
        tournament_id=tournament_id,
        title=payload.title,
        match_number=payload.match_number,
        round_number=payload.round_number,
        scheduled_start_time=payload.scheduled_start_time,
        status=MatchStatus.SCHEDULED,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return _format_match_response(match)


@router.get(
    "/tournaments/{tournament_id}/matches",
    response_model=List[MatchListItem],
)
def list_tournament_matches(
    tournament_id: str,
    db: Session = Depends(get_db),
):
    """Public listing of matches for a tournament. Secrets are never exposed."""
    _get_tournament_or_404(db, tournament_id)
    matches = (
        db.query(Match)
        .filter(Match.tournament_id == tournament_id)
        .order_by(Match.round_number.asc(), Match.match_number.asc())
        .all()
    )

    return [
        MatchListItem(
            id=m.id,
            tournament_id=m.tournament_id,
            title=m.title,
            match_number=m.match_number,
            round_number=m.round_number,
            status=m.status,
            scheduled_start_time=m.scheduled_start_time,
            has_credentials=m.credential is not None,
            participants_count=len(m.match_participants),
        )
        for m in matches
    ]


# ---------------------------------------------------------------------------
# Match Details, Updates & Participants
# ---------------------------------------------------------------------------

@router.get("/matches/{match_id}", response_model=MatchResponse)
def get_match(match_id: str, db: Session = Depends(get_db)):
    """Public: full match details including participant roster. Secrets are never exposed."""
    match = _get_match_or_404(db, match_id)
    return _format_match_response(match)


@router.put("/matches/{match_id}", response_model=MatchResponse)
def update_match(
    match_id: str,
    payload: MatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """Update match metadata (owner organizer or admin only)."""
    match = _get_match_or_404(db, match_id)
    _assert_tournament_owner_or_admin(match.tournament, current_user)

    if match.status in (MatchStatus.COMPLETED, MatchStatus.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a match that is completed or cancelled.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(match, field, value)

    match.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(match)
    return _format_match_response(match)


@router.patch("/matches/{match_id}/status", response_model=MatchResponse)
def update_match_status(
    match_id: str,
    payload: MatchStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """Update match status lifecycle (owner organizer or admin only)."""
    match = _get_match_or_404(db, match_id)
    _assert_tournament_owner_or_admin(match.tournament, current_user)

    match.status = payload.status
    match.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(match)
    return _format_match_response(match)


@router.post(
    "/matches/{match_id}/participants",
    response_model=MatchParticipantResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_match_participant(
    match_id: str,
    payload: MatchParticipantAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """Add a registered tournament participant to a match (owner organizer or admin only)."""
    match = _get_match_or_404(db, match_id)
    _assert_tournament_owner_or_admin(match.tournament, current_user)

    # Verify participant belongs to this tournament
    tp = (
        db.query(TournamentParticipant)
        .filter(
            TournamentParticipant.id == payload.tournament_participant_id,
            TournamentParticipant.tournament_id == match.tournament_id,
        )
        .first()
    )
    if not tp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Participant does not belong to this tournament.",
        )

    if tp.status in (ParticipantStatus.WITHDRAWN, ParticipantStatus.DISQUALIFIED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot add participant with status '{tp.status.value}'.",
        )

    # Check for duplicate
    existing = (
        db.query(MatchParticipant)
        .filter(
            MatchParticipant.match_id == match_id,
            MatchParticipant.tournament_participant_id == payload.tournament_participant_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Participant is already assigned to this match.",
        )

    mp = MatchParticipant(
        match_id=match_id,
        tournament_participant_id=payload.tournament_participant_id,
        slot_number=payload.slot_number,
    )
    db.add(mp)
    db.commit()
    db.refresh(mp)
    return mp


@router.delete(
    "/matches/{match_id}/participants/{match_participant_id}",
    status_code=status.HTTP_200_OK,
)
def remove_match_participant(
    match_id: str,
    match_participant_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """Remove a participant from a match (owner organizer or admin only)."""
    match = _get_match_or_404(db, match_id)
    _assert_tournament_owner_or_admin(match.tournament, current_user)

    mp = (
        db.query(MatchParticipant)
        .filter(
            MatchParticipant.id == match_participant_id,
            MatchParticipant.match_id == match_id,
        )
        .first()
    )
    if not mp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match participant not found.",
        )

    db.delete(mp)
    db.commit()
    return {"message": "Participant removed from match."}


# ---------------------------------------------------------------------------
# Encrypted Room Credentials
# ---------------------------------------------------------------------------

@router.post(
    "/matches/{match_id}/credentials",
    status_code=status.HTTP_200_OK,
)
def set_match_credentials(
    match_id: str,
    payload: MatchCredentialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """
    Encrypt and store room ID and password using authenticated encryption (AES-256-GCM).
    Only the tournament organizer or admin may set credentials.
    """
    match = _get_match_or_404(db, match_id)
    _assert_tournament_owner_or_admin(match.tournament, current_user)

    encrypted_id = encrypt_credential(payload.room_id)
    encrypted_pass = encrypt_credential(payload.room_password)

    credential = (
        db.query(MatchCredential)
        .filter(MatchCredential.match_id == match_id)
        .first()
    )
    if credential:
        credential.encrypted_room_id = encrypted_id
        credential.encrypted_room_password = encrypted_pass
        credential.release_at = payload.release_at
        credential.expires_at = payload.expires_at
        credential.updated_at = datetime.now(timezone.utc)
    else:
        credential = MatchCredential(
            match_id=match_id,
            encrypted_room_id=encrypted_id,
            encrypted_room_password=encrypted_pass,
            release_at=payload.release_at,
            expires_at=payload.expires_at,
        )
        db.add(credential)

    db.commit()
    return {
        "message": "Room credentials encrypted and stored successfully.",
        "match_id": match_id,
        "release_at": payload.release_at,
        "expires_at": payload.expires_at,
    }


@router.get(
    "/matches/{match_id}/credentials",
    response_model=MatchCredentialResponse,
)
def get_match_credentials(
    match_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve decrypted room credentials.
    Access Rules:
    - Tournament Owner Organizer & Admin: Granted access at any time.
    - Players:
        1. Must be a registered participant in the tournament with status CHECKED_IN.
        2. If match has assigned participants, player (or player's team) must be assigned.
        3. Access must occur strictly within the [release_at, expires_at] window.
    """
    match = _get_match_or_404(db, match_id)
    tournament = match.tournament

    credential = (
        db.query(MatchCredential)
        .filter(MatchCredential.match_id == match_id)
        .first()
    )
    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room credentials have not been configured for this match.",
        )

    # 1. Organizer Owner / Admin bypass check
    is_owner = (
        current_user.id == tournament.organizer_id
        or current_user.role == UserRole.ADMIN
    )

    if not is_owner:
        # 2. Player eligibility checks
        # Check if user is a checked-in participant (solo or via team membership)
        tp_query = (
            db.query(TournamentParticipant)
            .filter(TournamentParticipant.tournament_id == tournament.id)
        )

        # Check solo
        solo_tp = tp_query.filter(TournamentParticipant.user_id == current_user.id).first()
        eligible_tp = None

        if solo_tp:
            eligible_tp = solo_tp
        else:
            # Check team memberships
            user_team_ids = [
                tm.team_id
                for tm in db.query(TeamMember).filter(TeamMember.user_id == current_user.id).all()
            ]
            if user_team_ids:
                team_tp = tp_query.filter(TournamentParticipant.team_id.in_(user_team_ids)).first()
                if team_tp:
                    eligible_tp = team_tp

        if not eligible_tp:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You are not registered for this tournament.",
            )

        if eligible_tp.status != ParticipantStatus.CHECKED_IN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only checked-in participants may retrieve room credentials.",
            )

        # Check match participant assignment if specific match participants are assigned
        match_participants = (
            db.query(MatchParticipant)
            .filter(MatchParticipant.match_id == match.id)
            .all()
        )
        if match_participants:
            assigned_tp_ids = {mp.tournament_participant_id for mp in match_participants}
            if eligible_tp.id not in assigned_tp_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied. You are not assigned to this match.",
                )

        # 3. Release / Expiry window verification for players
        now = datetime.now(timezone.utc)
        release_at = (
            credential.release_at
            if credential.release_at.tzinfo is not None
            else credential.release_at.replace(tzinfo=timezone.utc)
        )
        expires_at = (
            credential.expires_at
            if credential.expires_at.tzinfo is not None
            else credential.expires_at.replace(tzinfo=timezone.utc)
        )
        if now < release_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Room credentials are not yet available. Release window opens at {release_at.isoformat()}.",
            )
        if now > expires_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Room credentials have expired. Access window closed at {expires_at.isoformat()}.",
            )

    # 4. Decrypt and return credentials
    try:
        decrypted_room_id = decrypt_credential(credential.encrypted_room_id)
        decrypted_room_password = decrypt_credential(credential.encrypted_room_password)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt room credentials.",
        ) from e

    return MatchCredentialResponse(
        match_id=match.id,
        room_id=decrypted_room_id,
        room_password=decrypted_room_password,
        release_at=credential.release_at,
        expires_at=credential.expires_at,
    )
