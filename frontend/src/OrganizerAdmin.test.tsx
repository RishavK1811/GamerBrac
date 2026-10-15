import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { OrganizerPage } from './pages/OrganizerPage';
import { AdminPage } from './pages/AdminPage';
import { organizerApi, adminApi, tournamentsApi } from './api/client';
import * as AuthContextModule from './context/useAuth';
import type { UserResponse } from './types';

// Mock client APIs
vi.mock('./api/client', async () => {
  const actual = await vi.importActual('./api/client');
  return {
    ...actual,
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
    adminApi: {
      listPendingOrganizers: vi.fn(),
      approveOrganizer: vi.fn(),
      listUsers: vi.fn(),
      suspendUser: vi.fn(),
      reactivateUser: vi.fn(),
      listReports: vi.fn(),
      resolveReport: vi.fn(),
      getAuditLogs: vi.fn(),
    },
    tournamentsApi: {
      ...actual.tournamentsApi,
      getById: vi.fn(),
    },
  };
});

describe('Tier 2C: Organizer Console & Admin Portal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Organizer Console (OrganizerPage)', () => {
    it('displays pending verification screen for unapproved organizers', () => {
      const mockUnapprovedUser: UserResponse = {
        id: 'org-unverified-1',
        username: 'pending_host',
        email: 'host@pending.com',
        role: 'organizer',
        is_active: true,
        is_verified: false,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: mockUnapprovedUser,
        token: 'fake-token',
        isLoading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      render(
        <MemoryRouter>
          <OrganizerPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Organizer Verification Pending')).toBeInTheDocument();
      expect(screen.getByText(/Awaiting Super-Administrator Approval/i)).toBeInTheDocument();
      expect(screen.getAllByText('@pending_host')[0]).toBeInTheDocument();
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
    });

    it('renders full command console for verified organizers with tournament management', async () => {
      const mockVerifiedOrg: UserResponse = {
        id: 'org-verified-1',
        username: 'pro_host',
        email: 'host@pro.com',
        role: 'organizer',
        is_verified: true,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: mockVerifiedOrg,
        token: 'fake-token',
        isLoading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const mockTournaments = [
        {
          id: 't-1',
          title: 'BGMI Championship Series',
          game_title: 'BGMI',
          format: 'squad',
          status: 'draft',
          max_participants: 16,
          current_participants: 4,
          registration_deadline: new Date(Date.now() + 86400000).toISOString(),
          start_datetime: new Date(Date.now() + 172800000).toISOString(),
          organizer_id: mockVerifiedOrg.id,
          is_free_entry: true,
        },
      ];

      const mockDetail = {
        ...mockTournaments[0],
        description: 'Elite squad tournament',
        rules: 'No emulators',
        participants: [
          {
            id: 'p-1',
            user_id: 'player-1',
            status: 'REGISTERED' as const,
            registered_at: new Date().toISOString(),
            username: 'team_alpha_captain',
            team_name: 'Team Alpha',
            team_tag: 'ALP',
          },
        ],
      };

      vi.mocked(organizerApi.listMyTournaments).mockResolvedValue(mockTournaments);
      vi.mocked(tournamentsApi.getById).mockResolvedValue(mockDetail);

      render(
        <MemoryRouter>
          <OrganizerPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Tournament Organizer Console')).toBeInTheDocument();
      expect(screen.getByText('Organizer Permissions Active')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getAllByText('BGMI Championship Series')[0]).toBeInTheDocument();
        expect(screen.getByText('Team Alpha')).toBeInTheDocument();
        expect(screen.getByText('Open Registrations')).toBeInTheDocument();
      });

      // Click "Create Tournament" button to open modal
      const createBtn = screen.getByRole('button', { name: /Create Tournament/i });
      fireEvent.click(createBtn);

      expect(screen.getByText('Create New Tournament')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/GamerBrac Pro Invitational/i)).toBeInTheDocument();
      expect(screen.getByText(/Zero Entry Fee/i)).toBeInTheDocument();
    });

    it('switches to Matches tab and displays AES credential controls', async () => {
      const mockVerifiedOrg: UserResponse = {
        id: 'org-verified-1',
        username: 'pro_host',
        email: 'host@pro.com',
        role: 'organizer',
        is_verified: true,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: mockVerifiedOrg,
        token: 'fake-token',
        isLoading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const mockTournaments = [
        {
          id: 't-1',
          title: 'Free Fire Cup',
          game_title: 'Free Fire MAX',
          format: 'solo',
          status: 'ongoing',
          max_participants: 32,
          current_participants: 32,
          registration_deadline: new Date().toISOString(),
          start_datetime: new Date().toISOString(),
          organizer_id: mockVerifiedOrg.id,
          is_free_entry: true,
        },
      ];

      const mockMatches = [
        {
          id: 'm-1',
          tournament_id: 't-1',
          title: 'Quarter Finals Match 1',
          match_number: 1,
          round_number: 1,
          status: 'scheduled' as const,
          scheduled_start_time: new Date().toISOString(),
          has_credentials: true,
          participants_count: 8,
        },
      ];

      vi.mocked(organizerApi.listMyTournaments).mockResolvedValue(mockTournaments);
      vi.mocked(organizerApi.listMatches).mockResolvedValue(mockMatches);

      render(
        <MemoryRouter>
          <OrganizerPage />
        </MemoryRouter>
      );

      // Switch to Matches tab
      const matchesTab = screen.getByRole('button', { name: /Matches & AES Room Dispatch/i });
      fireEvent.click(matchesTab);

      await waitFor(() => {
        expect(screen.getByText('Quarter Finals Match 1')).toBeInTheDocument();
        expect(screen.getByText('AES-256 Configured')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Edit Credentials/i })).toBeInTheDocument();
      });
    });

    it('switches to Score Review tab and provides verification actions', async () => {
      const mockVerifiedOrg: UserResponse = {
        id: 'org-verified-1',
        username: 'pro_host',
        email: 'host@pro.com',
        role: 'organizer',
        is_verified: true,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: mockVerifiedOrg,
        token: 'fake-token',
        isLoading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const mockTournaments = [
        {
          id: 't-1',
          title: 'VALORANT Showdown',
          game_title: 'VALORANT',
          format: '5v5',
          status: 'ongoing',
          max_participants: 8,
          current_participants: 8,
          registration_deadline: new Date().toISOString(),
          start_datetime: new Date().toISOString(),
          organizer_id: mockVerifiedOrg.id,
          is_free_entry: true,
        },
      ];

      const mockMatches = [
        {
          id: 'm-1',
          tournament_id: 't-1',
          title: 'Grand Final Match',
          match_number: 1,
          round_number: 1,
          status: 'in_progress' as const,
          scheduled_start_time: new Date().toISOString(),
          has_credentials: true,
          participants_count: 2,
        },
      ];

      const mockSubmissions = [
        {
          id: 'sub-1',
          match_id: 'm-1',
          match_participant_id: 'mp-1',
          submitted_by_id: 'user-player-12345',
          placement: 1,
          kills: 14,
          evidence_url: '/api/v1/matches/m-1/evidence/test.png',
          status: 'pending' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      vi.mocked(organizerApi.listMyTournaments).mockResolvedValue(mockTournaments);
      vi.mocked(organizerApi.listMatches).mockResolvedValue(mockMatches);
      vi.mocked(organizerApi.listSubmissions).mockResolvedValue(mockSubmissions);

      render(
        <MemoryRouter>
          <OrganizerPage />
        </MemoryRouter>
      );

      // Switch to Score Review tab
      const submissionsTab = screen.getByRole('button', { name: /Score Review & Results/i });
      fireEvent.click(submissionsTab);

      await waitFor(() => {
        expect(screen.getByText('Rank #1')).toBeInTheDocument();
        expect(screen.getByText('14 Kills')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Review & Verify/i })).toBeInTheDocument();
      });

      // Click Review & Verify
      fireEvent.click(screen.getByRole('button', { name: /Review & Verify/i }));
      expect(screen.getByText('Verify Score Submission')).toBeInTheDocument();
      expect(screen.getByText('Approve & Verify')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });
  });

  describe('Admin Portal (AdminPage)', () => {
    it('renders admin overview and lists pending organizers with approve button', async () => {
      const mockAdmin: UserResponse = {
        id: 'admin-1',
        username: 'superadmin',
        email: 'admin@gamerbrac.com',
        role: 'admin',
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: mockAdmin,
        token: 'admin-token',
        isLoading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const mockPending = [
        {
          id: 'org-app-1',
          username: 'delhi_esports',
          email: 'host@delhiesports.in',
          role: 'organizer' as const,
          is_active: true,
          is_verified: false,
          created_at: new Date().toISOString(),
        },
      ];

      vi.mocked(adminApi.listPendingOrganizers).mockResolvedValue(mockPending);

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Platform Administration')).toBeInTheDocument();
      expect(screen.getByText('Super Admin')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('@delhi_esports')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Approve Organizer/i })).toBeInTheDocument();
      });
    });

    it('navigates to User Moderation and provides account suspension modal', async () => {
      const mockAdmin: UserResponse = {
        id: 'admin-1',
        username: 'superadmin',
        email: 'admin@gamerbrac.com',
        role: 'admin',
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: mockAdmin,
        token: 'admin-token',
        isLoading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const mockUsers = [
        {
          id: 'user-toxic-1',
          username: 'toxic_aimbot',
          email: 'toxic@cheat.com',
          role: 'player' as const,
          is_active: true,
          is_verified: true,
          created_at: new Date().toISOString(),
        },
      ];

      vi.mocked(adminApi.listPendingOrganizers).mockResolvedValue([]);
      vi.mocked(adminApi.listUsers).mockResolvedValue(mockUsers);

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>
      );

      // Switch to User Moderation tab
      const userModTab = screen.getByRole('button', { name: /User Moderation/i });
      fireEvent.click(userModTab);

      await waitFor(() => {
        expect(screen.getByText('@toxic_aimbot')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Suspend/i })).toBeInTheDocument();
      });

      // Click Suspend button
      fireEvent.click(screen.getByRole('button', { name: /Suspend/i }));
      expect(screen.getByText('Suspend User Account')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/State the policy violation/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Confirm Suspension/i })).toBeInTheDocument();
    });

    it('navigates to Disputes & Reports tab and Audit Logs tab', async () => {
      const mockAdmin: UserResponse = {
        id: 'admin-1',
        username: 'superadmin',
        email: 'admin@gamerbrac.com',
        role: 'admin',
        is_active: true,
        is_verified: true,
        created_at: new Date().toISOString(),
      };

      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        user: mockAdmin,
        token: 'admin-token',
        isLoading: false,
        isAuthenticated: true,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      });

      const mockReports = [
        {
          id: 'rep-1',
          reporter_id: 'user-rep-1',
          category: 'cheating',
          description: 'Used speedhack in Match 2',
          status: 'pending' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockLogs = [
        {
          id: 'log-1',
          user_id: 'admin-1',
          action: 'user_suspended',
          resource_type: 'user',
          resource_id: 'user-toxic-1',
          details: 'Suspension reason: Cheating detected',
          created_at: new Date().toISOString(),
        },
      ];

      vi.mocked(adminApi.listPendingOrganizers).mockResolvedValue([]);
      vi.mocked(adminApi.listReports).mockResolvedValue(mockReports);
      vi.mocked(adminApi.getAuditLogs).mockResolvedValue(mockLogs);

      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>
      );

      // Switch to Reports tab
      const reportsTab = screen.getByRole('button', { name: /Disputes & Reports/i });
      fireEvent.click(reportsTab);

      await waitFor(() => {
        expect(screen.getByText('Used speedhack in Match 2')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Resolve/i })).toBeInTheDocument();
      });

      // Switch to Audit tab
      const auditTab = screen.getByRole('button', { name: /Audit Logs/i });
      fireEvent.click(auditTab);

      await waitFor(() => {
        expect(screen.getByText('user_suspended')).toBeInTheDocument();
        expect(screen.getByText(/Cheating detected/i)).toBeInTheDocument();
      });
    });
  });
});
