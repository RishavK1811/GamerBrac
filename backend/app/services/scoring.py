from typing import Any, Dict, List, Tuple
from sqlalchemy.orm import Session
from app.models.match import Match, MatchParticipant
from app.models.submission import MatchResult
from app.models.tournament import TournamentParticipant, TournamentFormat


# Standard Battle Royale placement points mapping (BGMI / Free Fire MAX standard)
PLACEMENT_POINTS_TABLE: Dict[int, int] = {
    1: 10,
    2: 6,
    3: 5,
    4: 4,
    5: 3,
    6: 2,
    7: 1,
    8: 1,
}


def calculate_match_points(placement: int, kills: int) -> Tuple[int, int, int]:
    """
    Calculate (placement_points, kill_points, total_points).
    Placement points follow the standard esports battle royale table (top 8 score points).
    Each kill awards 1 point.
    """
    if placement < 1:
        placement = 1
    if kills < 0:
        kills = 0

    placement_pts = PLACEMENT_POINTS_TABLE.get(placement, 0)
    kill_pts = kills * 1
    total_pts = placement_pts + kill_pts
    return placement_pts, kill_pts, total_pts


def compute_tournament_leaderboard(db: Session, tournament_id: str) -> List[Dict[str, Any]]:
    """
    Compute aggregate leaderboard standings for all registered participants in a tournament.
    Tiebreaker order:
      1. Total points (descending)
      2. Total kills (descending)
      3. Total wins / #1 placements (descending)
      4. Matches played (ascending)
    """
    # 1. Fetch all tournament participants
    participants = (
        db.query(TournamentParticipant)
        .filter(TournamentParticipant.tournament_id == tournament_id)
        .all()
    )

    participant_map: Dict[str, Dict[str, Any]] = {}
    for p in participants:
        name = "Unknown Participant"
        tag = None
        if p.team:
            name = p.team.name
            tag = p.team.tag
        elif p.user and p.user.profile:
            name = p.user.profile.display_name or p.user.username
        elif p.user:
            name = p.user.username

        participant_map[p.id] = {
            "participant_id": p.id,
            "user_id": p.user_id,
            "team_id": p.team_id,
            "name": name,
            "tag": tag,
            "matches_played": 0,
            "wins": 0,
            "total_kills": 0,
            "placement_points": 0,
            "kill_points": 0,
            "total_points": 0,
        }

    # 2. Fetch all verified match results for matches belonging to this tournament
    results = (
        db.query(MatchResult)
        .join(Match, MatchResult.match_id == Match.id)
        .join(MatchParticipant, MatchResult.match_participant_id == MatchParticipant.id)
        .filter(
            Match.tournament_id == tournament_id,
            MatchResult.is_verified == True,
        )
        .all()
    )

    for r in results:
        mp = r.match_participant
        tp_id = mp.tournament_participant_id
        if tp_id in participant_map:
            entry = participant_map[tp_id]
            entry["matches_played"] += 1
            if r.placement == 1:
                entry["wins"] += 1
            entry["total_kills"] += r.kills
            entry["placement_points"] += r.placement_points
            entry["kill_points"] += r.kill_points
            entry["total_points"] += r.total_points

    # 3. Sort entries with tiebreakers
    entries = list(participant_map.values())
    entries.sort(
        key=lambda x: (
            x["total_points"],
            x["total_kills"],
            x["wins"],
            -x["matches_played"],
        ),
        reverse=True,
    )

    # 4. Assign 1-indexed ranks
    for idx, entry in enumerate(entries, start=1):
        entry["rank"] = idx

    return entries
