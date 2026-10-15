from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.match import MatchStatus


class MatchCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=3, max_length=100)
    match_number: int = Field(default=1, ge=1)
    round_number: int = Field(default=1, ge=1)
    scheduled_start_time: datetime


class MatchUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(None, min_length=3, max_length=100)
    match_number: Optional[int] = Field(None, ge=1)
    round_number: Optional[int] = Field(None, ge=1)
    scheduled_start_time: Optional[datetime] = None


class MatchStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: MatchStatus


class MatchParticipantAdd(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tournament_participant_id: str
    slot_number: Optional[int] = Field(None, ge=1, le=100)


class MatchParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    match_id: str
    tournament_participant_id: str
    slot_number: Optional[int]
    created_at: datetime


class MatchCredentialCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    room_id: str = Field(..., min_length=1, max_length=100)
    room_password: str = Field(..., min_length=1, max_length=100)
    release_at: datetime
    expires_at: datetime

    @model_validator(mode="after")
    def validate_window(self) -> "MatchCredentialCreate":
        if self.release_at >= self.expires_at:
            raise ValueError("release_at must be strictly before expires_at")
        return self


class MatchCredentialResponse(BaseModel):
    """Returned only to authorized players during release window, or tournament organizer/admin."""

    match_id: str
    room_id: str
    room_password: str
    release_at: datetime
    expires_at: datetime


class MatchResponse(BaseModel):
    """Public match detail response - never exposes room credentials or ciphertext."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tournament_id: str
    title: str
    match_number: int
    round_number: int
    status: MatchStatus
    scheduled_start_time: datetime
    has_credentials: bool = False
    release_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    participants: List[MatchParticipantResponse] = []


class MatchListItem(BaseModel):
    """Public lightweight match card for tournament matches list."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tournament_id: str
    title: str
    match_number: int
    round_number: int
    status: MatchStatus
    scheduled_start_time: datetime
    has_credentials: bool = False
    participants_count: int = 0
