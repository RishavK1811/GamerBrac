from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.player import GameAccount, PlayerProfile
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.player import (
    GameAccountCreate,
    GameAccountResponse,
    PlayerProfileResponse,
    PlayerProfileUpdate,
)

router = APIRouter(prefix="/players", tags=["Player Profiles & Game Accounts"])


@router.get(
    "/profile",
    response_model=PlayerProfileResponse,
    summary="Get current user player profile",
)
def get_player_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlayerProfileResponse:
    """Fetch current user's player profile with all linked game accounts."""
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if not profile:
        profile = PlayerProfile(user_id=current_user.id, display_name=current_user.username)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return PlayerProfileResponse.model_validate(profile)


@router.put(
    "/profile",
    response_model=PlayerProfileResponse,
    summary="Update player profile details",
)
def update_player_profile(
    profile_update: PlayerProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlayerProfileResponse:
    """Update profile attributes like display name, bio, phone, and Indian state/region."""
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if not profile:
        profile = PlayerProfile(user_id=current_user.id, display_name=current_user.username)
        db.add(profile)
        db.flush()

    update_data = profile_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return PlayerProfileResponse.model_validate(profile)


@router.get(
    "/game-accounts",
    response_model=List[GameAccountResponse],
    summary="List all game accounts linked to player profile",
)
def list_game_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[GameAccountResponse]:
    """Retrieve all linked gaming UIDs (Free Fire MAX, BGMI, VALORANT) for the current user."""
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if not profile:
        return []

    accounts = (
        db.query(GameAccount)
        .filter(GameAccount.player_profile_id == profile.id)
        .all()
    )
    return [GameAccountResponse.model_validate(acc) for acc in accounts]


@router.post(
    "/game-accounts",
    response_model=GameAccountResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Link a new game account UID to player profile",
)
def link_game_account(
    account_in: GameAccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GameAccountResponse:
    """
    Link game UID for Free Fire MAX, BGMI, or VALORANT.
    Guarantees that a player only has one account per game title and prevents duplicate UID claiming.
    """
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if not profile:
        profile = PlayerProfile(user_id=current_user.id, display_name=current_user.username)
        db.add(profile)
        db.flush()

    # Check if player already linked an account for this title
    existing_title_account = (
        db.query(GameAccount)
        .filter(
            GameAccount.player_profile_id == profile.id,
            GameAccount.game_title == account_in.game_title,
        )
        .first()
    )
    if existing_title_account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You have already linked an account for '{account_in.game_title}'.",
        )

    # Check if another player claimed this in-game ID for this title
    uid_claimed = (
        db.query(GameAccount)
        .filter(
            GameAccount.game_title == account_in.game_title,
            GameAccount.in_game_id == account_in.in_game_id,
        )
        .first()
    )
    if uid_claimed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The game UID '{account_in.in_game_id}' is already registered to another player on GamerBrac.",
        )

    new_account = GameAccount(
        player_profile_id=profile.id,
        game_title=account_in.game_title,
        in_game_name=account_in.in_game_name,
        in_game_id=account_in.in_game_id,
        is_verified=False,
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)

    return GameAccountResponse.model_validate(new_account)


@router.delete(
    "/game-accounts/{account_id}",
    response_model=MessageResponse,
    summary="Unlink a game account from profile",
)
def unlink_game_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Unlink an existing game account owned by the current player."""
    profile = db.query(PlayerProfile).filter(PlayerProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Player profile not found.",
        )

    account = (
        db.query(GameAccount)
        .filter(
            GameAccount.id == account_id,
            GameAccount.player_profile_id == profile.id,
        )
        .first()
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game account not found or does not belong to your profile.",
        )

    db.delete(account)
    db.commit()

    return MessageResponse(message="Game account unlinked successfully.")
