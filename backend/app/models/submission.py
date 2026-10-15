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


class SubmissionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class ScoreSubmission(Base):
    __tablename__ = "score_submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    match_id = Column(
        String(36),
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    match_participant_id = Column(
        String(36),
        ForeignKey("match_participants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    submitted_by_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kills = Column(Integer, default=0, nullable=False)
    placement = Column(Integer, default=0, nullable=False)
    evidence_url = Column(String(500), nullable=False)
    evidence_file_name = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    status = Column(
        Enum(
            SubmissionStatus,
            values_callable=lambda obj: [e.value for e in obj],
            name="submission_status",
        ),
        default=SubmissionStatus.PENDING,
        nullable=False,
    )
    reviewed_by_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewer_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

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
    match = relationship("Match")
    match_participant = relationship("MatchParticipant")
    submitted_by = relationship("User", foreign_keys=[submitted_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])

    __table_args__ = (
        CheckConstraint("kills >= 0", name="ck_submission_kills_nonneg"),
        CheckConstraint("placement >= 0", name="ck_submission_placement_nonneg"),
    )


class MatchResult(Base):
    __tablename__ = "match_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    match_id = Column(
        String(36),
        ForeignKey("matches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    match_participant_id = Column(
        String(36),
        ForeignKey("match_participants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    placement = Column(Integer, nullable=False)
    kills = Column(Integer, nullable=False)
    placement_points = Column(Integer, default=0, nullable=False)
    kill_points = Column(Integer, default=0, nullable=False)
    total_points = Column(Integer, default=0, nullable=False)
    is_verified = Column(Boolean, default=True, nullable=False)

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
    match = relationship("Match")
    match_participant = relationship("MatchParticipant")

    __table_args__ = (
        UniqueConstraint(
            "match_id",
            "match_participant_id",
            name="uq_match_result_participant",
        ),
        CheckConstraint("kills >= 0", name="ck_match_result_kills_nonneg"),
        CheckConstraint("placement >= 1", name="ck_match_result_placement_positive"),
    )
