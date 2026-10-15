import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.config import settings
from app.core.database import get_db
from app.models.match import Match, MatchParticipant
from app.models.submission import MatchResult, ScoreSubmission, SubmissionStatus
from app.models.team import TeamMember
from app.models.tournament import TournamentParticipant
from app.models.user import User, UserRole
from app.schemas.submission import (
    MatchResultResponse,
    ScoreSubmissionCreate,
    ScoreSubmissionResponse,
    ScoreSubmissionReview,
    ScoreSubmissionUpdate,
    TournamentLeaderboardResponse,
)
from app.services.audit import log_audit_action, notify_user
from app.services.scoring import calculate_match_points, compute_tournament_leaderboard
from app.services.storage import get_storage_service

router = APIRouter(tags=["submissions & leaderboards"])

# Allowed MIME types and corresponding magic byte headers
ALLOWED_MIME_TYPES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],
}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _get_match_or_404(db: Session, match_id: str) -> Match:
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found.")
    return match


def _user_is_participant(db: Session, user: User, match_participant: MatchParticipant) -> bool:
    """Verify if user is the assigned solo player or a member/captain of the assigned team."""
    tp = match_participant.tournament_participant
    if not tp:
        return False
    if tp.user_id == user.id:
        return True
    if tp.team_id:
        member = (
            db.query(TeamMember)
            .filter(
                TeamMember.team_id == tp.team_id,
                TeamMember.user_id == user.id,
            )
            .first()
        )
        return member is not None
    return False


# ---------------------------------------------------------------------------
# Evidence Upload & Private Storage Access
# ---------------------------------------------------------------------------

