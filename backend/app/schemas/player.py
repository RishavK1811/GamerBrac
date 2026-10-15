import re
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.player import SupportedGame


class GameAccountCreate(BaseModel):
    game_title: str = Field(..., description="Supported game title")
    in_game_name: str = Field(..., min_length=2, max_length=50, description="In-game Name / IGN")
    in_game_id: str = Field(..., min_length=3, max_length=50, description="In-game UID or Riot ID")

    @field_validator("game_title")
    @classmethod
    def validate_game_title(cls, v: str) -> str:
        valid_titles = [g.value for g in SupportedGame]
        if v not in valid_titles:
            raise ValueError(f"Invalid game title '{v}'. Must be one of: {', '.join(valid_titles)}")
        return v

    @field_validator("in_game_id", "in_game_name")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Field cannot be empty or whitespace only")
        return cleaned


class GameAccountResponse(BaseModel):
    id: str
    game_title: str
    in_game_name: str
    in_game_id: str
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PlayerProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=2, max_length=50)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, max_length=500)
    phone_number: Optional[str] = Field(None, max_length=20)
    state_region: Optional[str] = Field(None, max_length=100)

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v and not re.match(r"^\+?[0-9\s\-]{7,15}$", v):
                raise ValueError("Invalid phone number format")
        return v


class PlayerProfileResponse(BaseModel):
    id: str
    user_id: str
    display_name: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    phone_number: Optional[str] = None
    state_region: Optional[str] = None
    created_at: datetime
    game_accounts: List[GameAccountResponse] = []

    model_config = ConfigDict(from_attributes=True)
