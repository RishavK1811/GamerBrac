import { test, expect } from '@playwright/test';
import { registerUser } from './helpers/api';

test.describe('A. Guest Browsing, Directory & Authentication', () => {
  test('homepage renders hero, featured titles and working navigation links', async ({ page }) => {
    await page.goto('/');

    // Check Hero elements
    await expect(page.getByText(/India's Community Esports Tournament Engine/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /CHOOSE YOUR BATTLEGROUND/i })).toBeVisible();

    // Check navbar links
    const tourneysLink = page.getByRole('link', { name: /^Tournaments$/i }).first();
    const loginLink = page.getByRole('link', { name: /Sign In/i }).first();
    const registerLink = page.getByRole('link', { name: /Register/i }).first();

    await expect(tourneysLink).toBeVisible();
    await expect(loginLink).toBeVisible();
    await expect(registerLink).toBeVisible();
  });

  test('tournament directory search and game filters work accurately', async ({ page }) => {
    await page.goto('/tournaments');

    await expect(page.getByRole('heading', { name: /Tournament Directory/i })).toBeVisible();

    // Verify initial tournaments rendered
    await expect(page.getByText('E2E Free Fire MAX Open')).toBeVisible();
    await expect(page.getByText('E2E BGMI Battlegrounds Series')).toBeVisible();

    // Filter by BGMI
    const bgmiBtn = page.getByRole('button', { name: 'BGMI', exact: true });
    await bgmiBtn.click();

    await expect(page.getByText('E2E BGMI Battlegrounds Series')).toBeVisible();
    await expect(page.getByText('E2E Free Fire MAX Open')).not.toBeVisible();

    // Reset filter
    const allGamesBtn = page.getByRole('button', { name: 'All Games', exact: true });
    await allGamesBtn.click();
    await expect(page.getByText('E2E Free Fire MAX Open')).toBeVisible();

    // Search by title keyword
    const searchInput = page.getByPlaceholder(/Search tournament title/i);
    await searchInput.fill('Free Fire');
    await expect(page.getByText('E2E Free Fire MAX Open')).toBeVisible();
    await expect(page.getByText('E2E BGMI Battlegrounds Series')).not.toBeVisible();
  });

  test('details buttons navigate to the correct tournament page', async ({ page }) => {
    await page.goto('/tournaments');

    // Click on View Details link for the Free Fire tournament
    const detailsLink = page.locator('a[href="/tournaments/tourney-e2e-ff"]').first();
    await detailsLink.click();

    await expect(page).toHaveURL(/\/tournaments\/tourney-e2e-ff/);
    await expect(page.getByRole('heading', { name: 'E2E Free Fire MAX Open' })).toBeVisible();
    await expect(page.getByText(/Tournament Specifications, Rules & Terms/i)).toBeVisible();
    await expect(page.getByText(/Prize Pool & Rank Distribution/i)).toBeVisible();
  });

  test('registration and login forms display useful validation errors', async ({ page }) => {
    // 1. Login with bad credentials
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill('unknown_player@gb.com');
    await page.getByLabel(/Password/i).fill('WrongPassword123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/Invalid username\/email or password/i)).toBeVisible();

    // 2. Register with mismatched password
    await page.goto('/register');
    await page.getByLabel(/^Username$/i).fill('test_user_val');
    await page.getByLabel(/Email Address/i).fill('val@gamerbrac.com');
    await page.getByLabel(/^Password$/i).fill('SecurePass123!');
    await page.getByLabel(/Confirm Password/i).fill('DifferentPass456!');
    await page.getByRole('button', { name: /Complete Registration/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/Passwords do not match/i);
  });

  test('unauthenticated users cannot access protected dashboards', async ({ page }) => {
    // Attempt visiting /dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    // Attempt visiting /organizer
    await page.goto('/organizer');
    await expect(page).toHaveURL(/\/login/);

    // Attempt visiting /admin
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('a player account cannot access organizer or admin routes', async ({ page }) => {
    const timestamp = Date.now();
    const username = `player_route_${timestamp}`;
    const email = `player_route_${timestamp}@gamerbrac.com`;

    // Create player account via API
    await registerUser({ username, email, password: 'SecurePass123!', role: 'player' });

    // Log in via UI
    await page.goto('/login');
    await page.getByLabel(/Username or Email/i).fill(username);
    await page.getByLabel(/Password/i).fill('SecurePass123!');
    await page.getByRole('button', { name: /^Sign In$/i }).click();

    // Player Hub dashboard is accessible
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: username })).toBeVisible();

    // Attempt navigating to /organizer
    await page.goto('/organizer');
    // Role guard displays Access Restricted banner
    await expect(page.getByRole('heading', { name: /Access Restricted/i })).toBeVisible();
    await expect(page.getByText(/requires.*organizer or admin.*authorization/i)).toBeVisible();

    // Attempt navigating to /admin
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Access Restricted/i })).toBeVisible();
    await expect(page.getByText(/requires.*admin.*authorization/i)).toBeVisible();
  });
});
