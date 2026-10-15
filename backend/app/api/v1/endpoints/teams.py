from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.team import Team, TeamMember, TeamRole
from app.models.tournament import (
    ParticipantStatus,
    Tournament,
    TournamentParticipant,
    TournamentStatus,
)
from app.models.user import User
from app.schemas.auth import MessageResponse
from app.schemas.team import (
    TeamCreate,
    TeamMemberAdd,
    TeamMemberResponse,
    TeamResponse,
    TeamUpdate,
)

router = APIRouter(prefix="/teams", tags=["Teams & Rosters"])


def format_team_response(team: Team) -> TeamResponse:
    """Helper to convert Team model to schema with nested member details."""
    members_data: List[TeamMemberResponse] = []
    for m in team.members:
        display_name = m.user.profile.display_name if m.user.profile else m.user.username
        members_data.append(
            TeamMemberResponse(
                id=m.id,
                team_id=m.team_id,
                user_id=m.user_id,
                username=m.user.username,
                display_name=display_name,
                role=m.role,
                joined_at=m.joined_at,
            )
        )

    return TeamResponse(
        id=team.id,
        name=team.name,
        tag=team.tag,
        primary_game=team.primary_game,
        captain_id=team.captain_id,
        captain_username=team.captain.username if team.captain else None,
        logo_url=team.logo_url,
        created_at=team.created_at,
        members=members_data,
    )


@router.post(
    "",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new competitive team",
)
def create_team(
    team_in: TeamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeamResponse:
    """Create a new team roster. The creator is automatically assigned as Team Captain."""
    # Verify uniqueness of team name
    existing_name = (
        db.query(Team)
        .filter(func.lower(Team.name) == team_in.name.lower())
        .first()
    )
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Team name '{team_in.name}' is already taken.",
        )

    # Verify uniqueness of team tag
    existing_tag = (
        db.query(Team)
        .filter(func.upper(Team.tag) == team_in.tag.upper())
        .first()
    )
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Team tag '{team_in.tag}' is already taken.",
        )

    new_team = Team(
        name=team_in.name.strip(),
        tag=team_in.tag.strip().upper(),
        primary_game=team_in.primary_game,
        logo_url=team_in.logo_url,
        captain_id=current_user.id,
    )
    db.add(new_team)
    db.flush()

    # Automatically add captain to roster
    captain_member = TeamMember(
        team_id=new_team.id,
        user_id=current_user.id,
        role=TeamRole.CAPTAIN,
    )
    db.add(captain_member)
    db.commit()
    db.refresh(new_team)

    return format_team_response(new_team)


MAX_ROSTER_LIMITS = {
    "Free Fire MAX": 6,
    "BGMI": 6,
    "VALORANT": 7,
}


@router.get(
    "/my",
    response_model=List[TeamResponse],
    summary="Get current user's teams",
)
def get_my_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[TeamResponse]:
    """Retrieve all teams where the current user is a member or captain."""
    team_ids = [
        row[0]
        for row in db.query(TeamMember.team_id)
        .filter(TeamMember.user_id == current_user.id)
        .all()
    ]
    teams = db.query(Team).filter(Team.id.in_(team_ids)).all() if team_ids else []
    return [format_team_response(t) for t in teams]


@router.get(
    "/{team_id}",
    response_model=TeamResponse,
    summary="Get team profile and active roster",
)
def get_team(
    team_id: str,
    db: Session = Depends(get_db),
) -> TeamResponse:
    """Fetch complete team information, captain metadata, and member roster."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    return format_team_response(team)


@router.post(
    "/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a player to team roster (Captain only)",
)
def add_team_member(
    team_id: str,
    member_in: TeamMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeamMemberResponse:
    """Add a player to the team. Only the designated team captain has permission to recruit."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    if team.captain_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Only the team captain can add roster members.",
        )

    # Find the target user by username or email
    target_identifier = member_in.username_or_email.strip().lower()
    target_user = (
        db.query(User)
        .filter(
            (func.lower(User.username) == target_identifier)
            | (func.lower(User.email) == target_identifier)
        )
        .first()
    )
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Player '{member_in.username_or_email}' not found.",
        )

    # Check if target user is already in this team
    existing_member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team.id, TeamMember.user_id == target_user.id)
        .first()
    )
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Player '{target_user.username}' is already a member of this team.",
        )

    # Enforce server-side roster limits based on primary game
    max_roster = MAX_ROSTER_LIMITS.get(team.primary_game, 6)
    current_roster_count = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
    if current_roster_count >= max_roster:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Team roster is full for '{team.primary_game}'. Maximum allowed is {max_roster} players.",
        )

    new_member = TeamMember(
        team_id=team.id,
        user_id=target_user.id,
        role=member_in.role,
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)

    display_name = target_user.profile.display_name if target_user.profile else target_user.username
    return TeamMemberResponse(
        id=new_member.id,
        team_id=new_member.team_id,
        user_id=new_member.user_id,
        username=target_user.username,
        display_name=display_name,
        role=new_member.role,
        joined_at=new_member.joined_at,
    )


@router.delete(
    "/{team_id}/members/{user_id}",
    response_model=MessageResponse,
    summary="Remove a player from team roster",
)
def remove_team_member(
    team_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Remove a player from team. Allowed by the team captain or the member departing voluntarily."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    # Check authorization: must be captain OR the player removing themselves
    if current_user.id != team.captain_id and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to remove this player from the team.",
        )

    # Captain cannot be removed directly
    if user_id == team.captain_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The team captain cannot be removed from the roster.",
        )

    member = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team.id, TeamMember.user_id == user_id)
        .first()
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team membership not found.",
        )

    db.delete(member)
    db.commit()

    return MessageResponse(message="Player removed from team roster successfully.")


@router.delete(
    "/{team_id}",
    response_model=MessageResponse,
    summary="Disband a team (Captain only)",
)
def disband_team(
    team_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """
    Disband an existing competitive team.
    Allowed only by the team captain.
    Rejects if team is currently registered in an upcoming or ongoing tournament.
    """
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    if team.captain_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Only the team captain can disband the team.",
        )

    # Check if team is registered in any active or upcoming tournament
    active_entry = (
        db.query(TournamentParticipant)
        .join(Tournament, TournamentParticipant.tournament_id == Tournament.id)
        .filter(
            TournamentParticipant.team_id == team.id,
            TournamentParticipant.status.notin_([ParticipantStatus.WITHDRAWN, ParticipantStatus.DISQUALIFIED]),
            Tournament.status.notin_([TournamentStatus.COMPLETED, TournamentStatus.CANCELLED]),
        )
        .first()
    )
    if active_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disband team while actively registered in an upcoming or ongoing tournament. Please withdraw from the tournament first.",
        )

    team_name = team.name
    db.delete(team)
    db.commit()

    return MessageResponse(message=f"Team '{team_name}' has been disbanded successfully.")
