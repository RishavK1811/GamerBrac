import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context';
import { DashboardPage } from './pages/DashboardPage';
import { TournamentDetailPage } from './pages/TournamentDetailPage';

// Mock user response
const mockPlayerUser = {
  id: 'usr-player-1',
  username: 'gamer_sniper',
  email: 'sniper@gamerbrac.com',
  role: 'player',
  is_active: true,
  is_verified: true,
  created_at: '2026-01-01T00:00:00Z',
  profile: {
    id: 'prof-1',
    user_id: 'usr-player-1',
    display_name: 'SniperElite',
    bio: 'Dedicated Free Fire and BGMI competitive player.',
    avatar_url: null,
    phone_number: '+91 9876543210',
    state_region: 'Maharashtra',
    created_at: '2026-01-01T00:00:00Z',
    game_accounts: [
      {
        id: 'ga-1',
        game_title: 'Free Fire MAX',
        in_game_name: 'FF_Sniper',
        in_game_id: '123456789',
        is_verified: true,
      },
    ],
  },
};

const mockTeams = [
  {
    id: 'team-1',
    name: 'Velocity Esports',
    tag: 'VLT',
    primary_game: 'Free Fire MAX',
    captain_id: 'usr-player-1',
    captain_username: 'gamer_sniper',
    logo_url: null,
    created_at: '2026-02-01T00:00:00Z',
    members: [
      {
        id: 'tm-1',
        team_id: 'team-1',
        user_id: 'usr-player-1',
        username: 'gamer_sniper',
        display_name: 'SniperElite',
        role: 'captain',
        joined_at: '2026-02-01T00:00:00Z',
      },
      {
        id: 'tm-2',
        team_id: 'team-1',
        user_id: 'usr-player-2',
        username: 'rusher_01',
        display_name: 'FastRusher',
        role: 'player',
        joined_at: '2026-02-02T00:00:00Z',
      },
    ],
  },
];

const mockSoloTournament = {
  id: 'tourn-solo-1',
  title: 'Free Fire Solo Championship',
  game_title: 'Free Fire MAX',
  format: 'solo',
  status: 'registration_open',
  max_participants: 48,
  current_participants: 12,
  registration_deadline: '2026-10-20T18:00:00Z',
  start_datetime: '2026-10-21T14:00:00Z',
  organizer_id: 'org-1',
  is_free_entry: true,
  description: 'National solo battle royale tournament.',
  rules: 'Default rules apply.',
  prize_pool_description: 'Points and ranking badge.',
};

const mockSquadTournament = {
  id: 'tourn-squad-1',
  title: 'Free Fire MAX Squad Clash',
  game_title: 'Free Fire MAX',
  format: 'squad',
  status: 'registration_open',
  max_participants: 12,
  current_participants: 4,
  registration_deadline: '2026-10-22T18:00:00Z',
  start_datetime: '2026-10-23T14:00:00Z',
  organizer_id: 'org-1',
  is_free_entry: true,
  description: 'Squad competitive clash.',
};

