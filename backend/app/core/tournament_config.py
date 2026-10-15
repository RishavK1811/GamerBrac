import math
from typing import Any, Dict, List, Optional, Tuple
from app.models.tournament import TournamentFormat

# Authoritative Game Title Constants
GAME_FREE_FIRE = "Free Fire MAX"
GAME_BGMI = "BGMI"
GAME_VALORANT = "VALORANT"

# Configurable Entry Tiers per player (in whole rupees)
ALLOWED_ENTRY_FEES_PER_PLAYER = [0, 5, 10, 25, 50]

# Authoritative Game Modes & Exact Capacities
# Each mode specifies:
# - team_size: player count per entry (1 for solo, 2 for duo, 4 for squad, 5 for 5v5)
# - max_teams: max registered entries (equals max_participants in database)
# - max_player_slots: total players across all teams (max_teams * team_size)
# - min_teams_30pct: ceiling(30% of max_teams)
# - min_players_30pct: min_teams_30pct * team_size
TOURNAMENT_MODES: Dict[str, Dict[str, Dict[str, int]]] = {
    GAME_FREE_FIRE: {
        TournamentFormat.SQUAD.value: {
            "team_size": 4,
            "max_teams": 13,
            "max_player_slots": 52,
            "min_teams_30pct": 4,
            "min_players_30pct": 16,
        },
        TournamentFormat.DUO.value: {
            "team_size": 2,
            "max_teams": 25,
            "max_player_slots": 50,
            "min_teams_30pct": 8,
            "min_players_30pct": 16,
        },
        TournamentFormat.SOLO.value: {
            "team_size": 1,
            "max_teams": 50,
            "max_player_slots": 50,
            "min_teams_30pct": 15,
            "min_players_30pct": 15,
        },
    },
    GAME_BGMI: {
        TournamentFormat.SOLO.value: {
            "team_size": 1,
            "max_teams": 100,
            "max_player_slots": 100,
            "min_teams_30pct": 30,
            "min_players_30pct": 30,
        },
        TournamentFormat.SQUAD.value: {
            "team_size": 4,
            "max_teams": 25,
            "max_player_slots": 100,
            "min_teams_30pct": 8,
            "min_players_30pct": 32,
        },
        TournamentFormat.DUO.value: {
            "team_size": 2,
            "max_teams": 50,
            "max_player_slots": 100,
            "min_teams_30pct": 15,
            "min_players_30pct": 30,
        },
    },
    GAME_VALORANT: {
        TournamentFormat.SOLO.value: {
            "team_size": 1,
            "max_teams": 50,
            "max_player_slots": 50,
            "min_teams_30pct": 15,
            "min_players_30pct": 15,
        },
        TournamentFormat.DUO.value: {
            "team_size": 2,
            "max_teams": 25,
            "max_player_slots": 50,
            "min_teams_30pct": 8,
            "min_players_30pct": 16,
        },
    },
}

# Proposed Rank Prize Percentages (Sum = 100%)
RANK_PRIZE_PERCENTAGES: List[Tuple[int, float]] = [
    (1, 0.50),  # Rank 1: 50%
    (2, 0.25),  # Rank 2: 25%
    (3, 0.15),  # Rank 3: 15%
    (4, 0.07),  # Rank 4: 7%
    (5, 0.03),  # Rank 5: 3%
]

PRIZE_POOL_PERCENTAGE = 0.65  # 65% prize pool floor
RESERVE_PERCENTAGE = 0.35     # 35% reserve for costs, refunds, gateway fees, taxes


def get_mode_config(game_title: str, format_val: str) -> Optional[Dict[str, int]]:
    """Retrieve authoritative configuration for a game and tournament format."""
    return TOURNAMENT_MODES.get(game_title, {}).get(format_val)


def get_team_size(game_title: str, format_val: str) -> int:
    """Return the team size (number of players per entry). Defaults to 1 for solo."""
    cfg = get_mode_config(game_title, format_val)
    if cfg:
        return cfg["team_size"]
    # Fallbacks based strictly on format
    if format_val == TournamentFormat.FIVE_V_FIVE.value:
        return 5
    if format_val == TournamentFormat.SQUAD.value:
        return 4
    if format_val == TournamentFormat.DUO.value:
        return 2
    return 1


