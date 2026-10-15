import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  registerUser,
  loginUser,
  createTournament,
  updateTournamentStatus,
  createMatch,
  setMatchCredentials,
  createValidEvidenceScreenshot,
  getTestTournamentSchedule,
  API_BASE,
} from './helpers/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('C. Match Room Credentials, Private Evidence & Score Submissions', () => {
  const timestamp = Date.now();
  let orgToken: string;
  let playerToken: string;
  let playerUser: any;
  let tourneyId: string;
  let matchId: string;
  let tpId: string;
  let _mpId: string;

  test.beforeAll(async () => {
    // 1. Log in organizer
    const orgAuth = await loginUser('org@gamerbrac.com', 'OrgPass123!');
    orgToken = orgAuth.access_token;

    // 2. Register test player
    playerUser = await registerUser({
      username: `score_player_${timestamp}`,
      email: `score_player_${timestamp}@gamerbrac.com`,
      password: 'SecurePass123!',
      role: 'player',
    });
    const playerAuth = await loginUser(playerUser.username, 'SecurePass123!');
    playerToken = playerAuth.access_token;

    // 3. Create tournament in ongoing state with participant checked-in
    const sched = getTestTournamentSchedule(3);
    const tourney = await createTournament(orgToken, {
      title: `E2E Scoring Cup ${timestamp}`,
      game_title: 'BGMI',
      format: 'solo',
      max_participants: 16,
      registration_deadline: sched.registration_deadline,
      start_datetime: sched.start_datetime,
    });
    tourneyId = tourney.id;

    // Advance to registration_open
    await updateTournamentStatus(orgToken, tourneyId, 'registration_open');

    // Register player
    const regRes = await fetch(`${API_BASE}/tournaments/${tourneyId}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${playerToken}`,
      },
      body: JSON.stringify({}),
    });
    const regData = await regRes.json();
    tpId = regData.id;

    // Advance to check_in and complete check-in
    await updateTournamentStatus(orgToken, tourneyId, 'registration_closed');
    await updateTournamentStatus(orgToken, tourneyId, 'check_in');
    await fetch(`${API_BASE}/tournaments/${tourneyId}/check-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${playerToken}` },
    });

    // Advance to ongoing
    await updateTournamentStatus(orgToken, tourneyId, 'ongoing');

    // Create match
    const match = await createMatch(orgToken, tourneyId, {
      title: 'Grand Finals Round 1',
      match_number: 1,
      round_number: 1,
      scheduled_start_time: new Date(Date.now() + 3600000).toISOString(),
    });
    matchId = match.id;

    // Assign player to match
    const mpRes = await fetch(`${API_BASE}/matches/${matchId}/participants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgToken}`,
      },
      body: JSON.stringify({
        tournament_participant_id: tpId,
        slot_number: 1,
      }),
    });
    const mpData = await mpRes.json();
    _mpId = mpData.id;
  });

  test('blocks credential retrieval before release window opens', async ({ page }) => {
    // Configure match credentials with release window in the FUTURE (opens 1 hour from now)
    const futureRelease = new Date(Date.now() + 3600000).toISOString();
    const futureExpiry = new Date(Date.now() + 7200000).toISOString();

    await setMatchCredentials(orgToken, matchId, {
      room_id: 'FUTURE-ROOM-777',
      room_password: 'SECRET-PASS-777',
      release_at: futureRelease,
      expires_at: futureExpiry,
    });

    // Login as player
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill(playerUser.username);
    await page.getByLabel(/Password/i).fill('SecurePass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Visit tournament detail
    await page.goto(`/tournaments/${tourneyId}`);
    await expect(page.getByRole('heading', { name: 'Grand Finals Round 1' })).toBeVisible();

    // Click Room Credentials
    await page.getByRole('button', { name: /Room Credentials/i }).click();

    // Verify modal alerts that release window is restricted
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/Release window opens at/i)).toBeVisible();
    await expect(page.locator('[data-testid="room-id-value"]')).not.toBeVisible();
  });

  test('eligible assigned participant reveals decrypted credentials during the active window', async ({
    page,
  }) => {
    // Set release window currently ACTIVE (opened 5 mins ago, expires in 1 hour)
    const pastRelease = new Date(Date.now() - 300000).toISOString();
    const futureExpiry = new Date(Date.now() + 3600000).toISOString();

    await setMatchCredentials(orgToken, matchId, {
      room_id: 'LIVE-LOBBY-999',
      room_password: 'UNLOCKED-SECRET-2026',
      release_at: pastRelease,
      expires_at: futureExpiry,
    });

    // Login as player
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill(playerUser.username);
    await page.getByLabel(/Password/i).fill('SecurePass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/tournaments/${tourneyId}`);
    await expect(page.getByRole('heading', { name: 'Grand Finals Round 1' })).toBeVisible();

    // Click Room Credentials
    await page.getByRole('button', { name: /Room Credentials/i }).click();

    // Verify decrypted credentials are displayed
    await expect(page.locator('[data-testid="room-id-value"]')).toHaveText('LIVE-LOBBY-999');
    await expect(page.locator('[data-testid="room-password-value"]')).toHaveText(
      'UNLOCKED-SECRET-2026'
    );
    await expect(page.getByText(/Do not share credentials outside your registered roster/i)).toBeVisible();

    // Test Copy button
    const copyRoomBtn = page.getByRole('button', { name: /Copy Room ID/i });
    await copyRoomBtn.click();
    await expect(copyRoomBtn.locator('svg')).toBeVisible();
  });

  test('player uploads valid screenshot evidence and submits verified score', async ({ page }) => {
    // Prepare valid screenshot evidence
    const evidencePath = path.resolve(__dirname, `../test-artifacts/valid-evidence-${timestamp}.png`);
    createValidEvidenceScreenshot(evidencePath);

    // Login as player
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill(playerUser.username);
    await page.getByLabel(/Password/i).fill('SecurePass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto(`/tournaments/${tourneyId}`);

    // Click Submit Score button
    const submitBtn = page.getByRole('button', { name: /Submit Score/i });
    await submitBtn.click();

    await expect(page.getByText(/Submit Match Score & Evidence/i)).toBeVisible();

    // Fill score
    await page.getByLabel(/Placement \/ Rank/i).fill('1');
    await page.getByLabel(/Total Kills/i).fill('8');

    // Upload evidence file
    const fileInput = page.locator('#score-evidence-file');
    await fileInput.setInputFiles(evidencePath);

    await expect(page.getByText(path.basename(evidencePath))).toBeVisible();

    // Fill notes
    await page.getByLabel(/Additional Notes/i).fill('Victory scoreboard screenshot attached.');

    // Submit for verification
    await page.getByRole('button', { name: /Submit for Verification/i }).click();

    // Verify success banner
    await expect(page.getByText(/submitted successfully for organizer verification/i)).toBeVisible();

    // Clean up local temp file
    if (fs.existsSync(evidencePath)) {
      fs.unlinkSync(evidencePath);
    }
  });

  test('private evidence storage is protected against unauthorized access', async () => {
    // Create an unauthorized outsider player
    const outsider = await registerUser({
      username: `outsider_${timestamp}`,
      email: `outsider_${timestamp}@gamerbrac.com`,
      password: 'SecurePass123!',
      role: 'player',
    });
    const outsiderAuth = await loginUser(outsider.username, 'SecurePass123!');

    // Get submission evidence URL
    const subsRes = await fetch(`${API_BASE}/matches/${matchId}/submissions`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    const subs = await subsRes.json();
    expect(subs.length).toBeGreaterThan(0);
    const evidenceUrl = subs[0].evidence_url;

    // 1. Unauthenticated request to private evidence is rejected (401)
    const unauthRes = await fetch(`http://127.0.0.1:8000${evidenceUrl}`);
    expect(unauthRes.status).toBe(401);

    // 2. Unauthorized third-party player request is rejected (403)
    const outsiderRes = await fetch(`http://127.0.0.1:8000${evidenceUrl}`, {
      headers: { Authorization: `Bearer ${outsiderAuth.access_token}` },
    });
    expect(outsiderRes.status).toBe(403);

    // 3. Authorized submitter player can access the evidence (200)
    const ownerRes = await fetch(`http://127.0.0.1:8000${evidenceUrl}`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    expect(ownerRes.status).toBe(200);

    // 4. Authorized tournament organizer can access the evidence (200)
    const orgRes = await fetch(`http://127.0.0.1:8000${evidenceUrl}`, {
      headers: { Authorization: `Bearer ${orgToken}` },
    });
    expect(orgRes.status).toBe(200);
  });
});
