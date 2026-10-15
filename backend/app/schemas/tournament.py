from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.models.player import SupportedGame
from app.models.tournament import TournamentFormat, TournamentStatus, ParticipantStatus


# ---------------------------------------------------------------------------
# Tournament schemas
# ---------------------------------------------------------------------------

class TournamentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    game_title: SupportedGame
    format: TournamentFormat
    max_participants: int = Field(..., ge=2, le=1024)
    registration_deadline: datetime
    check_in_deadline: Optional[datetime] = None
    start_datetime: datetime
    rules: Optional[str] = Field(None, max_length=10000)
    prize_pool_description: Optional[str] = Field(None, max_length=2000)

    @model_validator(mode="after")
    def validate_dates(self) -> "TournamentCreate":
        if self.registration_deadline >= self.start_datetime:
            raise ValueError("registration_deadline must be before start_datetime")
        if self.check_in_deadline is not None:
            if self.check_in_deadline >= self.start_datetime:
                raise ValueError("check_in_deadline must be before start_datetime")
            if self.check_in_deadline <= self.registration_deadline:
                raise ValueError(
                    "check_in_deadline must be after registration_deadline"
                )
        return self


class TournamentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    max_participants: Optional[int] = Field(None, ge=2, le=1024)
    registration_deadline: Optional[datetime] = None
    check_in_deadline: Optional[datetime] = None
    start_datetime: Optional[datetime] = None
    rules: Optional[str] = Field(None, max_length=10000)
    prize_pool_description: Optional[str] = Field(None, max_length=2000)


class TournamentStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: TournamentStatus


class ParticipantSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    team_id: Optional[str]
    status: ParticipantStatus
    registered_at: datetime
    checked_in_at: Optional[datetime]
    username: Optional[str] = None
    team_name: Optional[str] = None
    team_tag: Optional[str] = None


class ParticipantStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ParticipantStatus


class TournamentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: Optional[str]
    game_title: str
    format: TournamentFormat
    status: TournamentStatus
    max_participants: int
    current_participants: int
    registration_deadline: datetime
    check_in_deadline: Optional[datetime]
    start_datetime: datetime
    organizer_id: str
    is_free_entry: bool
    rules: Optional[str]
    prize_pool_description: Optional[str]
    created_at: datetime
    updated_at: datetime
    participants: List[ParticipantSummary] = []


class TournamentListItem(BaseModel):
    """Lightweight tournament card for list views — omits participants and rules."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    game_title: str
    format: TournamentFormat
    status: TournamentStatus
    max_participants: int
    current_participants: int
    registration_deadline: datetime
    start_datetime: datetime
    organizer_id: str
    is_free_entry: bool


# ---------------------------------------------------------------------------
# Registration / check-in schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Required for team-based tournament formats (squad / 5v5)
    team_id: Optional[str] = None


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tournament_id: str
    user_id: str
    team_id: Optional[str]
    status: ParticipantStatus
    registered_at: datetime
    checked_in_at: Optional[datetime]


class WithdrawResponse(BaseModel):
    message: str


class MyRegistrationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    participant_id: str
    tournament_id: str
    tournament_title: str
    game_title: str
    format: str
    status: str
    max_participants: int
    current_participants: int
    start_datetime: datetime
    registration_deadline: datetime
    check_in_deadline: Optional[datetime] = None
    participant_status: ParticipantStatus
    registered_at: datetime
    checked_in_at: Optional[datetime] = None
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    team_tag: Optional[str] = None
