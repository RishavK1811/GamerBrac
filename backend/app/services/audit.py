from typing import Optional
from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from app.models.notification import Notification


def log_audit_action(
    db: Session,
    user_id: Optional[str],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Create and persist an immutable audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    db.flush()
    return entry


def notify_user(
    db: Session,
    user_id: str,
    title: str,
    message: str,
    notification_type: str,
    link_url: Optional[str] = None,
) -> Notification:
    """Create and dispatch an in-app notification to a user."""
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link_url=link_url,
    )
    db.add(notif)
    db.flush()
    return notif
