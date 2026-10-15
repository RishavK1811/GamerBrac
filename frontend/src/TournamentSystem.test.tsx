import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import {
  PLATFORM_GAME_MODES,
  ALLOWED_ENTRY_TIERS,
  getTeamSize,
  calculateTeamEntryFee,
  getMinParticipationTarget,
  calculatePrizePool,
  calculateRankDistribution,
  getFormatDisplayLabel,
  getFormatLongLabel,
} from './config/tournamentConfig';
import { TournamentDetailPage } from './pages/TournamentDetailPage';
import { AuthProvider } from './context';
import * as AuthContextModule from './context/useAuth';
import type { TournamentDetail } from './types';

describe('GamerBrac Tournament System — Config & Math Engine', () => {
  it('enforces authoritative game modes and exact slot capacities', () => {
    // Free Fire MAX
    expect(PLATFORM_GAME_MODES['Free Fire MAX'].squad).toEqual({
      teamSize: 4,
      maxTeams: 13,
      maxPlayerSlots: 52,
      minTeams30Pct: 4,
      minPlayers30Pct: 16,
    });
    expect(PLATFORM_GAME_MODES['Free Fire MAX'].duo).toEqual({
      teamSize: 2,
      maxTeams: 25,
      maxPlayerSlots: 50,
      minTeams30Pct: 8,
      minPlayers30Pct: 16,
    });
    expect(PLATFORM_GAME_MODES['Free Fire MAX'].solo).toEqual({
      teamSize: 1,
      maxTeams: 50,
      maxPlayerSlots: 50,
      minTeams30Pct: 15,
      minPlayers30Pct: 15,
    });

    // BGMI
    expect(PLATFORM_GAME_MODES['BGMI'].solo).toEqual({
      teamSize: 1,
      maxTeams: 100,
      maxPlayerSlots: 100,
      minTeams30Pct: 30,
      minPlayers30Pct: 30,
    });
    expect(PLATFORM_GAME_MODES['BGMI'].squad).toEqual({
      teamSize: 4,
      maxTeams: 25,
      maxPlayerSlots: 100,
      minTeams30Pct: 8,
      minPlayers30Pct: 32,
    });
    expect(PLATFORM_GAME_MODES['BGMI'].duo).toEqual({
      teamSize: 2,
      maxTeams: 50,
      maxPlayerSlots: 100,
      minTeams30Pct: 15,
      minPlayers30Pct: 30,
    });

    // VALORANT (strictly 1v1 Solo and 2v2 Duo)
    expect(Object.keys(PLATFORM_GAME_MODES['VALORANT'])).toEqual(['solo', 'duo']);
    expect(PLATFORM_GAME_MODES['VALORANT'].solo).toEqual({
      teamSize: 1,
      maxTeams: 50,
      maxPlayerSlots: 50,
      minTeams30Pct: 15,
      minPlayers30Pct: 15,
    });
    expect(PLATFORM_GAME_MODES['VALORANT'].duo).toEqual({
      teamSize: 2,
      maxTeams: 25,
      maxPlayerSlots: 50,
      minTeams30Pct: 8,
      minPlayers30Pct: 16,
    });
    expect(PLATFORM_GAME_MODES['VALORANT']['5v5']).toBeUndefined();
  });

  it('restricts entry fee tiers to configured values [0, 5, 10, 25, 50]', () => {
    expect(ALLOWED_ENTRY_TIERS).toEqual([0, 5, 10, 25, 50]);
  });

  it('calculates team sizes and team entry fees correctly', () => {
    expect(getTeamSize('Free Fire MAX', 'squad')).toBe(4);
    expect(getTeamSize('BGMI', 'duo')).toBe(2);
    expect(getTeamSize('VALORANT', 'solo')).toBe(1);
    expect(getTeamSize('VALORANT', 'duo')).toBe(2);
    expect(getTeamSize('BGMI', 'solo')).toBe(1);

    // Entry fee per player -> team fee
    expect(calculateTeamEntryFee(25, 'Free Fire MAX', 'squad')).toBe(100);
    expect(calculateTeamEntryFee(10, 'BGMI', 'duo')).toBe(20);
    expect(calculateTeamEntryFee(25, 'VALORANT', 'solo')).toBe(25);
    expect(calculateTeamEntryFee(25, 'VALORANT', 'duo')).toBe(50);
    expect(calculateTeamEntryFee(10, 'BGMI', 'solo')).toBe(10);

    // VALORANT 2v2 entry fee tiers: ₹5->₹10, ₹10->₹20, ₹25->₹50, ₹50->₹100
    expect(calculateTeamEntryFee(5, 'VALORANT', 'duo')).toBe(10);
    expect(calculateTeamEntryFee(10, 'VALORANT', 'duo')).toBe(20);
    expect(calculateTeamEntryFee(25, 'VALORANT', 'duo')).toBe(50);
    expect(calculateTeamEntryFee(50, 'VALORANT', 'duo')).toBe(100);
  });

  it('calculates 30% minimum participation ceiling targets', () => {
    // FF MAX Squad: 13 teams -> ceil(13 * 0.3) = 4 teams, 16 players
    const ffSquad = getMinParticipationTarget('Free Fire MAX', 'squad', 13);
    expect(ffSquad.minTeams).toBe(4);
    expect(ffSquad.minPlayers).toBe(16);

    // BGMI Squad: 25 teams -> ceil(25 * 0.3) = 8 teams, 32 players
    const bgmiSquad = getMinParticipationTarget('BGMI', 'squad', 25);
    expect(bgmiSquad.minTeams).toBe(8);
    expect(bgmiSquad.minPlayers).toBe(32);

    // BGMI Solo: 100 players -> ceil(100 * 0.3) = 30 players
    const bgmiSolo = getMinParticipationTarget('BGMI', 'solo', 100);
    expect(bgmiSolo.minTeams).toBe(30);
    expect(bgmiSolo.minPlayers).toBe(30);

    // VALORANT Solo (cap 50): 15 players (ceil(50 * 0.3))
    const valSolo = getMinParticipationTarget('VALORANT', 'solo', 50);
    expect(valSolo.minTeams).toBe(15);
    expect(valSolo.minPlayers).toBe(15);

    // VALORANT Duo (cap 25): 8 complete teams (ceil(25 * 0.3)), 16 players
    const valDuo = getMinParticipationTarget('VALORANT', 'duo', 25);
    expect(valDuo.minTeams).toBe(8);
    expect(valDuo.minPlayers).toBe(16);
  });

  it('formats display labels accurately for VALORANT 1v1 / 2v2 and other games', () => {
    expect(getFormatDisplayLabel('VALORANT', 'solo')).toBe('1v1');
    expect(getFormatDisplayLabel('VALORANT', 'duo')).toBe('2v2');
    expect(getFormatDisplayLabel('BGMI', 'solo')).toBe('Solo');
    expect(getFormatDisplayLabel('BGMI', 'duo')).toBe('Duo');
    expect(getFormatDisplayLabel('BGMI', 'squad')).toBe('Squad');

    expect(getFormatLongLabel('VALORANT', 'solo')).toBe('1v1 (Solo)');
    expect(getFormatLongLabel('VALORANT', 'duo')).toBe('2v2 (Duo)');
    expect(getFormatLongLabel('BGMI', 'solo')).toBe('Solo (1 Player)');
    expect(getFormatLongLabel('BGMI', 'duo')).toBe('Duo (2 Players)');
    expect(getFormatLongLabel('BGMI', 'squad')).toBe('Squad (4 Players)');
  });

  it('calculates floor(65%) prize pool and 35% platform reserve accurately', () => {
    // 25 teams of 4 players at ₹25/player = 100 players * 25 = ₹2,500 collected
    // Prize pool = floor(2500 * 0.65) = floor(1625) = 1625
    // Platform reserve = 2500 - 1625 = 875 (35%)
    const res = calculatePrizePool(25, 25, 'BGMI', 'squad');
    expect(res.totalCollectedFees).toBe(2500);
    expect(res.prizePool).toBe(1625);
    expect(res.platformReserve).toBe(875);
    expect(res.costSafetyValid).toBe(true);

    // 13 teams of 4 players at ₹50/player = 52 players * 50 = ₹2,600 collected
    // Prize pool = floor(2600 * 0.65) = 1690
    // Platform reserve = 910
    const resFF = calculatePrizePool(13, 50, 'Free Fire MAX', 'squad');
    expect(resFF.totalCollectedFees).toBe(2600);
    expect(resFF.prizePool).toBe(1690);
    expect(resFF.platformReserve).toBe(910);
    expect(resFF.costSafetyValid).toBe(true);
  });

  it('guarantees deterministic largest-remainder distribution summing exactly to the prize pool', () => {
    // Test various odd and arbitrary prize pools
    const testPools = [1, 2, 3, 5, 7, 10, 65, 100, 1625, 1690, 2337, 5000];

    testPools.forEach((pool) => {
      const distribution = calculateRankDistribution(pool, true);
      const sum = distribution.reduce((acc, cur) => acc + cur.amount, 0);

      expect(sum).toBe(pool);
      expect(distribution).toHaveLength(5);
      expect(distribution[0].rank).toBe(1);
      expect(distribution[0].percentage).toBe(50);
      expect(distribution[1].percentage).toBe(25);
      expect(distribution[2].percentage).toBe(15);
      expect(distribution[3].percentage).toBe(7);
      expect(distribution[4].percentage).toBe(3);
    });

    // Check tie-breaking: pool = 10
    // 50% = 5.0, 25% = 2.5, 15% = 1.5, 7% = 0.7, 3% = 0.3
    // Bases: 5, 2, 1, 0, 0 (sum = 8, remainder = 2)
    // Fractions: 0.0, 0.5, 0.5, 0.7, 0.3
    // Sorted fractions: Rank 4 (0.7), Rank 2 (0.5), Rank 3 (0.5), Rank 5 (0.3), Rank 1 (0.0)
    // Extra rupees given to Rank 4 and Rank 2 (tie-broken by higher rank over Rank 3)
    // Result: Rank 1: 5, Rank 2: 3, Rank 3: 1, Rank 4: 1, Rank 5: 0 (sum = 10)
    const dist10 = calculateRankDistribution(10, false);
    expect(dist10.map((d) => d.amount)).toEqual([5, 3, 1, 1, 0]);
    expect(dist10.reduce((a, b) => a + b.amount, 0)).toBe(10);
  });
});

