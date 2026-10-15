import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context';
import { tokenStorage } from './api/client';
import { Header } from './components/Header';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

describe('Header Navigation Bar Authentication Logic', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Logged OUT (Guest) State', () => {
    it('displays Sign In and Register, hides Sign Out and authenticated menus', () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <Header />
          </MemoryRouter>
        </AuthProvider>
      );

      // Must NOT contain API Health link
      expect(screen.queryByText(/API Health/i)).not.toBeInTheDocument();

      // Shows Sign In and Register
      expect(screen.getAllByRole('link', { name: /Sign In/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('link', { name: /Register/i }).length).toBeGreaterThan(0);

      // Must NOT show Sign Out
      expect(screen.queryByRole('button', { name: /Sign Out/i })).not.toBeInTheDocument();

      // Must NOT show notification bell or authenticated profile
      expect(screen.queryByLabelText(/View notifications/i)).not.toBeInTheDocument();
      expect(screen.queryByTitle(/Organizer Console/i)).not.toBeInTheDocument();
      expect(screen.queryByTitle(/Admin Portal/i)).not.toBeInTheDocument();
    });

    it('Enter Arena links to protected route /dashboard and does not bypass authentication', async () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <Header />
            <Routes>
              <Route path="/" element={<div>Home Page</div>} />
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

      const enterArenaLinks = screen.getAllByRole('link', { name: /Enter Arena/i });
      expect(enterArenaLinks.length).toBeGreaterThan(0);
      expect(enterArenaLinks[0]).toHaveAttribute('href', '/dashboard');

      // Clicking Enter Arena should be caught by ProtectedRoute and redirect to /login
      fireEvent.click(enterArenaLinks[0]);

      expect(await screen.findByRole('heading', { level: 1, name: /Sign In to GamerBrac/i })).toBeInTheDocument();
    });
  });

  describe('Logged IN State', () => {
    it('shows Sign Out and user profile, hides Sign In and Register', async () => {
      tokenStorage.set('valid-player-token');

      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/auth/me')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                id: 'usr-player-1',
                username: 'clutch_god',
                email: 'clutch@gamerbrac.com',
                role: 'player',
                is_active: true,
                is_verified: true,
                created_at: new Date().toISOString(),
                profile: {
                  display_name: 'Clutch God',
                },
              }),
            });
          }
          if (url.includes('/notifications')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({ items: [], unread_count: 0 }),
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <Header />
          </MemoryRouter>
        </AuthProvider>
      );

      // Wait for authenticated user state to load
      expect(await screen.findByText('Clutch God')).toBeInTheDocument();

      // Must NOT show Sign In or Register
      expect(screen.queryByRole('link', { name: /Sign In/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Register/i })).not.toBeInTheDocument();

      // Must show Sign Out button
      expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();

      // Must show notification bell
      expect(screen.getByLabelText(/View notifications/i)).toBeInTheDocument();
    });

    it('shows Organizer Console for organizers and Admin Portal for admins', async () => {
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
                id: 'usr-admin-1',
                username: 'super_admin',
                email: 'admin@gamerbrac.com',
                role: 'admin',
                is_active: true,
                is_verified: true,
                created_at: new Date().toISOString(),
              }),
            });
          }
          if (url.includes('/notifications')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({ items: [], unread_count: 0 }),
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <Header />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText('super_admin')).toBeInTheDocument();
      expect(screen.getByTitle(/Organizer Console/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Admin Portal/i)).toBeInTheDocument();
    });
  });

  describe('Logout Flow', () => {
    it('executes real logout, clears stored session, and updates navigation state immediately', async () => {
      tokenStorage.set('session-to-logout');

      let logoutCalled = false;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/auth/me')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                id: 'usr-logout-test',
                username: 'leaving_player',
                email: 'leaving@gamerbrac.com',
                role: 'player',
                is_active: true,
                is_verified: true,
                created_at: new Date().toISOString(),
              }),
            });
          }
          if (url.includes('/auth/logout')) {
            logoutCalled = true;
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({ detail: 'Logged out successfully.' }),
            });
          }
          if (url.includes('/notifications')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({ items: [], unread_count: 0 }),
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <Header />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText('leaving_player')).toBeInTheDocument();
      const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });

      // Click Sign Out
      fireEvent.click(signOutBtn);

      await waitFor(() => {
        expect(logoutCalled).toBe(true);
        expect(tokenStorage.get()).toBeNull();
      });

      // Immediately transitions to logged-out state
      expect(await screen.findByRole('link', { name: /Sign In/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Register/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Sign Out/i })).not.toBeInTheDocument();
      expect(screen.queryByText('leaving_player')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Mobile Menu Behavior', () => {
    it('opens mobile menu and displays consistent guest buttons without stale states', () => {
      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <Header />
          </MemoryRouter>
        </AuthProvider>
      );

      const hamburgerBtn = screen.getByLabelText(/Toggle navigation menu/i);
      expect(hamburgerBtn).toBeInTheDocument();

      // Open menu
      fireEvent.click(hamburgerBtn);

      // Mobile menu should render Sign In and Register
      const signInLinks = screen.getAllByRole('link', { name: /Sign In/i });
      const registerLinks = screen.getAllByRole('link', { name: /Register/i });

      // Expect both desktop and mobile variant or mobile variant
      expect(signInLinks.length).toBeGreaterThanOrEqual(1);
      expect(registerLinks.length).toBeGreaterThanOrEqual(1);

      // No Sign Out anywhere in mobile menu
      expect(screen.queryByRole('button', { name: /Sign Out/i })).not.toBeInTheDocument();
      // No API Health link in mobile menu
      expect(screen.queryByText(/API Health/i)).not.toBeInTheDocument();

      // Close menu
      fireEvent.click(hamburgerBtn);
    });

    it('displays Sign Out and Player Dashboard in mobile menu when logged in', async () => {
      tokenStorage.set('mobile-user-token');

      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/auth/me')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                id: 'usr-mobile-1',
                username: 'mobile_pro',
                email: 'mobile@gamerbrac.com',
                role: 'player',
                is_active: true,
                is_verified: true,
                created_at: new Date().toISOString(),
              }),
            });
          }
          if (url.includes('/notifications')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({ items: [], unread_count: 0 }),
            });
          }
          return Promise.resolve({ ok: true, headers: new Headers(), json: async () => ({}) });
        })
      );

      render(
        <AuthProvider>
          <MemoryRouter initialEntries={['/']}>
            <Header />
          </MemoryRouter>
        </AuthProvider>
      );

      expect(await screen.findByText('mobile_pro')).toBeInTheDocument();

      const hamburgerBtn = screen.getByLabelText(/Toggle navigation menu/i);
      fireEvent.click(hamburgerBtn);

      // Mobile menu should contain Player Dashboard and Sign Out
      expect(screen.getByRole('link', { name: /Player Dashboard/i })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Sign Out/i }).length).toBeGreaterThanOrEqual(1);

      // Should NOT contain Sign In or Register in mobile menu
      expect(screen.queryByRole('link', { name: /Sign In/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Register/i })).not.toBeInTheDocument();
    });
  });
});
