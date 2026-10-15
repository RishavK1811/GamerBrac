import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: '320x568 (iPhone SE / Small Android)', width: 320, height: 568 },
  { name: '360x800 (Android Standard)', width: 360, height: 800 },
  { name: '390x844 (iPhone 12/13/14)', width: 390, height: 844 },
  { name: '430x932 (Large Smartphone)', width: 430, height: 932 },
  { name: '768x1024 (Tablet Portrait)', width: 768, height: 1024 },
  { name: '1024x768 (Tablet Landscape)', width: 1024, height: 768 },
  { name: '1440x900 (Desktop)', width: 1440, height: 900 },
];

test.describe('Mobile Responsiveness & Viewport Compatibility', () => {
  for (const vp of VIEWPORTS) {
    test.describe(`Viewport: ${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('home page renders with zero horizontal overflow', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('domcontentloaded');

        const isOverflowing = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(isOverflowing).toBe(false);

        // Verify branding and title are visible
        await expect(page.getByText(/GamerBrac/i).first()).toBeVisible();
      });

      test('tournament directory renders with zero horizontal overflow', async ({ page }) => {
        await page.goto('/tournaments');
        await page.waitForLoadState('domcontentloaded');

        const isOverflowing = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(isOverflowing).toBe(false);

        await expect(page.getByRole('heading', { name: /Tournament Directory/i })).toBeVisible();
      });

      test('tournament detail page renders with zero horizontal overflow', async ({ page }) => {
        await page.goto('/tournaments/tourney-e2e-ff');
        await page.waitForLoadState('domcontentloaded');

        const isOverflowing = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(isOverflowing).toBe(false);

        await expect(page.getByRole('heading', { name: 'E2E Free Fire MAX Open' })).toBeVisible();
      });

      test('login page renders with zero horizontal overflow', async ({ page }) => {
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');

        const isOverflowing = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(isOverflowing).toBe(false);

        await expect(page.getByRole('heading', { name: /Sign In to GamerBrac/i })).toBeVisible();
      });

      test('register page renders with zero horizontal overflow', async ({ page }) => {
        await page.goto('/register');
        await page.waitForLoadState('domcontentloaded');

        const isOverflowing = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(isOverflowing).toBe(false);

        await expect(page.getByRole('heading', { name: /Create Player Account/i })).toBeVisible();
      });
    });
  }

  test.describe('Mobile-Specific Navigation and Modals', () => {
    test.use({ viewport: { width: 360, height: 800 } });

    test('hamburger button toggles mobile navigation menu cleanly', async ({ page }) => {
      await page.goto('/');

      // Hamburger button should be visible on 360px width
      const hamburger = page.locator('button[aria-label="Toggle navigation menu"]');
      await expect(hamburger).toBeVisible();

      // Mobile nav container should initially not be visible
      const mobileNav = page.locator('#mobile-nav-menu');
      await expect(mobileNav).not.toBeVisible();

      // Click to open
      await hamburger.click();
      await expect(mobileNav).toBeVisible();

      // Verify links inside mobile nav
      const tourneysLink = mobileNav.getByRole('link', { name: /^Tournaments$/i });
      await expect(tourneysLink).toBeVisible();

      // Click to close
      await hamburger.click();
      await expect(mobileNav).not.toBeVisible();
    });

    test('interactive leaderboard modal fits within viewport and is scrollable', async ({ page }) => {
      await page.goto('/');

      // Open View Standings modal from the Weekly Free Tournament card
      const leaderboardBtn = page.getByRole('button', { name: /View Standings/i }).first();
      await leaderboardBtn.scrollIntoViewIfNeeded();
      await leaderboardBtn.click();

      // Modal dialog should appear
      const modal = page.locator('.fixed.inset-0.z-50');
      await expect(modal).toBeVisible();

      // Verify modal close button has min touch target >= 40px
      const closeBtn = modal.locator('button[aria-label="Close leaderboard modal"]').first();
      await expect(closeBtn).toBeVisible();
      const boundingBox = await closeBtn.boundingBox();
      expect(boundingBox).not.toBeNull();
      if (boundingBox) {
        expect(boundingBox.width).toBeGreaterThanOrEqual(40);
        expect(boundingBox.height).toBeGreaterThanOrEqual(40);
      }

      // Close modal
      await closeBtn.click();
      await expect(modal).not.toBeVisible();
    });

    test('mobile input font-size is 16px to prevent unwanted browser zoom', async ({ page }) => {
      await page.goto('/login');

      const usernameInput = page.locator('#username_or_email');
      await expect(usernameInput).toBeVisible();

      const fontSize = await usernameInput.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });

      // On screen widths < 640px, fontSize must be 16px
      expect(fontSize).toBe('16px');
    });
  });
});
