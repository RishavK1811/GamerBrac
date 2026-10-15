from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.audit import ReportStatus


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str]
    action: str
    resource_type: str
    resource_id: Optional[str]
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime


class ReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reported_user_id: Optional[str] = None
    tournament_id: Optional[str] = None
    match_id: Optional[str] = None
    category: str = Field(..., min_length=2, max_length=50)
    description: str = Field(..., min_length=5, max_length=2000)
    evidence_url: Optional[str] = None


class ReportResolve(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: ReportStatus
    resolution_notes: Optional[str] = Field(None, max_length=2000)


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reporter_id: str
    reported_user_id: Optional[str]
    tournament_id: Optional[str]
    match_id: Optional[str]
    category: str
    description: str
    evidence_url: Optional[str]
    status: ReportStatus
    resolution_notes: Optional[str]
    resolved_by_id: Optional[str]
    created_at: datetime
    updated_at: datetime


class UserSuspensionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(..., min_length=3, max_length=500)
