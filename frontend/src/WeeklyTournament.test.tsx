import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { GameShowcase } from './components/GameShowcase';
import type { ApiTournament } from './types';

describe('Weekly Free Tournament & Paid Tournament Separation', () => {
  const mockFreeTournament: ApiTournament = {
    id: 'free-cup-1',
    title: 'BGMI Official Weekly Free Championship',
    game_title: 'BGMI',
    format: 'squad',
    status: 'registration_open',
    max_participants: 16,
    current_participants: 10,
    registration_deadline: '2027-04-10T18:00:00Z',
    start_datetime: '2027-04-12T14:00:00Z',
    organizer_id: 'org-1',
    is_free_entry: true,
  };

  const mockPaidTournament: ApiTournament = {
    id: 'paid-cup-1',
    title: 'VALORANT Pro Series Qualifier',
    game_title: 'VALORANT',
    format: 'duo',
    status: 'registration_open',
    max_participants: 25,
    current_participants: 4,
    registration_deadline: '2027-04-15T18:00:00Z',
    start_datetime: '2027-04-18T14:00:00Z',
    organizer_id: 'org-2',
    is_free_entry: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders both Section A and Section B headers with MVP payment notice', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/v1/tournaments')) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockFreeTournament, mockPaidTournament],
        } as Response);
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter>
        <GameShowcase />
      </MemoryRouter>
    );

    // Section A
    expect(await screen.findByRole('heading', { name: /Free Tournament of the Week/i })).toBeInTheDocument();
    expect(screen.getByText('Section A')).toBeInTheDocument();

    // Section B
    expect(screen.getByRole('heading', { name: /Paid \/ Entry Tournaments/i })).toBeInTheDocument();
    expect(screen.getByText('Section B')).toBeInTheDocument();

    // Payment notice
    expect(screen.getByText(/Online Payment Processing Disabled \(MVP Release\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Entry fee payment gateways, wallet transactions, and cash prize payouts are strictly inactive/i)
    ).toBeInTheDocument();
  });

  it('renders official free tournament in Section A and paid tournament in Section B without overlap', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/v1/tournaments')) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockFreeTournament, mockPaidTournament],
        } as Response);
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter>
        <GameShowcase />
      </MemoryRouter>
    );

    // Free tournament in Section A
    const freeTitle = await screen.findByText('BGMI Official Weekly Free Championship');
    expect(freeTitle).toBeInTheDocument();
    expect(screen.getByText(/OFFICIAL FREE TOURNAMENT OF THE WEEK/i)).toBeInTheDocument();

    // Paid tournament in Section B
    const paidTitle = await screen.findByText('VALORANT Pro Series Qualifier');
    expect(paidTitle).toBeInTheDocument();
    expect(screen.getByText(/Paid Bracket \(Payments Inactive\)/i)).toBeInTheDocument();

    // Verify detail links exist for both
    const detailLinks = screen.getAllByRole('link', { name: /details/i });
    expect(detailLinks.some((l) => l.getAttribute('href') === '/tournaments/free-cup-1')).toBe(true);
    expect(detailLinks.some((l) => l.getAttribute('href') === '/tournaments/paid-cup-1')).toBe(true);
  });

  it('renders polished empty states when no tournaments are scheduled', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/v1/tournaments')) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter>
        <GameShowcase />
      </MemoryRouter>
    );

    // Section A empty state
    await waitFor(() => {
      expect(screen.getByText(/This Week's Free Tournament Is Coming Soon/i)).toBeInTheDocument();
    });

    // Section B empty state
    expect(screen.getByText(/No Entry Tournaments Listed/i)).toBeInTheDocument();
  });

  it('renders wide 16:9 game artwork with correct alt text for all 3 supported games', async () => {
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/v1/tournaments')) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        } as Response);
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter>
        <GameShowcase />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/This Week's Free Tournament Is Coming Soon/i)).toBeInTheDocument();
    });

    const ffImg = screen.getByRole('img', { name: 'Free Fire MAX' });
    const bgmiImg = screen.getByRole('img', { name: 'BGMI' });
    const valImg = screen.getByRole('img', { name: 'VALORANT' });

    expect(ffImg).toBeInTheDocument();
    expect(bgmiImg).toBeInTheDocument();
    expect(valImg).toBeInTheDocument();

    expect(ffImg).toHaveAttribute('loading', 'lazy');
    expect(bgmiImg).toHaveAttribute('loading', 'lazy');
    expect(valImg).toHaveAttribute('loading', 'lazy');
  });
});
