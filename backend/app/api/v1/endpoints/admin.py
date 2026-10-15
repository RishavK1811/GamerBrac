from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.audit import AuditLog, Report, ReportStatus
from app.models.user import User, UserRole
from app.schemas.audit import (
    AuditLogResponse,
    ReportCreate,
    ReportResolve,
    ReportResponse,
    UserSuspensionRequest,
)
from app.schemas.auth import UserResponse
from app.services.audit import log_audit_action, notify_user

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Organizer Approvals
# ---------------------------------------------------------------------------

@router.get(
    "/organizers/pending",
    response_model=List[UserResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def list_pending_organizers(
    db: Session = Depends(get_db),
):
    """Admin: List unverified users registered with the organizer role."""
    return (
        db.query(User)
        .filter(
            User.role == UserRole.ORGANIZER,
            User.is_verified == False,
        )
        .all()
    )


@router.post(
    "/organizers/{user_id}/approve",
    response_model=UserResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def approve_organizer(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Approve an unverified organizer."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if user.role != UserRole.ORGANIZER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not an organizer.",
        )

    user.is_verified = True
    user.updated_at = datetime.now(timezone.utc)

    notify_user(
        db,
        user_id=user.id,
        title="Organizer Account Approved",
        message="Your organizer account has been officially verified by a GamerBrac administrator.",
        notification_type="organizer_approval",
    )

    log_audit_action(
        db,
        user_id=current_user.id,
        action="organizer_approved",
        resource_type="user",
        resource_id=user.id,
        details=f"Approved organizer @{user.username}",
    )

    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Account Suspension & Moderation
# ---------------------------------------------------------------------------

@router.get(
    "/users",
    response_model=List[UserResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def list_users(
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Admin: List users with optional role, active status, and search filters."""
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    if search:
        search_fmt = f"%{search}%"
        q = q.filter(User.username.ilike(search_fmt) | User.email.ilike(search_fmt))
    return q.order_by(User.created_at.desc()).offset(skip).limit(limit).all()


@router.post(
    "/users/{user_id}/suspend",
    response_model=UserResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def suspend_user(
    user_id: str,
    payload: UserSuspensionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Suspend a user account for policy violations."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend administrator accounts.",
        )

    user.is_active = False
    user.updated_at = datetime.now(timezone.utc)

    log_audit_action(
        db,
        user_id=current_user.id,
        action="user_suspended",
        resource_type="user",
        resource_id=user.id,
        details=f"Suspension reason: {payload.reason}",
    )

    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/users/{user_id}/reactivate",
    response_model=UserResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def reactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Reactivate a previously suspended user account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.is_active = True
    user.updated_at = datetime.now(timezone.utc)

    log_audit_action(
        db,
        user_id=current_user.id,
        action="user_reactivated",
        resource_type="user",
        resource_id=user.id,
        details="Account reactivated by administrator.",
    )

    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Reports Management
# ---------------------------------------------------------------------------

@router.post(
    "/reports",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_report(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit a report regarding misconduct, cheating, or dispute."""
    report = Report(
        reporter_id=current_user.id,
        reported_user_id=payload.reported_user_id,
        tournament_id=payload.tournament_id,
        match_id=payload.match_id,
        category=payload.category,
        description=payload.description,
        evidence_url=payload.evidence_url,
        status=ReportStatus.PENDING,
    )
    db.add(report)

    log_audit_action(
        db,
        user_id=current_user.id,
        action="report_submitted",
        resource_type="report",
        details=f"Category: {payload.category}",
    )

    db.commit()
    db.refresh(report)
    return report


@router.get(
    "/reports",
    response_model=List[ReportResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def list_reports(
    status_filter: Optional[ReportStatus] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Admin: List submitted dispute and misconduct reports."""
    q = db.query(Report)
    if status_filter:
        q = q.filter(Report.status == status_filter)
    return q.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()


@router.patch(
    "/reports/{report_id}/resolve",
    response_model=ReportResponse,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def resolve_report(
    report_id: str,
    payload: ReportResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin: Resolve or dismiss a submitted report."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    report.status = payload.status
    report.resolution_notes = payload.resolution_notes
    report.resolved_by_id = current_user.id
    report.updated_at = datetime.now(timezone.utc)

    notify_user(
        db,
        user_id=report.reporter_id,
        title="Report Updated",
        message=f"Your report regarding '{report.category}' has been {report.status.value}.",
        notification_type="report_resolved",
    )

    log_audit_action(
        db,
        user_id=current_user.id,
        action="report_resolved",
        resource_type="report",
        resource_id=report.id,
        details=f"Resolution: {payload.status.value} - {payload.resolution_notes or ''}",
    )

    db.commit()
    db.refresh(report)
    return report


# ---------------------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------------------

@router.get(
    "/audit-logs",
    response_model=List[AuditLogResponse],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def get_audit_logs(
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Admin: Query historical audit logs."""
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)
    return q.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
