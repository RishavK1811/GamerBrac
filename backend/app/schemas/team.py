import re
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.player import SupportedGame
from app.models.team import TeamRole


class TeamCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=50, description="Unique team name")
    tag: str = Field(..., min_length=2, max_length=6, description="Short 2-6 char clan tag")
    primary_game: str = Field(..., description="Primary title: Free Fire MAX, BGMI, or VALORANT")
    logo_url: Optional[str] = Field(None, max_length=500)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not re.match(r"^[a-zA-Z0-9\s_\-\.]{3,50}$", cleaned):
            raise ValueError("Team name must contain 3-50 alphanumeric characters or spaces, dashes, dots")
        return cleaned

    @field_validator("tag")
    @classmethod
    def validate_tag(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not re.match(r"^[A-Z0-9]{2,6}$", cleaned):
            raise ValueError("Team tag must be 2-6 alphanumeric characters")
        return cleaned

    @field_validator("primary_game")
    @classmethod
    def validate_game(cls, v: str) -> str:
        valid_games = [g.value for g in SupportedGame]
        if v not in valid_games:
            raise ValueError(f"Invalid primary game '{v}'. Must be one of: {', '.join(valid_games)}")
        return v


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=50)
    tag: Optional[str] = Field(None, min_length=2, max_length=6)
    logo_url: Optional[str] = Field(None, max_length=500)

    @field_validator("tag")
    @classmethod
    def validate_tag(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip().upper()
            if not re.match(r"^[A-Z0-9]{2,6}$", cleaned):
                raise ValueError("Team tag must be 2-6 alphanumeric characters")
            return cleaned
        return v


class TeamMemberAdd(BaseModel):
    username_or_email: str = Field(..., description="Username or email of the player to add")
    role: TeamRole = Field(default=TeamRole.PLAYER, description="Roster role")


class TeamMemberResponse(BaseModel):
    id: str
    team_id: str
    user_id: str
    username: str
    display_name: Optional[str] = None
    role: TeamRole
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeamResponse(BaseModel):
    id: str
    name: str
    tag: str
    primary_game: str
    captain_id: str
    captain_username: Optional[str] = None
    logo_url: Optional[str] = None
    created_at: datetime
    members: List[TeamMemberResponse] = []

    model_config = ConfigDict(from_attributes=True)
