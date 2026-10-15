from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.submission import SubmissionStatus


class ScoreSubmissionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    match_participant_id: str
    kills: int = Field(default=0, ge=0)
    placement: int = Field(default=1, ge=1)
    evidence_url: str = Field(..., min_length=1, max_length=500)
    evidence_file_name: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=2000)


class ScoreSubmissionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kills: Optional[int] = Field(None, ge=0)
    placement: Optional[int] = Field(None, ge=1)
    evidence_url: Optional[str] = Field(None, min_length=1, max_length=500)
    evidence_file_name: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=2000)


class ScoreSubmissionReview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: SubmissionStatus
    reviewer_notes: Optional[str] = Field(None, max_length=2000)


class ScoreSubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    match_id: str
    match_participant_id: str
    submitted_by_id: str
    kills: int
    placement: int
    evidence_url: str
    evidence_file_name: Optional[str]
    notes: Optional[str]
    status: SubmissionStatus
    reviewed_by_id: Optional[str]
    reviewer_notes: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class MatchResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    match_id: str
    match_participant_id: str
    placement: int
    kills: int
    placement_points: int
    kill_points: int
    total_points: int
    is_verified: bool
    created_at: datetime
    updated_at: datetime


class LeaderboardEntry(BaseModel):
    rank: int
    participant_id: str
    user_id: Optional[str] = None
    team_id: Optional[str] = None
    name: str
    tag: Optional[str] = None
    matches_played: int
    wins: int
    total_kills: int
    placement_points: int
    kill_points: int
    total_points: int


class TournamentLeaderboardResponse(BaseModel):
    tournament_id: str
    standings: List[LeaderboardEntry]