@router.post("/matches/{match_id}/evidence")
async def upload_evidence(
    match_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload score evidence screenshot to private storage with strict MIME, magic byte,
    and size validations.
    """
    _get_match_or_404(db, match_id)

    # 1. Extension check
    filename = file.filename or "evidence.png"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # 2. Content-Type check
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid content type '{file.content_type}'. Allowed: image/jpeg, image/png, image/webp",
        )

    # 3. Read content & size enforcement
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB.",
        )

    # 4. Magic bytes validation
    expected_magics = ALLOWED_MIME_TYPES[file.content_type]
    is_valid_magic = any(content.startswith(magic) for magic in expected_magics)
    if file.content_type == "image/webp":
        is_valid_magic = content.startswith(b"RIFF") and len(content) > 12 and content[8:12] == b"WEBP"

    if not is_valid_magic:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match image header signatures.",
        )

    # 5. Store in private storage backend (local disk or S3-compatible)
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    storage = get_storage_service()
    storage.save_file(safe_filename, content, file.content_type)

    evidence_url = f"/api/v1/matches/{match_id}/evidence/{safe_filename}"
    return {
        "evidence_url": evidence_url,
        "file_name": filename,
        "size_bytes": len(content),
    }


@router.get("/matches/{match_id}/evidence/{filename}")
def get_private_evidence(
    match_id: str,
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Securely serve evidence file from private storage.
    Strictly gated to: tournament owner organizer, admin, or the player/team who submitted it.
    """
    match = _get_match_or_404(db, match_id)
    tournament = match.tournament

    # Check if caller is tournament owner or admin
    is_owner_or_admin = (
        current_user.role == UserRole.ADMIN
        or tournament.organizer_id == current_user.id
    )

    if not is_owner_or_admin:
        # Check if caller submitted this evidence or is on the participant team
        submission = (
            db.query(ScoreSubmission)
            .filter(
                ScoreSubmission.match_id == match_id,
                ScoreSubmission.evidence_url.contains(filename),
            )
            .first()
        )
        if not submission or not _user_is_participant(db, current_user, submission.match_participant):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You are not authorized to view this evidence.",
            )

    # Strict path traversal defense
    clean_filename = os.path.basename(filename)
    if clean_filename != filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename: path traversal characters detected.",
        )

    base_dir = os.path.abspath(settings.EVIDENCE_STORAGE_DIR)
    safe_path = os.path.abspath(os.path.join(base_dir, clean_filename))
    if not safe_path.startswith(base_dir):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path traversal attempt blocked.",
        )

    storage = get_storage_service()
    if not storage.file_exists(clean_filename):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence file not found.")

    try:
        stream_gen, media_type = storage.get_file_stream(clean_filename)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidence file not found.")

    return StreamingResponse(
        stream_gen,
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{clean_filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


# ---------------------------------------------------------------------------
# Score Submissions
# ---------------------------------------------------------------------------

@router.post(
    "/matches/{match_id}/submissions",
    response_model=ScoreSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_match_score(
    match_id: str,
    payload: ScoreSubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit match score and evidence for organizer review."""
    match = _get_match_or_404(db, match_id)

    mp = (
        db.query(MatchParticipant)
        .filter(
            MatchParticipant.id == payload.match_participant_id,
            MatchParticipant.match_id == match_id,
        )
        .first()
    )
    if not mp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match participant not found in this match.",
        )

    # Verify caller represents this participant
    if not _user_is_participant(db, current_user, mp):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You cannot submit scores for another player or team.",
        )

    # "Players cannot edit verified results": check if approved result already exists
    verified_result = (
        db.query(MatchResult)
        .filter(
            MatchResult.match_id == match_id,
            MatchResult.match_participant_id == mp.id,
            MatchResult.is_verified == True,
        )
        .first()
    )
    if verified_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot submit score. Match results for this participant are already verified.",
        )

    # Check for existing submission
    existing_sub = (
        db.query(ScoreSubmission)
        .filter(
            ScoreSubmission.match_id == match_id,
            ScoreSubmission.match_participant_id == mp.id,
        )
        .first()
    )
    if existing_sub:
        if existing_sub.status == SubmissionStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot edit verified results.",
            )
        # Update existing pending submission
        existing_sub.kills = payload.kills
        existing_sub.placement = payload.placement
        existing_sub.evidence_url = payload.evidence_url
        existing_sub.evidence_file_name = payload.evidence_file_name
        existing_sub.notes = payload.notes
        existing_sub.status = SubmissionStatus.PENDING
        existing_sub.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing_sub)
        return existing_sub

    submission = ScoreSubmission(
        match_id=match_id,
        match_participant_id=mp.id,
        submitted_by_id=current_user.id,
        kills=payload.kills,
        placement=payload.placement,
        evidence_url=payload.evidence_url,
        evidence_file_name=payload.evidence_file_name,
        notes=payload.notes,
        status=SubmissionStatus.PENDING,
    )
    db.add(submission)

    # Notify tournament organizer
    notify_user(
        db,
        user_id=match.tournament.organizer_id,
        title="New Score Submission",
        message=f"A score was submitted for match '{match.title}' by {current_user.username}.",
        notification_type="score_submitted",
        link_url=f"/tournaments/{match.tournament_id}/matches/{match.id}",
    )

    db.commit()
    db.refresh(submission)
    return submission


@router.put(
    "/matches/{match_id}/submissions/{submission_id}",
    response_model=ScoreSubmissionResponse,
)
def update_score_submission(
    match_id: str,
    submission_id: str,
    payload: ScoreSubmissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a pending score submission. Blocked if submission has already been verified."""
    _get_match_or_404(db, match_id)

    submission = (
        db.query(ScoreSubmission)
        .filter(
            ScoreSubmission.id == submission_id,
            ScoreSubmission.match_id == match_id,
        )
        .first()
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    if not _user_is_participant(db, current_user, submission.match_participant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to edit this submission.",
        )

    # "Players cannot edit verified results"
    if submission.status == SubmissionStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Players cannot edit verified results.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(submission, field, val)

    submission.status = SubmissionStatus.PENDING
    submission.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(submission)
    return submission


@router.get(
    "/matches/{match_id}/submissions",
    response_model=List[ScoreSubmissionResponse],
)
def list_match_submissions(
    match_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List submissions for a match. Organizers/admins see all; players see their own."""
    match = _get_match_or_404(db, match_id)
    is_owner_or_admin = (
        current_user.role == UserRole.ADMIN
        or match.tournament.organizer_id == current_user.id
    )

    query = db.query(ScoreSubmission).filter(ScoreSubmission.match_id == match_id)
    if not is_owner_or_admin:
        query = query.filter(ScoreSubmission.submitted_by_id == current_user.id)

    return query.order_by(ScoreSubmission.created_at.desc()).all()


# ---------------------------------------------------------------------------
# Organizer Review & Match Results Generation
# ---------------------------------------------------------------------------

@router.patch(
    "/matches/{match_id}/submissions/{submission_id}/review",
    response_model=ScoreSubmissionResponse,
)
def review_score_submission(
    match_id: str,
    submission_id: str,
    payload: ScoreSubmissionReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ORGANIZER, UserRole.ADMIN)),
):
    """
    Review a score submission.
    Organizers may only review submissions for tournaments they own.
    Approving a submission generates a verified MatchResult.
    """
    match = _get_match_or_404(db, match_id)
    tournament = match.tournament

    # Ownership check
    if current_user.role != UserRole.ADMIN and tournament.organizer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this tournament. Cross-organizer review is forbidden.",
        )

    submission = (
        db.query(ScoreSubmission)
        .filter(
            ScoreSubmission.id == submission_id,
            ScoreSubmission.match_id == match_id,
        )
        .first()
    )
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    submission.status = payload.status
    submission.reviewer_notes = payload.reviewer_notes
    submission.reviewed_by_id = current_user.id
    submission.reviewed_at = datetime.now(timezone.utc)
    submission.updated_at = datetime.now(timezone.utc)

    if payload.status == SubmissionStatus.APPROVED:
        # Calculate points
        p_pts, k_pts, t_pts = calculate_match_points(submission.placement, submission.kills)

        # Upsert MatchResult
        match_result = (
            db.query(MatchResult)
            .filter(
                MatchResult.match_id == match_id,
                MatchResult.match_participant_id == submission.match_participant_id,
            )
            .first()
        )
        if match_result:
            match_result.placement = submission.placement
            match_result.kills = submission.kills
            match_result.placement_points = p_pts
            match_result.kill_points = k_pts
            match_result.total_points = t_pts
            match_result.is_verified = True
            match_result.updated_at = datetime.now(timezone.utc)
        else:
            match_result = MatchResult(
                match_id=match_id,
                match_participant_id=submission.match_participant_id,
                placement=submission.placement,
                kills=submission.kills,
                placement_points=p_pts,
                kill_points=k_pts,
                total_points=t_pts,
                is_verified=True,
            )
            db.add(match_result)

        # Notify submitter
        notify_user(
            db,
            user_id=submission.submitted_by_id,
            title="Score Approved",
            message=f"Your score submission for {match.title} was approved ({submission.kills} kills, #{submission.placement}).",
            notification_type="score_approved",
        )

        log_audit_action(
            db,
            user_id=current_user.id,
            action="score_approved",
            resource_type="score_submission",
            resource_id=submission.id,
            details=f"Placement: {submission.placement}, Kills: {submission.kills}, Points: {t_pts}",
        )

    elif payload.status == SubmissionStatus.REJECTED:
        notify_user(
            db,
            user_id=submission.submitted_by_id,
            title="Score Rejected",
            message=f"Your score submission for {match.title} was rejected. Note: {payload.reviewer_notes or 'No reason provided.'}",
            notification_type="score_rejected",
        )

        log_audit_action(
            db,
            user_id=current_user.id,
            action="score_rejected",
            resource_type="score_submission",
            resource_id=submission.id,
            details=payload.reviewer_notes,
        )

    db.commit()
    db.refresh(submission)
    return submission


# ---------------------------------------------------------------------------
# Tournament Leaderboard
# ---------------------------------------------------------------------------

@router.get(
    "/tournaments/{tournament_id}/leaderboard",
    response_model=TournamentLeaderboardResponse,
)
def get_tournament_leaderboard(
    tournament_id: str,
    db: Session = Depends(get_db),
):
    """
    Public leaderboard endpoint calculating cumulative scores, kills, wins,
    and tiebreaking ranks for all registered participants.
    """
    standings = compute_tournament_leaderboard(db, tournament_id)
    return TournamentLeaderboardResponse(
        tournament_id=tournament_id,
        standings=standings,
    )
