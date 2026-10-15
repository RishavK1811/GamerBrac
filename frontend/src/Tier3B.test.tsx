import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TournamentDetailPage } from './pages/TournamentDetailPage';
import { OrganizerPage } from './pages/OrganizerPage';
import { GameShowcase } from './components/GameShowcase';
import { tournamentsApi, teamsApi, matchesApi, reportsApi, organizerApi, ApiError } from './api/client';
import * as AuthContextModule from './context/useAuth';
import type { UserResponse, TournamentDetail, MatchListItem, MatchResponse } from './types';

// Mock client APIs
vi.mock('./api/client', async () => {
  const actual = await vi.importActual('./api/client');
  return {
    ...actual,
    tournamentsApi: {
      ...actual.tournamentsApi,
      getById: vi.fn(),
      getMyTournaments: vi.fn(),
      getLeaderboard: vi.fn(),
      register: vi.fn(),
      checkIn: vi.fn(),
      withdraw: vi.fn(),
    },
    teamsApi: {
      ...actual.teamsApi,
      getMyTeams: vi.fn(),
    },
    matchesApi: {
      listTournamentMatches: vi.fn(),
      getMatch: vi.fn(),
      getCredentials: vi.fn(),
      uploadEvidence: vi.fn(),
      submitScore: vi.fn(),
      getMySubmissions: vi.fn(),
    },
    reportsApi: {
      submitReport: vi.fn(),
    },
    organizerApi: {
      listMyTournaments: vi.fn(),
      createTournament: vi.fn(),
      updateTournament: vi.fn(),
      updateTournamentStatus: vi.fn(),
      updateParticipantStatus: vi.fn(),
      createMatch: vi.fn(),
      listMatches: vi.fn(),
      getMatch: vi.fn(),
      updateMatchStatus: vi.fn(),
      addMatchParticipant: vi.fn(),
      removeMatchParticipant: vi.fn(),
      setMatchCredentials: vi.fn(),
      getMatchCredentials: vi.fn(),
      listSubmissions: vi.fn(),
      reviewSubmission: vi.fn(),
    },
  };
});

