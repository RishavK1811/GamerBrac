import { test, expect } from '@playwright/test';
import {
  registerUser,
  loginUser,
  updateTournamentStatus,
  createMatch,
  createValidEvidenceScreenshot,
  API_BASE,
} from './helpers/api';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('D. Organizer Workflow: Verification, Management, Rosters, AES & Leaderboards', () => {
  const timestamp = Date.now();

  test('unverified organizer sees pending verification banner and cannot create tournaments', async ({
    page,
  }) => {
    // Log in as unverified organizer
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill('e2e_pending_org');
    await page.getByLabel(/Password/i).fill('OrgPass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/organizer');

    // Verify pending verification notice
    await expect(page.getByRole('heading', { name: /Organizer Verification Pending/i })).toBeVisible();
    await expect(page.getByText(/Awaiting Super-Administrator Approval/i)).toBeVisible();
    // Cannot access tournament creation controls
    await expect(page.getByRole('button', { name: /Create Tournament/i })).not.toBeVisible();
  });

  test('verified organizer creates tournament, assigns roster, configures AES-256 room, and verifies score', async ({
    page,
  }) => {
    // 1. Log in as verified organizer
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill('e2e_verified_org');
    await page.getByLabel(/Password/i).fill('OrgPass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/organizer');
    await expect(page.getByRole('heading', { name: /Tournament Organizer Console/i })).toBeVisible();
    await expect(page.getByText(/Organizer Permissions Active/i)).toBeVisible();

    // 2. Click "Create Tournament"
    await page.getByRole('button', { name: /Create Tournament/i }).click();
    await expect(page.getByRole('heading', { name: /Create New Tournament/i })).toBeVisible();

    const tourneyTitle = `Org Cup Live ${timestamp}`;
    await page.getByLabel(/Tournament Title/i).fill(tourneyTitle);
    await page.getByLabel(/Game Title/i).selectOption('BGMI');
    await page.getByLabel(/Format/i).selectOption('solo');
    await page.getByLabel(/Slot Capacity/i).fill('32');

    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
    const dayAfter = new Date(Date.now() + 172800000).toISOString().slice(0, 16);

    await page.getByLabel(/Registration Deadline/i).fill(tomorrow);
    await page.getByLabel(/Start Datetime/i).fill(dayAfter);

    await page.getByRole('button', { name: /Create Tournament \(Draft\)/i }).click();

    // Verify tournament is created and selected
    await expect(page.getByRole('heading', { name: tourneyTitle }).first()).toBeVisible();

    // 3. Register a player & complete check-in via API
    const player = await registerUser({
      username: `org_test_p_${timestamp}`,
      email: `org_test_p_${timestamp}@gamerbrac.com`,
      password: 'SecurePass123!',
      role: 'player',
    });
    const playerAuth = await loginUser(player.username, 'SecurePass123!');
    const orgAuth = await loginUser('org@gamerbrac.com', 'OrgPass123!');

    // Get created tournament ID from API
    const orgTourneys = await (
      await fetch(`${API_BASE}/tournaments?organizer_id=${orgAuth.user.id}`, {
        headers: { Authorization: `Bearer ${orgAuth.access_token}` },
      })
    ).json();
    const createdTourney = orgTourneys.find((t: any) => t.title === tourneyTitle);
    expect(createdTourney).toBeDefined();

    // Open registration -> register player -> close -> check_in -> complete check-in -> ongoing
    await updateTournamentStatus(orgAuth.access_token, createdTourney.id, 'registration_open');
    const regRes = await (
      await fetch(`${API_BASE}/tournaments/${createdTourney.id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerAuth.access_token}`,
        },
        body: JSON.stringify({}),
      })
    ).json();

    await updateTournamentStatus(orgAuth.access_token, createdTourney.id, 'registration_closed');
    await updateTournamentStatus(orgAuth.access_token, createdTourney.id, 'check_in');
    await fetch(`${API_BASE}/tournaments/${createdTourney.id}/check-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${playerAuth.access_token}` },
    });
    await updateTournamentStatus(orgAuth.access_token, createdTourney.id, 'ongoing');

    // 4. Create match for this tournament
    const match = await createMatch(orgAuth.access_token, createdTourney.id, {
      title: 'Match 1 - Erangel',
      match_number: 1,
      round_number: 1,
      scheduled_start_time: new Date(Date.now() + 3600000).toISOString(),
    });

    // Switch to Matches & AES Room Dispatch tab and select created tournament
    await page.getByRole('button', { name: /Matches & AES Room Dispatch/i }).click();
    await page.locator('select').first().selectOption(createdTourney.id);
    await expect(page.getByText('Match 1 - Erangel')).toBeVisible();

    // 5. Click "Assign Checked-In Roster"
    const assignBtn = page.getByRole('button', { name: /Assign Checked-In Roster/i });
    await assignBtn.click();
    await expect(page.getByText(/Assigned/i)).toBeVisible();

    // 6. Configure AES-256 Credentials
    const configCredsBtn = page.getByRole('button', { name: /Set Credentials/i });
    await configCredsBtn.click();

    await expect(page.getByRole('heading', { name: /Configure Room Credentials/i })).toBeVisible();
    await page.getByLabel(/Room ID \/ Match Code/i).fill('BGMI-E2E-LOBBY');
    await page.getByLabel(/Room Password/i).fill('SUPER-SECRET-PASS');

    const releaseTime = new Date(Date.now() - 60000).toISOString().slice(0, 16);
    const expireTime = new Date(Date.now() + 7200000).toISOString().slice(0, 16);

    await page.getByLabel(/Release At/i).fill(releaseTime);
    await page.getByLabel(/Expires At/i).fill(expireTime);

    await page.getByRole('button', { name: /Save & Encrypt/i }).click();
    await expect(page.getByText(/AES-256 Configured/i)).toBeVisible();

    // 7. Player submits score with screenshot evidence via API
    const matchDetail = await (
      await fetch(`${API_BASE}/matches/${match.id}`, {
        headers: { Authorization: `Bearer ${playerAuth.access_token}` },
      })
    ).json();
    const myParticipant = matchDetail.participants.find(
      (p: any) => p.tournament_participant_id === regRes.id
    );
    expect(myParticipant).toBeDefined();

    const evidencePath = path.resolve(__dirname, `../test-artifacts/org-evidence-${timestamp}.png`);
    createValidEvidenceScreenshot(evidencePath);

    // Upload evidence
    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(evidencePath)], { type: 'image/png' });
    formData.append('file', fileBlob, 'score.png');

    const uploadRes = await (
      await fetch(`${API_BASE}/matches/${match.id}/evidence`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${playerAuth.access_token}` },
        body: formData,
      })
    ).json();

    // Submit score
    await fetch(`${API_BASE}/matches/${match.id}/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${playerAuth.access_token}`,
      },
      body: JSON.stringify({
        match_participant_id: myParticipant.id,
        placement: 1,
        kills: 10,
        evidence_url: uploadRes.evidence_url,
        evidence_file_name: 'score.png',
        notes: 'Clean 1st place chicken dinner.',
      }),
    });

    if (fs.existsSync(evidencePath)) {
      fs.unlinkSync(evidencePath);
    }

    // 8. Organizer reviews submission and approves
    await page.getByRole('button', { name: /Score Review & Results/i }).click();
    await page.getByRole('button', { name: /Refresh Submissions/i }).click();

    await expect(page.getByText(/Rank #1/i)).toBeVisible();
    await expect(page.getByText(/10 Kills/i)).toBeVisible();

    // Click Review & Verify
    await page.getByRole('button', { name: /Review & Verify/i }).click();
    await expect(page.getByRole('heading', { name: /Verify Score Submission/i })).toBeVisible();

    // Select Approve & Verify
    await page.getByRole('button', { name: /Approve & Verify/i }).click();

    // Verify verified notification
    await expect(page.getByText(/Submission marked as APPROVED and leaderboard updated/i)).toBeVisible();
  });
});
