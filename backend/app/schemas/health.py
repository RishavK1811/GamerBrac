from datetime import datetime, timezone
from typing import List
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = Field(..., description="Overall service status (healthy, degraded)")
    app_name: str = Field(..., description="Application name")
    version: str = Field(..., description="API version")
    environment: str = Field(..., description="Runtime environment")
    database: str = Field(..., description="Database connectivity status (connected, unavailable)")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of check")
    supported_games: List[str] = Field(
        default_factory=lambda: ["Free Fire MAX", "BGMI", "VALORANT"],
        description="Supported tournament titles on GamerBrac",
    )