def calculate_team_entry_fee(entry_fee_per_player: int, game_title: str, format_val: str) -> int:
    """Calculate the total entry fee for a team or solo player."""
    team_size = get_team_size(game_title, format_val)
    return max(0, entry_fee_per_player * team_size)


def get_min_participation_target(
    game_title: str,
    format_val: str,
    max_participants: Optional[int] = None,
) -> Tuple[int, int]:
    """
    Calculate minimum required 30% participation target: (min_teams, min_players).
    Uses the ceiling of 30% of the configured tournament capacity.
    """
    cfg = get_mode_config(game_title, format_val)
    if cfg and (max_participants is None or max_participants == cfg["max_teams"]):
        return cfg["min_teams_30pct"], cfg["min_players_30pct"]

    # Fallback for custom or test tournament capacities:
    cap = max_participants if (max_participants is not None and max_participants > 0) else (cfg["max_teams"] if cfg else 16)
    team_size = get_team_size(game_title, format_val)
    min_teams = math.ceil(cap * 0.3)
    min_players = min_teams * team_size
    return min_teams, min_players


def calculate_prize_pool(
    confirmed_entries: int,
    entry_fee_per_player: int,
    game_title: str,
    format_val: str,
) -> Tuple[int, int, int]:
    """
    Calculate gross collections, prize pool, and 35% reserve.
    Formula: Prize pool = floor(65% * eligible confirmed collected entry fees).
    Returns (gross_collected, prize_pool, reserve_amount).
    """
    if confirmed_entries <= 0 or entry_fee_per_player <= 0:
        return 0, 0, 0

    team_entry_fee = calculate_team_entry_fee(entry_fee_per_player, game_title, format_val)
    gross_collected = confirmed_entries * team_entry_fee
    prize_pool = math.floor(PRIZE_POOL_PERCENTAGE * gross_collected)
    reserve_amount = gross_collected - prize_pool
    return gross_collected, prize_pool, reserve_amount


def calculate_rank_distribution(
    prize_pool: int,
    is_team_format: bool = False,
) -> List[Dict[str, Any]]:
    """
    Distribute prize pool among ranks 1-5 using deterministic largest-remainder rounding (Hare-Niemeyer).
    Rank 1: 50%, Rank 2: 25%, Rank 3: 15%, Rank 4: 7%, Rank 5: 3%.
    - Every payout is a whole number of rupees.
    - Sum of all rank payouts equals the exact prize pool.
    - No rupee is lost or created.
    - Ties broken by higher rank priority.
    """
    award_type = "team" if is_team_format else "individual"
    award_semantics = (
        "Team award (captain receives prize for team roster)"
        if is_team_format
        else "Individual award"
    )

    if prize_pool <= 0:
        return [
            {
                "rank": rank,
                "percentage": round(frac * 100, 1),
                "amount": 0,
                "award_type": award_type,
                "award_semantics": award_semantics,
            }
            for rank, frac in RANK_PRIZE_PERCENTAGES
        ]

    base_allocations = []
    remainders = []

    for rank, frac in RANK_PRIZE_PERCENTAGES:
        exact = prize_pool * frac
        base = int(math.floor(exact))
        rem = exact - base
        base_allocations.append(
            {
                "rank": rank,
                "percentage": round(frac * 100, 1),
                "amount": base,
                "award_type": award_type,
                "award_semantics": award_semantics,
            }
        )
        remainders.append((rem, -rank, rank - 1))

    distributed_so_far = sum(item["amount"] for item in base_allocations)
    shortfall = prize_pool - distributed_so_far

    # Sort remainders: largest remainder first; if equal, higher rank wins
    remainders.sort(key=lambda x: (x[0], x[1]), reverse=True)

    for i in range(shortfall):
        idx = remainders[i][2]
        base_allocations[idx]["amount"] += 1

    return base_allocations
