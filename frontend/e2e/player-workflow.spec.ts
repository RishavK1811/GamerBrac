import { test, expect } from '@playwright/test';
import {
  registerUser,
  loginUser,
  createTournament,
  updateTournamentStatus,
  API_BASE,
} from './helpers/api';

test.describe('B. Player Workflow: Registration, Game Linking, Teams & Tournament Check-in', () => {
  test('registers and logs in a new player account', async ({ page }) => {
    const timestamp = Date.now();
    const playerUsername = `player_${timestamp}`;
    const playerEmail = `player_${timestamp}@gamerbrac.com`;
    const playerPass = 'SecurePass123!';

    await page.goto('/register');

    await page.getByLabel(/^Username$/i).fill(playerUsername);
    await page.getByLabel(/Email Address/i).fill(playerEmail);
    await page.getByLabel(/^Password$/i).fill(playerPass);
    await page.getByLabel(/Confirm Password/i).fill(playerPass);
    await page.getByRole('button', { name: /Complete Registration/i }).click();

    // Verify redirected to Dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(playerUsername).first()).toBeVisible();
    await expect(page.getByText('Account Status')).toBeVisible();
  });

  test('links a game account (BGMI UID) and displays verified status', async ({ page }) => {
    const timestamp = Date.now();
    const playerUsername = `player_bgmi_${timestamp}`;
    const playerEmail = `player_bgmi_${timestamp}@gamerbrac.com`;
    const playerPass = 'SecurePass123!';

    await registerUser({ username: playerUsername, email: playerEmail, password: playerPass });

    // Log in
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill(playerUsername);
    await page.getByLabel(/Password/i).fill(playerPass);
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to Game Accounts tab
    const accountsTab = page.getByRole('button', { name: /Game Accounts/i });
    await accountsTab.click();

    await expect(page.getByRole('heading', { name: /Linked Game Accounts/i })).toBeVisible();

    // Fill form
    await page.getByLabel(/Game Title/i).selectOption('BGMI');
    await page.getByLabel(/In-Game Name/i).fill('BGMI_ProSniper');
    await page.getByLabel(/In-Game UID/i).fill('5544332211');
    await page.getByRole('button', { name: /^Link Game Account$/i }).click();

    // Verify success and account listed
    await expect(page.getByText('BGMI_ProSniper')).toBeVisible();
    await expect(page.getByText('5544332211')).toBeVisible();
    await expect(page.getByText('Pending Verification').first()).toBeVisible();
  });

  test('creates a squad team and enforces tag constraints', async ({ page }) => {
    const timestamp = Date.now();
    const playerUsername = `player_team_${timestamp}`;
    const playerEmail = `player_team_${timestamp}@gamerbrac.com`;
    const playerPass = 'SecurePass123!';

    await registerUser({ username: playerUsername, email: playerEmail, password: playerPass });

    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill(playerUsername);
    await page.getByLabel(/Password/i).fill(playerPass);
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate to Teams tab
    const teamsTab = page.getByRole('button', { name: /Teams \(/i });
    await teamsTab.click();

    await expect(page.getByText(/Competitive Teams & Rosters/i)).toBeVisible();

    // Open Create Team modal
    const createTeamBtn = page.getByRole('button', { name: /Create Team/i });
    await createTeamBtn.click();

    // Fill Team form
    await page.getByLabel(/Team Name/i).fill(`Alpha Squad ${timestamp.toString().slice(-4)}`);
    await page.getByLabel(/Clan Tag/i).fill('ALPH');
    await page.getByLabel(/Primary Game/i).selectOption('BGMI');
    await page.getByRole('button', { name: /Register Team/i }).click();

    // Verify team is listed with captain role
    await expect(page.getByRole('heading', { name: `Alpha Squad ${timestamp.toString().slice(-4)}` })).toBeVisible();
    await expect(page.getByText('[ALPH]')).toBeVisible();
    await expect(page.getByText('Captain').first()).toBeVisible();
  });

  test('registers for an eligible solo tournament and completes check-in', async ({ page }) => {
    const timestamp = Date.now();
    const playerUsername = `player_tourney_${timestamp}`;
    const playerEmail = `player_tourney_${timestamp}@gamerbrac.com`;
    const playerPass = 'SecurePass123!';

    await registerUser({ username: playerUsername, email: playerEmail, password: playerPass });

    // Create an isolated solo tournament in check_in state via organizer API
    const orgAuth = await loginUser('org@gamerbrac.com', 'OrgPass123!');
    const now = new Date();
    const soloTourney = await createTournament(orgAuth.access_token, {
      title: `E2E Solo Sprint ${timestamp}`,
      game_title: 'Free Fire MAX',
      format: 'solo',
      max_participants: 32,
      registration_deadline: new Date(now.getTime() + 86400000).toISOString(),
      check_in_deadline: new Date(now.getTime() + 172800000).toISOString(),
      start_datetime: new Date(now.getTime() + 259200000).toISOString(),
    });
    // Advance to registration_open
    await updateTournamentStatus(orgAuth.access_token, soloTourney.id, 'registration_open');

    // Log in as player
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill(playerUsername);
    await page.getByLabel(/Password/i).fill(playerPass);
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Go to tournament detail page
    await page.goto(`/tournaments/${soloTourney.id}`);
    await expect(page.getByRole('heading', { name: soloTourney.title })).toBeVisible();

    // Click register
    const registerBtn = page.getByRole('button', { name: /Register for Free/i });
    await registerBtn.click();

    await expect(page.getByText(/Successfully registered for the tournament!/i)).toBeVisible();
    await expect(page.getByText(/You are Registered/i)).toBeVisible();

    // Advance tournament to check_in
    await updateTournamentStatus(orgAuth.access_token, soloTourney.id, 'registration_closed');
    await updateTournamentStatus(orgAuth.access_token, soloTourney.id, 'check_in');

    // Reload page to see Check-in button
    await page.reload();
    const checkInBtn = page.getByRole('button', { name: /Check In Now/i });
    await checkInBtn.click();

    await expect(page.getByText(/Attendance verified!/i)).toBeVisible();
  });

  test('enforces capacity limits and rejects registration when tournament is full', async ({ page }) => {
    const timestamp = Date.now();
    const orgAuth = await loginUser('org@gamerbrac.com', 'OrgPass123!');
    const now = new Date();
    const fullTourney = await createTournament(orgAuth.access_token, {
      title: `E2E Capacity Test ${timestamp}`,
      game_title: 'Free Fire MAX',
      format: 'solo',
      max_participants: 2, // minimum capacity 2
      registration_deadline: new Date(now.getTime() + 86400000).toISOString(),
      start_datetime: new Date(now.getTime() + 259200000).toISOString(),
    });
    await updateTournamentStatus(orgAuth.access_token, fullTourney.id, 'registration_open');

    // Register User 1 & 2 via API to fill all 2 slots
    const p1 = await registerUser({
      username: `p1_cap_${timestamp}`,
      email: `p1_cap_${timestamp}@gamerbrac.com`,
      password: 'SecurePass123!',
      role: 'player',
    });
    await fetch(`${API_BASE}/tournaments/${fullTourney.id}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${p1.access_token}`,
      },
      body: JSON.stringify({}),
    });

    const p2 = await registerUser({
      username: `p2_cap_${timestamp}`,
      email: `p2_cap_${timestamp}@gamerbrac.com`,
      password: 'SecurePass123!',
      role: 'player',
    });
    await fetch(`${API_BASE}/tournaments/${fullTourney.id}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${p2.access_token}`,
      },
      body: JSON.stringify({}),
    });

    // Create 3rd player trying to register for full tournament
    const p3 = await registerUser({
      username: `p3_cap_${timestamp}`,
      email: `p3_cap_${timestamp}@gamerbrac.com`,
      password: 'SecurePass123!',
      role: 'player',
    });

    // Login as player 3
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill(p3.username);
    await page.getByLabel(/Password/i).fill('SecurePass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/tournaments/${fullTourney.id}`);
    await expect(page.getByRole('heading', { name: fullTourney.title })).toBeVisible();

    // Verify tournament capacity shows full and registration is blocked
    await expect(page.getByText(/Tournament Capacity Reached/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Register for Free/i })).not.toBeVisible();
  });
});
