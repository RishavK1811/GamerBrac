import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

describe('GamerBrac Frontend with Real API Integration', () => {
  beforeEach(() => {
    // Mock global fetch for health check, tournaments, and leaderboard endpoints
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/health')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              status: 'healthy',
              app_name: 'GamerBrac Esports Platform',
              version: '0.1.0',
              environment: 'development',
              database: 'connected',
              timestamp: new Date().toISOString(),
              supported_games: ['Free Fire MAX', 'BGMI', 'VALORANT'],
            }),
          });
        }

        if (url.includes('/leaderboard')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tournament_id: 'tourney-live-1',
              standings: [
                {
                  rank: 1,
                  participant_id: 'p-1',
                  name: 'Apex Predators',
                  tag: 'APEX',
                  matches_played: 4,
                  wins: 3,
                  total_kills: 35,
                  placement_points: 36,
                  kill_points: 35,
                  total_points: 71,
                },
              ],
            }),
          });
        }

        if (url.includes('/api/v1/tournaments')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 'tourney-live-1',
                title: 'BGMI National Championship 2026',
                game_title: 'BGMI',
                format: 'squad',
                status: 'registration_open',
                max_participants: 20,
                current_participants: 12,
                registration_deadline: new Date(Date.now() + 86400000).toISOString(),
                start_datetime: new Date(Date.now() + 172800000).toISOString(),
                organizer_id: 'org-uuid-1',
                is_free_entry: true,
              },
            ],
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      })
    );
  });

  it('renders GamerBrac brand header and navigation', async () => {
    render(<App />);
    await screen.findByText(/BGMI National Championship 2026/i);
    expect(screen.getAllByText(/GAMERBRAC/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tournaments/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Games/i).length).toBeGreaterThan(0);
    // API Health must NOT be present in navigation
    expect(screen.queryByText(/API Health/i)).not.toBeInTheDocument();
    // Guest navigation buttons
    expect(screen.getAllByRole('link', { name: /Sign In/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Register/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Sign Out/i })).not.toBeInTheDocument();
  });

  it('renders hero section with esports call-to-actions', async () => {
    render(<App />);
    await screen.findByText(/BGMI National Championship 2026/i);
    expect(
      screen.getByRole('heading', { level: 1, name: /COMPETE\. CONQUER\./i })
    ).toBeInTheDocument();
    expect(screen.getByText(/100% Free Entry MVP/i)).toBeInTheDocument();
    expect(screen.getByText(/Encrypted Room ID Dispatch/i)).toBeInTheDocument();
  });

  it('displays the three supported game titles', async () => {
    render(<App />);
    await screen.findByText(/BGMI National Championship 2026/i);
    expect(screen.getAllByText('Free Fire MAX').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BGMI').length).toBeGreaterThan(0);
    expect(screen.getAllByText('VALORANT').length).toBeGreaterThan(0);
  });

  it('displays role-based workflow for Player, Organizer, and Admin', async () => {
    render(<App />);
    await screen.findByText(/BGMI National Championship 2026/i);
    expect(screen.getByText(/Competitor \/ Player/i)).toBeInTheDocument();
    expect(screen.getByText(/Tournament Organizer/i)).toBeInTheDocument();
    expect(screen.getByText(/Platform Admin/i)).toBeInTheDocument();
  });

  it('renders legal and publisher disclaimers in footer', async () => {
    render(<App />);
    await screen.findByText(/BGMI National Championship 2026/i);
    expect(screen.getByText(/LEGAL & PUBLISHER NOTICE:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/GamerBrac is an independent tournament management platform/i)
    ).toBeInTheDocument();
  });

  it('renders live tournament from API and opens leaderboard standings', async () => {
    render(<App />);
    // Verify live tournament title fetched from API
    const liveTitle = await screen.findByText(/BGMI National Championship 2026/i);
    expect(liveTitle).toBeInTheDocument();
    expect(screen.getByText(/Live Database/i)).toBeInTheDocument();

    // Click on Standings button to open leaderboard modal
    const standingsBtn = screen.getAllByRole('button', { name: /Standings/i })[0];
    fireEvent.click(standingsBtn);

    // Modal should display leaderboard standings from API
    expect(await screen.findByRole('heading', { level: 4, name: /Standings/i })).toBeInTheDocument();
    expect(await screen.findByText(/Apex Predators/i)).toBeInTheDocument();
    expect(screen.getByText(/71 pts/i)).toBeInTheDocument();
  });

  it('opens and closes leaderboard dialog via Escape key', async () => {
    render(<App />);
    const liveTitle = await screen.findByText(/BGMI National Championship 2026/i);
    expect(liveTitle).toBeInTheDocument();

    const standingsBtn = screen.getAllByRole('button', { name: /Standings/i })[0];
    fireEvent.click(standingsBtn);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders error banner and retry button when tournament API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/health')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              status: 'healthy',
              app_name: 'GamerBrac',
              version: '0.1.0',
              environment: 'development',
              database: 'connected',
              timestamp: new Date().toISOString(),
              supported_games: ['Free Fire MAX', 'BGMI', 'VALORANT'],
            }),
          });
        }
        if (url.includes('/api/v1/tournaments')) {
          return Promise.reject(new Error('Network connection timeout'));
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    render(<App />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry Connection/i })).toBeInTheDocument();
  });
});
