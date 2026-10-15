import enum
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class TeamRole(str, enum.Enum):
    CAPTAIN = "captain"
    PLAYER = "player"
    SUBSTITUTE = "substitute"
    COACH = "coach"


class Team(Base):
    __tablename__ = "teams"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, index=True, nullable=False)
    tag = Column(String(10), unique=True, index=True, nullable=False)
    logo_url = Column(String(500), nullable=True)
    primary_game = Column(String(50), nullable=False)
    captain_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
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

    captain = relationship("User", back_populates="captained_teams", foreign_keys=[captain_id])
    members = relationship(
        "TeamMember",
        back_populates="team",
        cascade="all, delete-orphan",
    )
    tournament_entries = relationship(
        "TournamentParticipant",
        back_populates="team",
    )


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id = Column(
        String(36),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    role = Column(
        Enum(TeamRole, values_callable=lambda obj: [e.value for e in obj], name="team_role"),
        default=TeamRole.PLAYER,
        nullable=False,
    )
    joined_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    team = relationship("Team", back_populates="members")
    user = relationship("User", back_populates="team_memberships")

    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_member"),
    )
