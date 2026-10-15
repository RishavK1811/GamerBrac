import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class TournamentFormat(str, enum.Enum):
    SOLO = "solo"
    DUO = "duo"
    SQUAD = "squad"
    FIVE_V_FIVE = "5v5"


class TournamentStatus(str, enum.Enum):
    DRAFT = "draft"
    REGISTRATION_OPEN = "registration_open"
    REGISTRATION_CLOSED = "registration_closed"
    CHECK_IN = "check_in"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# Valid status transitions: from_status -> set of allowed to_statuses
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    TournamentStatus.DRAFT: {
        TournamentStatus.REGISTRATION_OPEN,
        TournamentStatus.CANCELLED,
    },
    TournamentStatus.REGISTRATION_OPEN: {
        TournamentStatus.REGISTRATION_CLOSED,
        TournamentStatus.CANCELLED,
    },
    TournamentStatus.REGISTRATION_CLOSED: {
        TournamentStatus.CHECK_IN,
        TournamentStatus.CANCELLED,
    },
    TournamentStatus.CHECK_IN: {
        TournamentStatus.ONGOING,
        TournamentStatus.CANCELLED,
    },
    TournamentStatus.ONGOING: {
        TournamentStatus.COMPLETED,
        TournamentStatus.CANCELLED,
    },
    TournamentStatus.COMPLETED: set(),  # Terminal state — no transitions
    TournamentStatus.CANCELLED: set(),  # Terminal state — no transitions
}


class ParticipantStatus(str, enum.Enum):
    REGISTERED = "registered"
    CHECKED_IN = "checked_in"
    DISQUALIFIED = "disqualified"
    WITHDRAWN = "withdrawn"


class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Game and format
    game_title = Column(String(50), nullable=False)          # SupportedGame value
    format = Column(
        Enum(
            TournamentFormat,
            values_callable=lambda obj: [e.value for e in obj],
            name="tournament_format",
        ),
        nullable=False,
    )

    # Status lifecycle
    status = Column(
        Enum(
            TournamentStatus,
            values_callable=lambda obj: [e.value for e in obj],
            name="tournament_status",
        ),
        default=TournamentStatus.DRAFT,
        nullable=False,
    )

    # Capacity
    max_participants = Column(Integer, nullable=False)
    current_participants = Column(Integer, default=0, nullable=False)

    # Scheduling
    registration_deadline = Column(DateTime(timezone=True), nullable=False)
    check_in_deadline = Column(DateTime(timezone=True), nullable=True)
    start_datetime = Column(DateTime(timezone=True), nullable=False)

    # Ownership
    organizer_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Free-entry enforcement (always True in MVP)
    is_free_entry = Column(Boolean, default=True, nullable=False)

    # Optional content fields
    rules = Column(Text, nullable=True)
    prize_pool_description = Column(Text, nullable=True)  # Sponsor info only

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
    organizer = relationship("User", back_populates="organized_tournaments")
    participants = relationship(
        "TournamentParticipant",
        back_populates="tournament",
        cascade="all, delete-orphan",
    )
    matches = relationship(
        "Match",
        back_populates="tournament",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("max_participants > 0", name="ck_tournament_max_participants_positive"),
        CheckConstraint(
            "current_participants >= 0",
            name="ck_tournament_current_participants_nonneg",
        ),
        CheckConstraint(
            "current_participants <= max_participants",
            name="ck_tournament_participants_within_cap",
        ),
    )


class TournamentParticipant(Base):
    """Unified participant record for both solo players and team registrations.

    For solo/duo formats: ``user_id`` is set, ``team_id`` is NULL.
    For squad/5v5 formats: ``team_id`` is set, ``user_id`` holds the captain
    who submitted the registration.
    """

    __tablename__ = "tournament_participants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tournament_id = Column(
        String(36),
        ForeignKey("tournaments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The user who performed the registration action (always present)
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Populated only for team-based registrations
    team_id = Column(
        String(36),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    status = Column(
        Enum(
            ParticipantStatus,
            values_callable=lambda obj: [e.value for e in obj],
            name="participant_status",
        ),
        default=ParticipantStatus.REGISTERED,
        nullable=False,
    )

    registered_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    checked_in_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    tournament = relationship("Tournament", back_populates="participants")
    user = relationship("User", back_populates="tournament_participations")
    team = relationship("Team", back_populates="tournament_entries")
    match_entries = relationship(
        "MatchParticipant",
        back_populates="tournament_participant",
        cascade="all, delete-orphan",
    )

    @property
    def username(self) -> Optional[str]:
        return self.user.username if self.user else None

    @property
    def team_name(self) -> Optional[str]:
        return self.team.name if self.team else None

    @property
    def team_tag(self) -> Optional[str]:
        return self.team.tag if self.team else None

    __table_args__ = (
        # One user can register for a tournament only once (solo) or one
        # team can register for a tournament only once (team mode).
        UniqueConstraint("tournament_id", "user_id", name="uq_tournament_user"),
        UniqueConstraint("tournament_id", "team_id", name="uq_tournament_team"),
    )
