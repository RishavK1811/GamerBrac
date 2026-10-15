import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class MatchStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Match(Base):
    __tablename__ = "matches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tournament_id = Column(
        String(36),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(100), nullable=False)
    match_number = Column(Integer, default=1, nullable=False)
    round_number = Column(Integer, default=1, nullable=False)
    status = Column(
        Enum(
            MatchStatus,
            values_callable=lambda obj: [e.value for e in obj],
            name="match_status",
        ),
        default=MatchStatus.SCHEDULED,
        nullable=False,
    )
    scheduled_start_time = Column(DateTime(timezone=True), nullable=False)

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

    # Relationships
    tournament = relationship("Tournament", back_populates="matches")
    match_participants = relationship(
        "MatchParticipant",
        back_populates="match",
        cascade="all, delete-orphan",
    )
    credential = relationship(
        "MatchCredential",
        back_populates="match",
        uselist=False,
        cascade="all, delete-orphan",
    )


class MatchParticipant(Base):
    __tablename__ = "match_participants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    match_id = Column(
        String(36),
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tournament_participant_id = Column(
        String(36),
        ForeignKey("tournament_participants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slot_number = Column(Integer, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    match = relationship("Match", back_populates="match_participants")
    tournament_participant = relationship(
        "TournamentParticipant",
        back_populates="match_entries",
    )

    __table_args__ = (
        UniqueConstraint(
            "match_id",
            "tournament_participant_id",
            name="uq_match_tournament_participant",
        ),
    )


class MatchCredential(Base):
    __tablename__ = "match_credentials"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    match_id = Column(
        String(36),
        ForeignKey("matches.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    encrypted_room_id = Column(String(500), nullable=False)
    encrypted_room_password = Column(String(500), nullable=False)
    release_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

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

    # Relationships
    match = relationship("Match", back_populates="credential")

    __table_args__ = (
        CheckConstraint(
            "release_at < expires_at",
            name="ck_match_credential_release_before_expires",
        ),
    )