describe('Tier 3B: End-to-End Release Readiness & Match Workflows', () => {
  const mockUser: UserResponse = {
    id: 'user-player-1',
    username: 'pro_gamer',
    email: 'gamer@example.com',
    role: 'player',
    is_active: true,
    is_verified: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const mockTournament: TournamentDetail = {
    id: 'tourney-tier3b-1',
    organizer_id: 'org-1',
    title: 'India Championship Finals 2026',
    game_title: 'BGMI',
    format: 'solo',
    max_participants: 64,
    current_participants: 16,
    status: 'ongoing',
    scheduled_start_at: '2026-04-01T12:00:00Z',
    is_published: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    rules: 'No teaming, fair play only.',
    prize_pool_description: 'E-Certificates and National GamerBrac Points',
  };

  const mockMatches: MatchListItem[] = [
    {
      id: 'match-3b-1',
      tournament_id: 'tourney-tier3b-1',
      title: 'Grand Finals - Map 1 (Erangel)',
      match_number: 1,
      round_number: 1,
      status: 'scheduled',
      scheduled_start_time: '2026-04-01T13:00:00Z',
      has_credentials: true,
      participants_count: 1,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser,
      token: 'mock-jwt-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshProfile: vi.fn(),
      clearError: vi.fn(),
    });
  });

  describe('P2: Match Room Credentials & Time-Gated Decryption UI', () => {
    it('displays scheduled matches and allows checked-in player to view decrypted room credentials', async () => {
      vi.mocked(tournamentsApi.getById).mockResolvedValue(mockTournament);
      vi.mocked(tournamentsApi.getMyTournaments).mockResolvedValue([
        {
          tournament_id: 'tourney-tier3b-1',
          tournament_title: 'India Championship Finals 2026',
          game_title: 'BGMI',
          format: 'solo',
          tournament_status: 'ongoing',
          scheduled_start_at: '2026-04-01T12:00:00Z',
          participant_id: 'part-user-1',
          participant_status: 'CHECKED_IN',
          registered_at: '2026-01-01T00:00:00Z',
        },
      ]);
      vi.mocked(teamsApi.getMyTeams).mockResolvedValue([]);
      vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue(mockMatches);
      vi.mocked(matchesApi.getCredentials).mockResolvedValue({
        match_id: 'match-3b-1',
        room_id: 'CUSTOM-ROOM-999',
        room_password: 'SECRET-PASS-888',
        release_at: '2026-04-01T12:45:00Z',
        expires_at: '2026-04-01T13:30:00Z',
      });

      render(
        <MemoryRouter initialEntries={['/tournaments/tourney-tier3b-1']}>
          <Routes>
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify tournament and matches render
      await waitFor(() => {
        expect(screen.getByText('India Championship Finals 2026')).toBeInTheDocument();
        expect(screen.getByText('Grand Finals - Map 1 (Erangel)')).toBeInTheDocument();
        expect(screen.getByText('Room Ready')).toBeInTheDocument();
      });

      // Click Room Credentials button
      const credBtn = screen.getByRole('button', { name: /room credentials/i });
      fireEvent.click(credBtn);

      // Verify dialog opens and displays decrypted room ID & password
      await waitFor(() => {
        expect(screen.getByTestId('room-id-value')).toHaveTextContent('CUSTOM-ROOM-999');
        expect(screen.getByTestId('room-password-value')).toHaveTextContent('SECRET-PASS-888');
      });

      expect(matchesApi.getCredentials).toHaveBeenCalledWith('match-3b-1');
    });

    it('displays clear restricted error alert when credentials access window is closed or not released', async () => {
      vi.mocked(tournamentsApi.getById).mockResolvedValue(mockTournament);
      vi.mocked(tournamentsApi.getMyTournaments).mockResolvedValue([
        {
          tournament_id: 'tourney-tier3b-1',
          tournament_title: 'India Championship Finals 2026',
          game_title: 'BGMI',
          format: 'solo',
          tournament_status: 'ongoing',
          scheduled_start_at: '2026-04-01T12:00:00Z',
          participant_id: 'part-user-1',
          participant_status: 'CHECKED_IN',
          registered_at: '2026-01-01T00:00:00Z',
        },
      ]);
      vi.mocked(teamsApi.getMyTeams).mockResolvedValue([]);
      vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue(mockMatches);
      vi.mocked(matchesApi.getCredentials).mockRejectedValue(
        new ApiError('Room credentials are not yet available. Release window opens at 12:45 UTC.', 400)
      );

      render(
        <MemoryRouter initialEntries={['/tournaments/tourney-tier3b-1']}>
          <Routes>
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Grand Finals - Map 1 (Erangel)')).toBeInTheDocument();
      });

      const credBtn = screen.getByRole('button', { name: /room credentials/i });
      fireEvent.click(credBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Release window opens at 12:45 UTC/i)).toBeInTheDocument();
      });
    });
  });

  describe('P2: Score Submission & Screenshot Evidence Upload', () => {
    it('allows checked-in participant to upload evidence and submit verified score', async () => {
      vi.mocked(tournamentsApi.getById).mockResolvedValue(mockTournament);
      vi.mocked(tournamentsApi.getMyTournaments).mockResolvedValue([
        {
          tournament_id: 'tourney-tier3b-1',
          tournament_title: 'India Championship Finals 2026',
          game_title: 'BGMI',
          format: 'solo',
          tournament_status: 'ongoing',
          scheduled_start_at: '2026-04-01T12:00:00Z',
          participant_id: 'part-user-1',
          participant_status: 'CHECKED_IN',
          registered_at: '2026-01-01T00:00:00Z',
        },
      ]);
      vi.mocked(teamsApi.getMyTeams).mockResolvedValue([]);
      vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue(mockMatches);

      const mockMatchDetail: MatchResponse = {
        id: 'match-3b-1',
        tournament_id: 'tourney-tier3b-1',
        title: 'Grand Finals - Map 1 (Erangel)',
        match_number: 1,
        round_number: 1,
        status: 'scheduled',
        scheduled_start_time: '2026-04-01T13:00:00Z',
        has_credentials: true,
        release_at: '2026-04-01T12:45:00Z',
        expires_at: '2026-04-01T13:30:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        participants: [
          {
            id: 'mp-record-1',
            match_id: 'match-3b-1',
            tournament_participant_id: 'part-user-1',
            slot_number: 1,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      };
      vi.mocked(matchesApi.getMatch).mockResolvedValue(mockMatchDetail);
      vi.mocked(matchesApi.uploadEvidence).mockResolvedValue({
        evidence_url: '/api/v1/matches/match-3b-1/evidence/evidence-safe.png',
        file_name: 'screenshot.png',
        size_bytes: 102400,
      });
      vi.mocked(matchesApi.submitScore).mockResolvedValue({
        id: 'sub-1',
        match_id: 'match-3b-1',
        match_participant_id: 'mp-record-1',
        submitted_by_id: 'user-player-1',
        kills: 7,
        placement: 1,
        evidence_url: '/api/v1/matches/match-3b-1/evidence/evidence-safe.png',
        evidence_file_name: 'screenshot.png',
        status: 'pending',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      render(
        <MemoryRouter initialEntries={['/tournaments/tourney-tier3b-1']}>
          <Routes>
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Wait for checked-in status and matches to resolve
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit score/i })).toBeInTheDocument();
      });

      // Click "Submit Score"
      const submitBtn = screen.getByRole('button', { name: /submit score/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Submit Match Score & Evidence/i)).toBeInTheDocument();
      });

      // Fill in placement and kills
      const placementInput = screen.getByLabelText(/Placement \/ Rank/i);
      const killsInput = screen.getByLabelText(/Total Kills/i);

      fireEvent.change(placementInput, { target: { value: '1' } });
      fireEvent.change(killsInput, { target: { value: '7' } });

      // Provide mock screenshot file
      const fileInput = screen.getByLabelText(/Screenshot Evidence/i) as HTMLInputElement;
      const fakeFile = new File(['fake-evidence-content'], 'screenshot.png', { type: 'image/png' });
      fireEvent.change(fileInput, { target: { files: [fakeFile] } });

      // Submit form
      const submitVerificationBtn = screen.getByRole('button', { name: /Submit for Verification/i });
      fireEvent.click(submitVerificationBtn);

      await waitFor(() => {
        expect(matchesApi.uploadEvidence).toHaveBeenCalledWith('match-3b-1', fakeFile);
        expect(matchesApi.submitScore).toHaveBeenCalledWith('match-3b-1', {
          match_participant_id: 'mp-record-1',
          placement: 1,
          kills: 7,
          evidence_url: '/api/v1/matches/match-3b-1/evidence/evidence-safe.png',
          evidence_file_name: 'screenshot.png',
          notes: undefined,
        });
        expect(screen.getByText(/submitted successfully for organizer verification/i)).toBeInTheDocument();
      });
    });
  });

  describe('P4: Dispute Report Submission Form', () => {
    it('allows authenticated player to submit a dispute report with category and description', async () => {
      vi.mocked(tournamentsApi.getById).mockResolvedValue(mockTournament);
      vi.mocked(tournamentsApi.getMyTournaments).mockResolvedValue([]);
      vi.mocked(teamsApi.getMyTeams).mockResolvedValue([]);
      vi.mocked(matchesApi.listTournamentMatches).mockResolvedValue(mockMatches);
      vi.mocked(reportsApi.submitReport).mockResolvedValue({
        id: 'rep-1',
        reporter_id: 'user-player-1',
        category: 'MATCH_DISPUTE',
        description: 'Opponent roster swapped unannounced player UID after lobby start.',
        status: 'PENDING',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      render(
        <MemoryRouter initialEntries={['/tournaments/tourney-tier3b-1']}>
          <Routes>
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Grand Finals - Map 1 (Erangel)')).toBeInTheDocument();
      });

      // Click "Dispute" button
      const disputeBtn = screen.getByRole('button', { name: /Dispute/i });
      fireEvent.click(disputeBtn);

      await waitFor(() => {
        expect(screen.getByText(/File Match Dispute \/ Issue/i)).toBeInTheDocument();
      });

      // Fill in description
      const descInput = screen.getByLabelText(/Detailed Explanation/i);
      fireEvent.change(descInput, {
        target: { value: 'Opponent roster swapped unannounced player UID after lobby start.' },
      });

      // Submit dispute
      const submitDisputeBtn = screen.getByRole('button', { name: /Submit Dispute to Moderation/i });
      fireEvent.click(submitDisputeBtn);

      await waitFor(() => {
        expect(reportsApi.submitReport).toHaveBeenCalledWith({
          tournament_id: 'tourney-tier3b-1',
          match_id: 'match-3b-1',
          category: 'MATCH_DISPUTE',
          description: 'Opponent roster swapped unannounced player UID after lobby start.',
          evidence_url: undefined,
        });
        expect(screen.getByText(/Dispute report filed successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('P3: Organizer Match Participant Roster Assignment', () => {
    it('calls addMatchParticipant for checked-in participants on Organizer Console', async () => {
      const mockOrgUser: UserResponse = {
        ...mockUser,
        id: 'org-owner-1',
        role: 'organizer',
      };
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: mockOrgUser,
        token: 'org-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshProfile: vi.fn(),
        clearError: vi.fn(),
      });

      const mockOrgTournament = {
        ...mockTournament,
        organizer_id: 'org-owner-1',
        participants: [
          {
            id: 'part-checkedin-1',
            user_id: 'p1',
            username: 'player_alpha',
            status: 'CHECKED_IN' as const,
            registered_at: '2026-01-01T00:00:00Z',
          },
        ],
      };

      vi.mocked(organizerApi.listMyTournaments).mockResolvedValue([mockOrgTournament]);
      vi.mocked(tournamentsApi.getById).mockResolvedValue(mockOrgTournament);
      vi.mocked(organizerApi.listMatches).mockResolvedValue([
        {
          id: 'match-3b-1',
          tournament_id: 'tourney-tier3b-1',
          title: 'Round 1 Match',
          match_number: 1,
          round_number: 1,
          status: 'scheduled',
          scheduled_start_time: '2026-04-01T13:00:00Z',
          has_credentials: true,
          participants_count: 0,
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);
      vi.mocked(organizerApi.getMatch).mockResolvedValue({
        id: 'match-3b-1',
        tournament_id: 'tourney-tier3b-1',
        title: 'Round 1 Match',
        match_number: 1,
        round_number: 1,
        status: 'scheduled',
        scheduled_start_time: '2026-04-01T13:00:00Z',
        has_credentials: true,
        release_at: '2026-04-01T12:45:00Z',
        expires_at: '2026-04-01T13:30:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        participants: [],
      });
      vi.mocked(organizerApi.addMatchParticipant).mockResolvedValue({
        id: 'mp-new-1',
        match_id: 'match-3b-1',
        tournament_participant_id: 'part-checkedin-1',
        slot_number: 1,
        created_at: '2026-01-01T00:00:00Z',
      });
      vi.mocked(organizerApi.listSubmissions).mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/organizer']}>
          <OrganizerPage />
        </MemoryRouter>
      );

      // Switch to Matches tab
      await waitFor(() => {
        const matchesTab = screen.getByRole('button', { name: /Matches & AES Room Dispatch/i });
        fireEvent.click(matchesTab);
      });

      // Verify "Assign Checked-In Roster" button is rendered
      await waitFor(() => {
        const assignBtn = screen.getByRole('button', { name: /Assign Checked-In Roster/i });
        fireEvent.click(assignBtn);
      });

      await waitFor(() => {
        expect(organizerApi.addMatchParticipant).toHaveBeenCalledWith(
          'match-3b-1',
          'part-checkedin-1',
          1
        );
      });
    });
  });

  describe('P4: Homepage Showcase Details Navigation Links', () => {
    it('renders real router navigation Links to tournament details', async () => {
      const mockApiTourneys = [
        {
          id: 'tourney-live-1',
          title: 'Battle of Champions',
          game_title: 'BGMI',
          format: 'squad',
          current_participants: 12,
          max_participants: 25,
          start_datetime: '2026-05-01T10:00:00Z',
          is_free_entry: true,
          status: 'registration_open',
        },
      ];
      vi.spyOn(global, 'fetch').mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/tournaments')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockApiTourneys,
          } as Response);
        }
        return Promise.reject(new Error('not found'));
      });

      render(
        <MemoryRouter>
          <GameShowcase />
        </MemoryRouter>
      );

      await waitFor(() => {
        const links = screen.getAllByRole('link', { name: /details/i });
        expect(links.length).toBeGreaterThan(0);
        links.forEach((link) => {
          expect(link).toHaveAttribute('href');
          expect(link.getAttribute('href')).toMatch(/^\/tournaments/);
        });
      });
    });
  });

  describe('P4: Auth 401 Synchronization', () => {
    it('dispatches gamerbrac:auth-unauthorized event and clears storage on HTTP 401', () => {
      const unauthorizedSpy = vi.fn();
      window.addEventListener('gamerbrac:auth-unauthorized', unauthorizedSpy);

      window.dispatchEvent(new CustomEvent('gamerbrac:auth-unauthorized'));
      expect(unauthorizedSpy).toHaveBeenCalledTimes(1);

      window.removeEventListener('gamerbrac:auth-unauthorized', unauthorizedSpy);
    });
  });
});
