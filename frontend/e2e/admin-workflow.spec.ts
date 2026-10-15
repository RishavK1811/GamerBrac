import { test, expect } from '@playwright/test';
import {
  registerUser,
  loginUser,
  createTournament,
  updateTournamentStatus,
  getTestTournamentSchedule,
  API_BASE,
} from './helpers/api';

test.describe('E. Admin Workflow: Approvals, Moderation, Dispute Resolution & Access Control', () => {
  const timestamp = Date.now();

  test('admin portal approves pending organizer and enables tournament creation', async ({ page }) => {
    // Log in as super admin
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill('e2e_admin');
    await page.getByLabel(/Password/i).fill('AdminPass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/admin');
    await expect(page.getByText(/Platform Administration/i)).toBeVisible();
    await expect(page.getByText(/Super Admin/i)).toBeVisible();

    // Verify unverified organizer is listed on Organizer Approvals tab
    const orgRow = page.getByRole('row', { name: /e2e_unverified_org/i });
    await expect(orgRow).toBeVisible();

    // Click "Approve Organizer" for e2e_unverified_org
    await orgRow.getByRole('button', { name: /Approve Organizer/i }).click();

    // Verify confirmation and that e2e_unverified_org is removed from queue
    await expect(page.getByText(/approved successfully/i)).toBeVisible();
    await expect(page.getByRole('cell', { name: '@e2e_unverified_org' })).not.toBeVisible();

    // Log out admin
    await page.getByTitle('Sign Out').click();

    // Log in as newly approved organizer
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill('e2e_unverified_org');
    await page.getByLabel(/Password/i).fill('OrgPass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/(\/dashboard|\/admin)/);

    // Verify organizer console is now fully active
    await page.goto('/organizer');
    await expect(page.getByText(/Organizer Permissions Active/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Tournament/i }).first()).toBeVisible();
  });

  test('admin suspends user with audit reason and blocks login', async ({ page }) => {
    // Create a player to suspend
    const userToSuspend = await registerUser({
      username: `cheater_${timestamp}`,
      email: `cheater_${timestamp}@gamerbrac.com`,
      password: 'SecurePass123!',
      role: 'player',
    });

    // Log in as admin
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill('e2e_admin');
    await page.getByLabel(/Password/i).fill('AdminPass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/admin');

    // Switch to User Moderation tab
    await page.getByRole('button', { name: /User Moderation/i }).click();
    await expect(page.getByPlaceholder(/Search by username or email/i)).toBeVisible();

    // Search user
    await page.getByPlaceholder(/Search by username or email/i).fill(userToSuspend.username);
    await expect(page.getByRole('cell', { name: `@${userToSuspend.username}` })).toBeVisible();

    // Click Suspend User button
    await page.getByRole('button', { name: /^Suspend$/i }).click();
    await expect(page.getByText(/Suspend User Account/i)).toBeVisible();

    // Enter audit justification
    await page.getByLabel(/Violation Reason/i).fill('Confirmed wallhack violation in match.');
    await page.getByRole('button', { name: /Confirm Suspension/i }).click();

    // Verify notification
    await expect(page.getByText(/has been suspended/i)).toBeVisible();

    // Log out admin
    await page.getByTitle('Sign Out').click();

    // Attempt to log in with suspended account
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill(userToSuspend.username);
    await page.getByLabel(/Password/i).fill('SecurePass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();

    // Login fails with suspension notification
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/Account is disabled/i)).toBeVisible();
  });

  test('admin resolves match dispute reports and inspects immutable audit logs', async ({ page }) => {
    // 1. Create a dispute report via API
    const reporter = await registerUser({
      username: `dispute_reporter_${timestamp}`,
      email: `dispute_reporter_${timestamp}@gamerbrac.com`,
      password: 'SecurePass123!',
      role: 'player',
    });
    const reporterAuth = await loginUser(reporter.username, 'SecurePass123!');

    await fetch(`${API_BASE}/admin/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${reporterAuth.access_token}`,
      },
      body: JSON.stringify({
        category: 'MATCH_DISPUTE',
        description: 'Unauthorized player UID detected on opponent squad.',
      }),
    });

    // 2. Log in as admin
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill('e2e_admin');
    await page.getByLabel(/Password/i).fill('AdminPass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/admin');

    // 3. Navigate to Disputes & Reports tab
    await page.getByRole('button', { name: /Disputes & Reports/i }).click();
    await expect(page.getByText('Unauthorized player UID detected on opponent squad.')).toBeVisible();

    // Click Resolve Dispute
    await page.getByRole('button', { name: /^Resolve$/i }).click();
    await expect(page.getByText(/Resolve Dispute Report/i)).toBeVisible();

    await page.getByLabel(/Resolution Notes/i).fill('Roster verified against logs. Warning issued.');
    await page.getByRole('button', { name: /Submit Resolution/i }).click();

    await expect(page.getByText(/Report marked as RESOLVED/i)).toBeVisible();

    // 4. Switch to Audit Logs tab
    await page.getByRole('button', { name: /Audit Logs/i }).click();
    await expect(page.getByText(/System & Administrative Audit Trail/i)).toBeVisible();
    // Audit logs render action table
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('ordinary players and organizers cannot access admin-only endpoints', async () => {
    const player = await registerUser({
      username: `player_boundary_${timestamp}`,
      email: `player_boundary_${timestamp}@gamerbrac.com`,
      password: 'SecurePass123!',
      role: 'player',
    });
    const playerAuth = await loginUser(player.username, 'SecurePass123!');
    const orgAuth = await loginUser('org@gamerbrac.com', 'OrgPass123!');

    // Player attempting admin GET /admin/users -> 403
    const p1 = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${playerAuth.access_token}` },
    });
    expect(p1.status).toBe(403);

    // Organizer attempting admin GET /admin/users -> 403
    const o1 = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${orgAuth.access_token}` },
    });
    expect(o1.status).toBe(403);

    // Player attempting admin audit logs -> 403
    const p2 = await fetch(`${API_BASE}/admin/audit-logs`, {
      headers: { Authorization: `Bearer ${playerAuth.access_token}` },
    });
    expect(p2.status).toBe(403);

    // Organizer attempting admin report resolution -> 403 (PATCH)
    const o2 = await fetch(`${API_BASE}/admin/reports/dummy-id/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${orgAuth.access_token}`,
      },
      body: JSON.stringify({ status: 'resolved' }),
    });
    expect(o2.status).toBe(403);
  });

  test('team disband restrictions remain strictly enforced on server-side', async () => {
    // Register captain and member
    const captain = await registerUser({
      username: `cap_${timestamp}`,
      email: `cap_${timestamp}@gamerbrac.com`,
      password: 'SecurePass123!',
      role: 'player',
    });
    const member = await registerUser({
      username: `mem_${timestamp}`,
      email: `mem_${timestamp}@gamerbrac.com`,
      password: 'SecurePass123!',
      role: 'player',
    });

    const capAuth = await loginUser(captain.username, 'SecurePass123!');
    const memAuth = await loginUser(member.username, 'SecurePass123!');

    // Create team
    const teamRes = await fetch(`${API_BASE}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${capAuth.access_token}`,
      },
      body: JSON.stringify({
        name: `Disband Test ${timestamp.toString().slice(-4)}`,
        tag: 'DISB',
        primary_game: 'BGMI',
      }),
    });
    const team = await teamRes.json();

    // Add member
    await fetch(`${API_BASE}/teams/${team.id}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${capAuth.access_token}`,
      },
      body: JSON.stringify({
        user_id: member.id,
        role: 'member',
      }),
    });

    // 1. Non-captain member cannot disband -> 403
    const memDisbandRes = await fetch(`${API_BASE}/teams/${team.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${memAuth.access_token}` },
    });
    expect(memDisbandRes.status).toBe(403);

    // 2. Register team in an active tournament
    const orgAuth = await loginUser('org@gamerbrac.com', 'OrgPass123!');
    const sched = getTestTournamentSchedule(2);
    const tourney = await createTournament(orgAuth.access_token, {
      title: `Team Lock Tournament ${timestamp}`,
      game_title: 'BGMI',
      format: 'squad',
      max_participants: 16,
      registration_deadline: sched.registration_deadline,
      start_datetime: sched.start_datetime,
    });
    await updateTournamentStatus(orgAuth.access_token, tourney.id, 'registration_open');

    await fetch(`${API_BASE}/tournaments/${tourney.id}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${capAuth.access_token}`,
      },
      body: JSON.stringify({ team_id: team.id }),
    });

    // 3. Captain cannot disband while registered in active tournament -> 400
    const lockedDisbandRes = await fetch(`${API_BASE}/teams/${team.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${capAuth.access_token}` },
    });
    expect(lockedDisbandRes.status).toBe(400);

    // 4. Withdraw team from tournament
    const withdrawRes = await fetch(`${API_BASE}/tournaments/${tourney.id}/register`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${capAuth.access_token}` },
    });
    expect(withdrawRes.status).toBe(200);

    // 5. Captain can now disband cleanly -> 200
    const cleanDisbandRes = await fetch(`${API_BASE}/teams/${team.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${capAuth.access_token}` },
    });
    expect(cleanDisbandRes.status).toBe(200);
  });
});
