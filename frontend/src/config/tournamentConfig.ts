export const GAME_FREE_FIRE = 'Free Fire MAX';
export const GAME_BGMI = 'BGMI';
export const GAME_VALORANT = 'VALORANT';

export const ALLOWED_ENTRY_FEES_PER_PLAYER = [0, 5, 10, 25, 50] as const;
export const ALLOWED_ENTRY_TIERS = ALLOWED_ENTRY_FEES_PER_PLAYER;

export interface ModeConfig {
  teamSize: number;
  maxTeams: number;
  maxPlayerSlots: number;
  minTeams30Pct: number;
  minPlayers30Pct: number;
}

export const TOURNAMENT_MODES: Record<string, Record<string, ModeConfig>> = {
  [GAME_FREE_FIRE]: {
    squad: {
      teamSize: 4,
      maxTeams: 13,
      maxPlayerSlots: 52,
      minTeams30Pct: 4,
      minPlayers30Pct: 16,
    },
    duo: {
      teamSize: 2,
      maxTeams: 25,
      maxPlayerSlots: 50,
      minTeams30Pct: 8,
      minPlayers30Pct: 16,
    },
    solo: {
      teamSize: 1,
      maxTeams: 50,
      maxPlayerSlots: 50,
      minTeams30Pct: 15,
      minPlayers30Pct: 15,
    },
  },
  [GAME_BGMI]: {
    solo: {
      teamSize: 1,
      maxTeams: 100,
      maxPlayerSlots: 100,
      minTeams30Pct: 30,
      minPlayers30Pct: 30,
    },
    squad: {
      teamSize: 4,
      maxTeams: 25,
      maxPlayerSlots: 100,
      minTeams30Pct: 8,
      minPlayers30Pct: 32,
    },
    duo: {
      teamSize: 2,
      maxTeams: 50,
      maxPlayerSlots: 100,
      minTeams30Pct: 15,
      minPlayers30Pct: 30,
    },
  },
  [GAME_VALORANT]: {
    solo: {
      teamSize: 1,
      maxTeams: 50,
      maxPlayerSlots: 50,
      minTeams30Pct: 15,
      minPlayers30Pct: 15,
    },
    duo: {
      teamSize: 2,
      maxTeams: 25,
      maxPlayerSlots: 50,
      minTeams30Pct: 8,
      minPlayers30Pct: 16,
    },
  },
};

export const PLATFORM_GAME_MODES = TOURNAMENT_MODES;

export const RANK_PRIZE_PERCENTAGES = [
  { rank: 1, percentage: 50.0, frac: 0.50 },
  { rank: 2, percentage: 25.0, frac: 0.25 },
  { rank: 3, percentage: 15.0, frac: 0.15 },
  { rank: 4, percentage: 7.0, frac: 0.07 },
  { rank: 5, percentage: 3.0, frac: 0.03 },
] as const;

export const PRIZE_POOL_PERCENTAGE = 0.65;
export const RESERVE_PERCENTAGE = 0.35;

export function getModeConfig(gameTitle: string, format: string): ModeConfig | undefined {
  const normFormat = format.toLowerCase();
  return TOURNAMENT_MODES[gameTitle]?.[normFormat];
}

export function getTeamSize(gameTitle: string, format: string): number {
  const cfg = getModeConfig(gameTitle, format);
  if (cfg) return cfg.teamSize;
  const f = format.toLowerCase();
  if (f === '5v5') return 5;
  if (f === 'squad') return 4;
  if (f === 'duo') return 2;
  return 1;
}

export function calculateTeamEntryFee(
  entryFeePerPlayer: number,
  gameTitle: string,
  format: string
): number {
  const size = getTeamSize(gameTitle, format);
  return Math.max(0, entryFeePerPlayer * size);
}

export function getMinParticipationTarget(
  gameTitle: string,
  format: string,
  maxParticipants?: number
): { minTeams: number; minPlayers: number } {
  const cfg = getModeConfig(gameTitle, format);
  if (cfg && (!maxParticipants || maxParticipants === cfg.maxTeams)) {
    return { minTeams: cfg.minTeams30Pct, minPlayers: cfg.minPlayers30Pct };
  }
  const cap = maxParticipants && maxParticipants > 0 ? maxParticipants : (cfg?.maxTeams ?? 16);
  const size = getTeamSize(gameTitle, format);
  const minTeams = Math.ceil(cap * 0.3);
  return { minTeams, minPlayers: minTeams * size };
}

