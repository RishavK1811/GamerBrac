from datetime import datetime, timezone
from typing import Tuple
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, get_token_payload
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.player import PlayerProfile
from app.models.user import RevokedToken, User, UserRole
from app.schemas.auth import (
    MessageResponse,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new player account",
)
def register(
    register_data: UserRegisterRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Register a new player with Argon2 password hashing.
    Enforces strict 'player' role assignment to prevent unauthorized role elevation.
    """
    # Check for existing username (case-insensitive)
    existing_user = (
        db.query(User)
        .filter(func.lower(User.username) == register_data.username.lower())
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this username already exists.",
        )

    # Check for existing email (case-insensitive)
    existing_email = (
        db.query(User)
        .filter(func.lower(User.email) == register_data.email.lower())
        .first()
    )
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # Hash password with Argon2id
    hashed_pw = get_password_hash(register_data.password)

    # Always enforce default 'player' role on public registration
    new_user = User(
        username=register_data.username.lower(),
        email=register_data.email.lower(),
        hashed_password=hashed_pw,
        role=UserRole.PLAYER,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    # Automatically initialize player profile
    player_profile = PlayerProfile(
        user_id=new_user.id,
        display_name=register_data.username,
    )
    db.add(player_profile)
    db.commit()
    db.refresh(new_user)

    # Generate JWT
    token, jti, expire = create_access_token(
        subject=new_user.id,
        role=new_user.role.value,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(new_user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and obtain JWT token",
)
def login(
    login_data: UserLoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Authenticate via username or email with Argon2 hash verification."""
    identifier = login_data.username_or_email.strip().lower()

    user = (
        db.query(User)
        .filter(
            (func.lower(User.username) == identifier)
            | (func.lower(User.email) == identifier)
        )
        .first()
    )

    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is disabled. Please contact platform administration.",
        )

    token, jti, expire = create_access_token(
        subject=user.id,
        role=user.role.value,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Invalidate current access token",
)
def logout(
    token_and_payload: Tuple[str, dict] = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Store token identifier (jti) in revocation list to prevent reuse."""
    token, payload = token_and_payload
    jti = payload.get("jti")
    user_id = payload.get("sub")
    exp_timestamp = payload.get("exp")

    if not jti or not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token structure.",
        )

    expires_at = (
        datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
        if exp_timestamp
        else datetime.now(timezone.utc)
    )

    revocation = RevokedToken(
        jti=jti,
        user_id=user_id,
        expires_at=expires_at,
    )
    db.add(revocation)
    db.commit()

    return MessageResponse(message="Successfully logged out and revoked access token.")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile and roles",
)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Return user data, permissions, player profile, and linked game accounts."""
    return UserResponse.model_validate(current_user)
