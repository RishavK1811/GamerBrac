import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { formatApiError, tokenStorage, getApiUrl } from './api/client';
import { AuthProvider } from './context';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { OrganizerPage } from './pages/OrganizerPage';
import { AdminPage } from './pages/AdminPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentDetailPage } from './pages/TournamentDetailPage';

describe('Tier 2A: Authentication, Routing & Role Security', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('API Error Formatter', () => {
    it('formats FastAPI string detail error correctly', () => {
      const msg = formatApiError(400, { detail: 'A user with this username already exists.' });
      expect(msg).toBe('A user with this username already exists.');
    });

    it('formats Pydantic validation error array correctly', () => {
      const msg = formatApiError(422, {
        detail: [
          { loc: ['body', 'password'], msg: 'Value error, Password must contain at least one digit' },
          { loc: ['body', 'email'], msg: 'value is not a valid email address' },
        ],
      });
      expect(msg).toContain('password: Password must contain at least one digit');
      expect(msg).toContain('email: value is not a valid email address');
    });

    it('returns standard fallback messages for known HTTP status codes', () => {
      expect(formatApiError(401, null)).toBe('Authentication required or session expired.');
      expect(formatApiError(403, null)).toBe('You do not have permission to perform this action.');
      expect(formatApiError(404, null)).toBe('The requested resource was not found.');
      expect(formatApiError(429, null)).toBe('Rate limit exceeded. Please wait a moment before retrying.');
      expect(formatApiError(500, null)).toBe('Internal server error. Please try again later.');
    });
  });

  describe('Login Flow', () => {
    it('renders login form with inputs and validation', async () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByRole('heading', { level: 1, name: /Sign In to GamerBrac/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Username or Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });

    it('displays error message when login fails with 401', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/auth/login')) {
            return Promise.resolve({
              ok: false,
              status: 401,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({ detail: 'Invalid username/email or password.' }),
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      );

      fireEvent.change(screen.getByLabelText(/Username or Email/i), { target: { value: 'wrong_user' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'WrongPass#123' } });
      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Invalid username\/email or password/i);
    });

    it('successfully authenticates and saves JWT token on valid credentials', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/auth/login')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                access_token: 'valid-jwt-token-12345',
                token_type: 'bearer',
                expires_in: 3600,
                user: {
                  id: 'usr-1',
                  username: 'pro_gamer',
                  email: 'pro@gamerbrac.com',
                  role: 'player',
                  is_active: true,
                  is_verified: true,
                  created_at: new Date().toISOString(),
                },
              }),
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      fireEvent.change(screen.getByLabelText(/Username or Email/i), { target: { value: 'pro_gamer' } });
      fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'SecurePass#2026' } });
      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(tokenStorage.get()).toBe('valid-jwt-token-12345');
      });
      expect((await screen.findAllByText(/pro_gamer/i))[0]).toBeInTheDocument();
      expect(screen.getByText(/Ready to Compete/i)).toBeInTheDocument();
    });
  });

  describe('Registration Flow', () => {
    it('enforces password confirmation and client-side format checks', async () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/register']}>
            <RegisterPage />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(screen.getByRole('heading', { level: 1, name: /Create Player Account/i })).toBeInTheDocument();

      // Enter mismatched passwords
      fireEvent.change(screen.getByLabelText(/^Username$/i), { target: { value: 'valid_user' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'user@gamerbrac.com' } });
      fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'SecurePass#2026' } });
      fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'DifferentPass#2026' } });

      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Passwords do not match/i);
    });

    it('successfully registers and redirects to dashboard', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/auth/register')) {
            return Promise.resolve({
              ok: true,
              status: 201,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                access_token: 'new-player-jwt-token',
                token_type: 'bearer',
                expires_in: 3600,
                user: {
                  id: 'usr-new',
                  username: 'new_champion',
                  email: 'champion@gamerbrac.com',
                  role: 'player',
                  is_active: true,
                  is_verified: false,
                  created_at: new Date().toISOString(),
                },
              }),
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/register']}>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      fireEvent.change(screen.getByLabelText(/^Username$/i), { target: { value: 'new_champion' } });
      fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'champion@gamerbrac.com' } });
      fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'ValidPass#2026' } });
      fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'ValidPass#2026' } });

      fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }));

      await waitFor(() => {
        expect(tokenStorage.get()).toBe('new-player-jwt-token');
      });
      expect((await screen.findAllByText(/new_champion/i))[0]).toBeInTheDocument();
    });
  });

  describe('Protected Routes and Role Restrictions', () => {
    it('redirects unauthenticated user from protected dashboard to login', async () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // Should automatically navigate to LoginPage
      expect(await screen.findByRole('heading', { level: 1, name: /Sign In to GamerBrac/i })).toBeInTheDocument();
    });

    it('blocks regular player from accessing organizer and admin routes (403 view)', async () => {
      // Simulate stored token for a regular player
      tokenStorage.set('player-token');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/auth/me')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                id: 'player-1',
                username: 'standard_player',
                email: 'player@gamerbrac.com',
                role: 'player',
                is_active: true,
                is_verified: true,
                created_at: new Date().toISOString(),
              }),
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <Routes>
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      // Access should be restricted
      expect(await screen.findByRole('heading', { level: 2, name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/requires/i)).toHaveTextContent(/ADMIN/i);
      expect(screen.getByText(/Your current account role is/i)).toHaveTextContent(/player/i);
    });

    it('allows organizer to access organizer console', async () => {
      tokenStorage.set('organizer-token');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/auth/me')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                id: 'org-1',
                username: 'tourney_master',
                email: 'org@gamerbrac.com',
                role: 'organizer',
                is_active: true,
                is_verified: true,
                created_at: new Date().toISOString(),
              }),
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/organizer']}>
            <Routes>
              <Route
                path="/organizer"
                element={
                  <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                    <OrganizerPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByRole('heading', { level: 1, name: /Tournament Organizer Console/i })).toBeInTheDocument();
      expect(screen.getByText(/Organizer Permissions Active/i)).toBeInTheDocument();
    });

    it('allows admin to access platform administration portal', async () => {
      tokenStorage.set('admin-token');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/auth/me')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                id: 'admin-1',
                username: 'super_admin',
                email: 'admin@gamerbrac.com',
                role: 'admin',
                is_active: true,
                is_verified: true,
                created_at: new Date().toISOString(),
              }),
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/admin']}>
            <Routes>
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByRole('heading', { level: 1, name: /Platform Administration/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Audit Trail/i).length).toBeGreaterThan(0);
    });
  });

  describe('Tournaments Directory & Detail Views', () => {
    it('renders tournament directory and allows filtering', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/api/v1/tournaments')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => [
                {
                  id: 'tourney-dir-1',
                  title: 'Free Fire MAX Rampage 2026',
                  game_title: 'Free Fire MAX',
                  format: 'squad',
                  status: 'registration_open',
                  max_participants: 24,
                  current_participants: 10,
                  registration_deadline: new Date(Date.now() + 86400000).toISOString(),
                  start_datetime: new Date(Date.now() + 172800000).toISOString(),
                  organizer_id: 'org-uuid-1',
                  is_free_entry: true,
                },
              ],
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/tournaments']}>
            <TournamentsPage />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByRole('heading', { level: 1, name: /Tournament Directory/i })).toBeInTheDocument();
      expect(await screen.findByText(/Free Fire MAX Rampage 2026/i)).toBeInTheDocument();
      expect(screen.getByText(/10 \/ 24/i)).toBeInTheDocument();
    });

    it('renders tournament detail view and opens leaderboard modal', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/leaderboard')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                tournament_id: 't-123',
                standings: [
                  {
                    rank: 1,
                    participant_id: 'part-1',
                    name: 'Vortex Legends',
                    tag: 'VTX',
                    matches_played: 3,
                    wins: 2,
                    total_kills: 28,
                    placement_points: 30,
                    kill_points: 28,
                    total_points: 58,
                  },
                ],
              }),
            });
          }
          if (url.includes('/api/v1/tournaments/t-123')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                id: 't-123',
                title: 'VALORANT Spike Series India',
                game_title: 'VALORANT',
                format: 'duo',
                status: 'registration_open',
                max_participants: 25,
                current_participants: 8,
                registration_deadline: new Date(Date.now() + 86400000).toISOString(),
                start_datetime: new Date(Date.now() + 172800000).toISOString(),
                organizer_id: 'org-uuid-2',
                is_free_entry: true,
                rules: 'Custom lobby tournament standard settings.',
                prize_pool_description: 'Official verified certificate.',
              }),
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/tournaments/t-123']}>
            <Routes>
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText(/VALORANT Spike Series India/i)).toBeInTheDocument();
      expect(screen.getByText(/Custom lobby tournament standard settings/i)).toBeInTheDocument();

      // Open standings modal
      fireEvent.click(screen.getByRole('button', { name: /View Standings & Leaderboard/i }));

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/Vortex Legends/i)).toBeInTheDocument();
      expect(within(dialog).getByText('58')).toBeInTheDocument();
    });
  });

  describe('Tier 3D: Production Deployment URL Resolution', () => {
    it('resolves relative endpoints correctly without trailing slash issues', () => {
      expect(getApiUrl('/api/v1/health')).toContain('/api/v1/health');
      expect(getApiUrl('api/v1/tournaments')).toContain('/api/v1/tournaments');
      expect(getApiUrl('https://custom.backend.com/api/v1/health')).toBe('https://custom.backend.com/api/v1/health');
      expect(getApiUrl('')).toBe('');
    });
  });
});
