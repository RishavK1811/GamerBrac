import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class SupportedGame(str, enum.Enum):
    FREE_FIRE_MAX = "Free Fire MAX"
    BGMI = "BGMI"
    VALORANT = "VALORANT"


class PlayerProfile(Base):
    __tablename__ = "player_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    display_name = Column(String(100), nullable=False)
    bio = Column(String(500), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    phone_number = Column(String(20), nullable=True)
    state_region = Column(String(100), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="profile")
    game_accounts = relationship(
        "GameAccount",
        back_populates="player_profile",
        cascade="all, delete-orphan",
    )


class GameAccount(Base):
    __tablename__ = "game_accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    player_profile_id = Column(
        String(36),
        ForeignKey("player_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    game_title = Column(String(50), nullable=False)
    in_game_name = Column(String(100), nullable=False)
    in_game_id = Column(String(100), nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    player_profile = relationship("PlayerProfile", back_populates="game_accounts")

    __table_args__ = (
        UniqueConstraint("player_profile_id", "game_title", name="uq_player_game_title"),
        UniqueConstraint("game_title", "in_game_id", name="uq_game_title_in_game_id"),
    )