describe('Tier 2B: Player Hub & Real Player Workflows', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('gamerbrac_access_token', 'valid-test-token');
    vi.restoreAllMocks();
  });

  const setupMockApi = (overrides: Record<string, unknown> = {}) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, options: RequestInit = {}) => {
        const method = options.method || 'GET';

        // Auth endpoint
        if (url.includes('/api/v1/auth/me')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => overrides.me || mockPlayerUser,
          });
        }

        // Profile endpoints
        if (url.includes('/api/v1/players/profile')) {
          if (method === 'PUT') {
            const body = JSON.parse(options.body as string);
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                ...mockPlayerUser.profile,
                ...body,
              }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => overrides.profile || mockPlayerUser.profile,
          });
        }

        // Game accounts endpoints
        if (url.includes('/api/v1/players/game-accounts')) {
          if (method === 'POST') {
            const body = JSON.parse(options.body as string);
            if (overrides.duplicateUidError) {
              return Promise.resolve({
                ok: false,
                status: 400,
                headers: new Headers({ 'content-type': 'application/json' }),
                json: async () => ({
                  detail: `The game UID '${body.in_game_id}' is already registered to another player on GamerBrac.`,
                }),
              });
            }
            return Promise.resolve({
              ok: true,
              status: 201,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                id: 'ga-new',
                game_title: body.game_title,
                in_game_name: body.in_game_name,
                in_game_id: body.in_game_id,
                is_verified: false,
                created_at: new Date().toISOString(),
              }),
            });
          }
          if (method === 'DELETE') {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({ message: 'Game account unlinked successfully.' }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => overrides.accounts || mockPlayerUser.profile.game_accounts,
          });
        }

        // Teams endpoints
        if (url.includes('/api/v1/teams/my')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => overrides.teams || mockTeams,
          });
        }

        if (url.includes('/api/v1/teams') && method === 'POST') {
          if (url.includes('/members')) {
            const body = JSON.parse(options.body as string);
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                id: 'tm-new',
                team_id: 'team-1',
                user_id: 'usr-new',
                username: body.username_or_email,
                role: body.role || 'player',
                joined_at: new Date().toISOString(),
              }),
            });
          }
          const body = JSON.parse(options.body as string);
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              id: 'team-created',
              name: body.name,
              tag: body.tag,
              primary_game: body.primary_game,
              captain_id: mockPlayerUser.id,
              captain_username: mockPlayerUser.username,
              created_at: new Date().toISOString(),
              members: [],
            }),
          });
        }

        // Tournaments endpoints
        if (url.includes('/api/v1/tournaments/my')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => overrides.myTournaments || [],
          });
        }

        if (url.includes('/api/v1/tournaments/tourn-solo-1/register')) {
          if (method === 'POST') {
            return Promise.resolve({
              ok: true,
              status: 201,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                id: 'part-solo-1',
                tournament_id: 'tourn-solo-1',
                user_id: mockPlayerUser.id,
                status: 'REGISTERED',
                registered_at: new Date().toISOString(),
              }),
            });
          }
          if (method === 'DELETE') {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({ message: 'Successfully withdrawn from the tournament.' }),
            });
          }
        }

        if (url.includes('/api/v1/tournaments/tourn-solo-1/check-in')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              id: 'part-solo-1',
              tournament_id: 'tourn-solo-1',
              user_id: mockPlayerUser.id,
              status: 'CHECKED_IN',
              registered_at: new Date().toISOString(),
              checked_in_at: new Date().toISOString(),
            }),
          });
        }

        if (url.includes('/api/v1/tournaments/tourn-solo-1')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => overrides.soloTournament || mockSoloTournament,
          });
        }

        if (url.includes('/api/v1/tournaments/tourn-squad-1/register')) {
          return Promise.resolve({
            ok: true,
            status: 201,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              id: 'part-squad-1',
              tournament_id: 'tourn-squad-1',
              user_id: mockPlayerUser.id,
              team_id: 'team-1',
              status: 'REGISTERED',
              registered_at: new Date().toISOString(),
            }),
          });
        }

        if (url.includes('/api/v1/tournaments/tourn-squad-1')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => overrides.squadTournament || mockSquadTournament,
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({}),
        });
      })
    );
  };

  describe('Player Profile Workflows', () => {
    it('displays player profile details in the Profile tab', async () => {
      setupMockApi();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard?tab=profile']}>
            <DashboardPage />
          </MemoryRouter>
        </AuthProvider>
      );

      expect((await screen.findAllByText('SniperElite'))[0]).toBeInTheDocument();
      expect(screen.getAllByText('Maharashtra')[0]).toBeInTheDocument();
      expect(screen.getByText('+91 9876543210')).toBeInTheDocument();
      expect(screen.getByText(/Dedicated Free Fire and BGMI competitive player/i)).toBeInTheDocument();
    });

    it('allows entering edit mode and updating profile fields successfully', async () => {
      setupMockApi();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard?tab=profile']}>
            <DashboardPage />
          </MemoryRouter>
        </AuthProvider>
      );

      const editBtn = await screen.findByRole('button', { name: /Edit Profile/i });
      fireEvent.click(editBtn);

      const displayInput = screen.getByLabelText(/Display Name/i);
      fireEvent.change(displayInput, { target: { value: 'SniperChampion' } });

      const stateInput = screen.getByLabelText(/State \/ Region/i);
      fireEvent.change(stateInput, { target: { value: 'Karnataka' } });

      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      expect(await screen.findByText(/Profile updated successfully/i)).toBeInTheDocument();
    });
  });

  describe('Game Accounts Management', () => {
    it('lists existing linked game accounts with verification badges', async () => {
      setupMockApi();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard?tab=accounts']}>
            <DashboardPage />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText('FF_Sniper')).toBeInTheDocument();
      expect(screen.getByText(/UID: 123456789/i)).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('submits a new game account UID link request', async () => {
      setupMockApi();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard?tab=accounts']}>
            <DashboardPage />
          </MemoryRouter>
        </AuthProvider>
      );

      const ignInput = await screen.findByLabelText(/In-Game Name/i);
      const uidInput = screen.getByLabelText(/In-Game UID/i);

      fireEvent.change(ignInput, { target: { value: 'BGMI_Pro' } });
      fireEvent.change(uidInput, { target: { value: '555123999' } });

      const linkBtn = screen.getByRole('button', { name: /Link Game Account/i });
      fireEvent.click(linkBtn);

      expect(await screen.findByText(/Linked Free Fire MAX account successfully/i)).toBeInTheDocument();
    });

    it('displays error message when linking a duplicate UID already registered on the platform', async () => {
      setupMockApi({ duplicateUidError: true });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard?tab=accounts']}>
            <DashboardPage />
          </MemoryRouter>
        </AuthProvider>
      );

      const ignInput = await screen.findByLabelText(/In-Game Name/i);
      const uidInput = screen.getByLabelText(/In-Game UID/i);

      fireEvent.change(ignInput, { target: { value: 'DuplicatePlayer' } });
      fireEvent.change(uidInput, { target: { value: '999999999' } });

      const linkBtn = screen.getByRole('button', { name: /Link Game Account/i });
      fireEvent.click(linkBtn);

      expect(
        await screen.findByText(/is already registered to another player on GamerBrac/i)
      ).toBeInTheDocument();
    });
  });

  describe('Team Management', () => {
    it('lists teams, captain status, and current roster count', async () => {
      setupMockApi();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard?tab=teams']}>
            <DashboardPage />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText('Velocity Esports')).toBeInTheDocument();
      expect(screen.getByText('[VLT]')).toBeInTheDocument();
      expect(screen.getByText(/Roster:/i)).toBeInTheDocument();
      expect(screen.getByText('FastRusher')).toBeInTheDocument();
    });

    it('allows captain to open recruit form and add a player to the roster', async () => {
      setupMockApi();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard?tab=teams']}>
            <DashboardPage />
          </MemoryRouter>
        </AuthProvider>
      );

      const addPlayerBtn = await screen.findByRole('button', { name: /Add Player/i });
      fireEvent.click(addPlayerBtn);

      const userInput = screen.getByPlaceholderText(/e\.g\. gamer_pro/i);
      fireEvent.change(userInput, { target: { value: 'new_teammate' } });

      const submitBtn = screen.getByRole('button', { name: /Add to Team/i });
      fireEvent.click(submitBtn);

      expect(await screen.findByText(/Player added to team roster/i)).toBeInTheDocument();
    });

    it('allows creating a new team with valid name and tag', async () => {
      setupMockApi();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard?tab=teams']}>
            <DashboardPage />
          </MemoryRouter>
        </AuthProvider>
      );

      const createBtn = await screen.findByRole('button', { name: /Create Team/i });
      fireEvent.click(createBtn);

      fireEvent.change(screen.getByLabelText(/Team Name/i), { target: { value: 'Apex Legends India' } });
      fireEvent.change(screen.getByLabelText(/Clan Tag/i), { target: { value: 'ALI' } });

      const registerBtn = screen.getByRole('button', { name: /Register Team/i });
      fireEvent.click(registerBtn);

      expect(await screen.findByText(/Team "Apex Legends India" created successfully/i)).toBeInTheDocument();
    });
  });

  describe('Tournament Registration and Check-In Workflows', () => {
    it('allows a player to register for a solo tournament', async () => {
      setupMockApi();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/tournaments/tourn-solo-1']}>
            <Routes>
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText('Free Fire Solo Championship')).toBeInTheDocument();

      const regBtn = await screen.findByRole('button', { name: /Register for Free/i });
      fireEvent.click(regBtn);

      expect(await screen.findByText(/Successfully registered for the tournament/i)).toBeInTheDocument();
    });

    it('shows Check-In button when registered and tournament is in check_in phase', async () => {
      setupMockApi({
        soloTournament: {
          ...mockSoloTournament,
          status: 'check_in',
        },
        myTournaments: [
          {
            participant_id: 'part-1',
            tournament_id: 'tourn-solo-1',
            tournament_title: 'Free Fire Solo Championship',
            game_title: 'Free Fire MAX',
            format: 'solo',
            status: 'check_in',
            max_participants: 48,
            current_participants: 12,
            start_datetime: '2026-10-21T14:00:00Z',
            registration_deadline: '2026-10-20T18:00:00Z',
            participant_status: 'REGISTERED',
            registered_at: '2026-10-15T00:00:00Z',
          },
        ],
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/tournaments/tourn-solo-1']}>
            <Routes>
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText('Free Fire Solo Championship')).toBeInTheDocument();
      const checkInBtn = await screen.findByRole('button', { name: /Check In Now/i });
      expect(checkInBtn).toBeInTheDocument();

      fireEvent.click(checkInBtn);

      expect(await screen.findByText(/Checked in successfully/i)).toBeInTheDocument();
    });

    it('allows captain to register squad team in matching game tournament', async () => {
      setupMockApi();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/tournaments/tourn-squad-1']}>
            <Routes>
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText('Free Fire MAX Squad Clash')).toBeInTheDocument();
      expect(await screen.findByLabelText(/Select Captained Team/i)).toBeInTheDocument();

      const regTeamBtn = screen.getByRole('button', { name: /Register Team/i });
      fireEvent.click(regTeamBtn);

      expect(await screen.findByText(/Successfully registered for the tournament/i)).toBeInTheDocument();
    });

    it('displays prompt to login when user is not authenticated', async () => {
      localStorage.clear();
      setupMockApi();

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/tournaments/tourn-solo-1']}>
            <Routes>
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText('Free Fire Solo Championship')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Sign In to Register/i })).toBeInTheDocument();
    });
  });

  describe('My Tournaments Tab', () => {
    it('displays registered events with status badges and check-in button', async () => {
      setupMockApi({
        myTournaments: [
          {
            participant_id: 'part-100',
            tournament_id: 'tourn-solo-1',
            tournament_title: 'Free Fire Solo Championship',
            game_title: 'Free Fire MAX',
            format: 'solo',
            status: 'check_in',
            max_participants: 48,
            current_participants: 12,
            start_datetime: '2026-10-21T14:00:00Z',
            registration_deadline: '2026-10-20T18:00:00Z',
            participant_status: 'REGISTERED',
            registered_at: '2026-10-15T00:00:00Z',
          },
        ],
      });

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard?tab=tournaments']}>
            <DashboardPage />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText('Free Fire Solo Championship')).toBeInTheDocument();
      expect(screen.getByText('REGISTERED')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Check In Now/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Withdraw/i })).toBeInTheDocument();
    });
  });
});
