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
    is_free_entry: bool = True
    entry_fee_per_player: int = Field(0, ge=0)
    require_complete_teams: bool = False

    @model_validator(mode="after")
    def validate_tournament_fields(self) -> "TournamentCreate":
        if self.registration_deadline >= self.start_datetime:
            raise ValueError("registration_deadline must be before start_datetime")
        if self.check_in_deadline is not None:
            if self.check_in_deadline >= self.start_datetime:
                raise ValueError("check_in_deadline must be before start_datetime")
            if self.check_in_deadline <= self.registration_deadline:
                raise ValueError(
                    "check_in_deadline must be after registration_deadline"
                )
        if not self.is_free_entry and self.entry_fee_per_player == 0:
            self.entry_fee_per_player = 5
        if self.entry_fee_per_player not in [0, 5, 10, 25, 50]:
            raise ValueError(
                f"entry_fee_per_player must be one of [0, 5, 10, 25, 50], got {self.entry_fee_per_player}"
            )
        if self.is_free_entry and self.entry_fee_per_player != 0:
            raise ValueError("entry_fee_per_player must be 0 for free-entry tournaments")
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
    is_free_entry: Optional[bool] = None
    entry_fee_per_player: Optional[int] = Field(None, ge=0)
    require_complete_teams: Optional[bool] = None

    @model_validator(mode="after")
    def validate_entry_fee(self) -> "TournamentUpdate":
        if self.entry_fee_per_player is not None and self.entry_fee_per_player not in [0, 5, 10, 25, 50]:
            raise ValueError(
                f"entry_fee_per_player must be one of [0, 5, 10, 25, 50], got {self.entry_fee_per_player}"
            )
        return self


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
    entry_fee_per_player: int = 0
    require_complete_teams: bool = False
    rules: Optional[str]
    prize_pool_description: Optional[str]
    created_at: datetime
    updated_at: datetime
    participants: List[ParticipantSummary] = []

    # Computed fields for capacities, participation, and prize pool preview
    team_size: int = 1
    team_entry_fee: int = 0
    max_player_slots: int = 0
    current_player_slots: int = 0
    min_participants_30pct: int = 0
    min_players_30pct: int = 0
    confirmed_entries_count: int = 0
    confirmed_players_count: int = 0
    min_participation_met: bool = False
    requires_cancellation: bool = False
    prize_pool_preview: int = 0


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
    entry_fee_per_player: int = 0
    require_complete_teams: bool = False
    team_size: int = 1
    team_entry_fee: int = 0
    max_player_slots: int = 0
    min_participants_30pct: int = 0
    confirmed_entries_count: int = 0
    min_participation_met: bool = False


# ---------------------------------------------------------------------------
# Financial preview & Mode config schemas
# ---------------------------------------------------------------------------

class RankPayoutAllocation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rank: int
    percentage: float
    amount: int
    award_type: str
    award_semantics: str


class TournamentFinancialPreview(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tournament_id: str
    tournament_title: str
    is_free_entry: bool
    entry_fee_per_player: int
    team_size: int
    team_entry_fee: int
    confirmed_entries: int
    eligible_participants_count: int
    gross_collected_fees: int
    prize_pool: int
    prize_pool_percentage: float = 65.0
    reserve_amount: int
    reserve_percentage: float = 35.0
    expected_costs: Optional[int] = None
    cost_safety_warning: Optional[str] = None
    is_projection_complete: bool = False
    payout_allocations: List[RankPayoutAllocation] = []
    disclaimer: str


class GameModeConfigItem(BaseModel):
    game_title: str
    format: str
    team_size: int
    max_teams: int
    max_player_slots: int
    min_teams_30pct: int
    min_players_30pct: int


class PlatformModesConfigResponse(BaseModel):
    modes: List[GameModeConfigItem]
    allowed_entry_fees_per_player: List[int]
    paid_tournaments_enabled: bool


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
    user_id: Optional[str] = None
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