export function calculatePrizePool(
  confirmedEntries: number,
  entryFeePerPlayer: number,
  gameTitle: string,
  format: string
): {
  grossCollected: number;
  prizePool: number;
  reserveAmount: number;
  totalCollectedFees: number;
  platformReserve: number;
  costSafetyValid: boolean;
} {
  if (confirmedEntries <= 0 || entryFeePerPlayer <= 0) {
    return {
      grossCollected: 0,
      prizePool: 0,
      reserveAmount: 0,
      totalCollectedFees: 0,
      platformReserve: 0,
      costSafetyValid: true,
    };
  }
  const teamFee = calculateTeamEntryFee(entryFeePerPlayer, gameTitle, format);
  const grossCollected = confirmedEntries * teamFee;
  const prizePool = Math.floor(PRIZE_POOL_PERCENTAGE * grossCollected);
  const reserveAmount = grossCollected - prizePool;
  return {
    grossCollected,
    prizePool,
    reserveAmount,
    totalCollectedFees: grossCollected,
    platformReserve: reserveAmount,
    costSafetyValid: reserveAmount >= 0 && prizePool <= grossCollected,
  };
}

export interface RankAllocation {
  rank: number;
  percentage: number;
  amount: number;
  awardType: 'team' | 'individual';
  awardSemantics: string;
}

export function calculateRankDistribution(
  prizePool: number,
  isTeamFormat = false
): RankAllocation[] {
  const awardType = isTeamFormat ? 'team' : 'individual';
  const awardSemantics = isTeamFormat
    ? 'Team award (captain receives prize on behalf of team roster)'
    : 'Individual award';

  if (prizePool <= 0) {
    return RANK_PRIZE_PERCENTAGES.map((p) => ({
      rank: p.rank,
      percentage: p.percentage,
      amount: 0,
      awardType,
      awardSemantics,
    }));
  }

  const baseAllocations: RankAllocation[] = [];
  const remainders: { rem: number; rankPriority: number; index: number }[] = [];

  for (let i = 0; i < RANK_PRIZE_PERCENTAGES.length; i++) {
    const spec = RANK_PRIZE_PERCENTAGES[i];
    const exact = prizePool * spec.frac;
    const base = Math.floor(exact);
    const rem = exact - base;

    baseAllocations.push({
      rank: spec.rank,
      percentage: spec.percentage,
      amount: base,
      awardType,
      awardSemantics,
    });

    remainders.push({ rem, rankPriority: -spec.rank, index: i });
  }

  const distributedSoFar = baseAllocations.reduce((sum, item) => sum + item.amount, 0);
  const shortfall = prizePool - distributedSoFar;

  // Largest remainder sorting; on tie, higher rank wins
  remainders.sort((a, b) => {
    if (b.rem !== a.rem) return b.rem - a.rem;
    return b.rankPriority - a.rankPriority;
  });

  for (let i = 0; i < shortfall; i++) {
    const targetIdx = remainders[i].index;
    baseAllocations[targetIdx].amount += 1;
  }

  return baseAllocations;
}

export function getFormatDisplayLabel(gameTitle: string, format: string): string {
  const f = (format || '').toLowerCase();
  if (gameTitle === GAME_VALORANT) {
    if (f === 'solo') return '1v1';
    if (f === 'duo') return '2v2';
  }
  if (f === 'solo') return 'Solo';
  if (f === 'duo') return 'Duo';
  if (f === 'squad') return 'Squad';
  if (f === '5v5') return '5v5';
  return format;
}

export function getFormatLongLabel(gameTitle: string, format: string): string {
  const f = (format || '').toLowerCase();
  if (gameTitle === GAME_VALORANT) {
    if (f === 'solo') return '1v1 (Solo)';
    if (f === 'duo') return '2v2 (Duo)';
  }
  if (f === 'solo') return 'Solo (1 Player)';
  if (f === 'duo') return 'Duo (2 Players)';
  if (f === 'squad') return 'Squad (4 Players)';
  if (f === '5v5') return '5v5 (5 Players)';
  return format;
}