describe('TournamentDetailPage — System UI Rendering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockPaidTournament: TournamentDetail = {
    id: 'tourney-paid-system-1',
    title: 'BGMI Pro Invitational Championship',
    game_title: 'BGMI',
    format: 'squad',
    status: 'registration_open',
    max_participants: 25,
    current_participants: 12,
    registration_deadline: '2027-05-01T18:00:00Z',
    start_datetime: '2027-05-02T14:00:00Z',
    organizer_id: 'org-sys-1',
    is_free_entry: false,
    entry_fee_per_player: 25,
    team_size: 4,
    max_player_slots: 100,
    current_player_slots: 48,
    team_entry_fee: 100,
    min_participants_30pct: 8,
    min_players_30pct: 32,
    confirmed_entries_count: 12,
    min_participation_met: true,
    prize_pool_preview: 780,
    require_complete_teams: true,
    rules: 'Official Krafton esports battle royale tournament scoring.',
    prize_pool_description: 'Deterministic 65% prize pool.',
  };

  it('renders paid tournament preview warning, gated buttons, and 4-card rules section', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      const headers = new Headers({ 'content-type': 'application/json' });
      if (urlStr.includes('/api/v1/tournaments/tourney-paid-system-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers,
          text: async () => JSON.stringify(mockPaidTournament),
          json: async () => mockPaidTournament,
        } as Response);
      }
      if (urlStr.includes('/matches')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers,
          text: async () => JSON.stringify([]),
          json: async () => [],
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers,
        text: async () => JSON.stringify({}),
        json: async () => ({}),
      } as Response);
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/tournaments/tourney-paid-system-1']}>
          <Routes>
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Title and entry tier badges
    expect(await screen.findByText('BGMI Pro Invitational Championship')).toBeInTheDocument();
    expect(screen.getByText('ENTRY TIER: ₹25')).toBeInTheDocument();

    // 4-Card Specifications, Rules & Terms section
    expect(screen.getByText('Tournament Specifications, Rules & Terms')).toBeInTheDocument();
    expect(screen.getByText('Format & Exact Capacities')).toBeInTheDocument();
    expect(screen.getByText('Entry & 30% Participation Policy')).toBeInTheDocument();
    expect(screen.getByText('Prize Pool & Rank Distribution')).toBeInTheDocument();
    expect(screen.getByText('Fair Play, Anti-Cheat & Publisher Notice')).toBeInTheDocument();

    // Capacity breakdown
    expect(screen.getByText(/25 Teams \(100 total player slots\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Authoritative Platform Capacities/i)).toBeInTheDocument();

    // 30% policy & refund statement
    expect(screen.getByText(/30% Min Target: 8/i)).toBeInTheDocument();
    expect(screen.getByText(/Automatic Cancellation & 100% Refund/i)).toBeInTheDocument();

    // Prize distribution table
    expect(screen.getByText('Floor 65% Pool')).toBeInTheDocument();
    expect(screen.getByText(/floor\(65% × collected fees\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Covers hosting, anti-cheat & ops/i)).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();

    // Device and publisher compliance notice
    expect(screen.getByText(/mobile only \(Android\/iOS\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Publisher Compliance Statement/i)).toBeInTheDocument();
    expect(screen.getByText(/GamerBrac is not affiliated with, endorsed by, or sponsored by Garena/i)).toBeInTheDocument();

    // Gated registration warning & Sign In to Register link
    expect(screen.getByText(/Preview Only — Real-Money Entry Disabled/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign In to Register/i })).toBeInTheDocument();

    // Organizer custom rules
    expect(screen.getByText(/Official Krafton esports battle royale tournament scoring/i)).toBeInTheDocument();
  });

  it('renders disabled gated registration button when user is logged in as captain', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: {
        id: 'user-cap-1',
        username: 'captain_alpha',
        email: 'captain@example.com',
        role: 'player',
        is_active: true,
        is_verified: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      token: 'mock-token',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshProfile: vi.fn(),
      clearError: vi.fn(),
    });

    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      const headers = new Headers({ 'content-type': 'application/json' });
      if (urlStr.includes('/api/v1/tournaments/tourney-paid-system-1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers,
          text: async () => JSON.stringify(mockPaidTournament),
          json: async () => mockPaidTournament,
        } as Response);
      }
      if (urlStr.includes('/teams/my-teams') || urlStr.includes('/teams')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers,
          text: async () => JSON.stringify([
            {
              id: 'team-bgmi-1',
              name: 'Alpha Squad',
              tag: 'ALPH',
              captain_id: 'user-cap-1',
              primary_game: 'BGMI',
              members: [
                { user_id: 'user-cap-1', role: 'captain' },
                { user_id: 'user-p2', role: 'member' },
                { user_id: 'user-p3', role: 'member' },
                { user_id: 'user-p4', role: 'member' },
              ],
            },
          ]),
          json: async () => [
            {
              id: 'team-bgmi-1',
              name: 'Alpha Squad',
              tag: 'ALPH',
              captain_id: 'user-cap-1',
              primary_game: 'BGMI',
              members: [
                { user_id: 'user-cap-1', role: 'captain' },
                { user_id: 'user-p2', role: 'member' },
                { user_id: 'user-p3', role: 'member' },
                { user_id: 'user-p4', role: 'member' },
              ],
            },
          ],
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers,
        text: async () => JSON.stringify([]),
        json: async () => [],
      } as Response);
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/tournaments/tourney-paid-system-1']}>
          <Routes>
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Gated button must appear and be disabled
    const gatedBtn = await screen.findByRole('button', { name: /Paid Registration Gated \(Preview\)/i });
    expect(gatedBtn).toBeInTheDocument();
    expect(gatedBtn).toBeDisabled();
  });
});
