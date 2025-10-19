import { test, expect } from '@playwright/test';

test.describe('Search Page Tests', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });
  });

  test('should load search page', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/search');
    await page.screenshot({ path: 'tests/screenshots/search.png', fullPage: true });
  });

  test('should display search interface or auth requirement', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    // Should show either search input or auth requirement
    const searchInput = await page.getByPlaceholder(/search|wooden desk/i).isVisible().catch(() => false);
    const authRequired = await page.getByText(/authentication required|sign in/i).isVisible().catch(() => false);

    expect(searchInput || authRequired).toBe(true);
  });

  test('should have search form elements if authenticated', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    // Check if search page elements exist (if authenticated)
    const hasSearchButton = await page.getByRole('button', { name: /search/i }).isVisible().catch(() => false);

    if (hasSearchButton) {
      // Verify other search elements
      const searchInput = page.getByPlaceholder(/search|wooden desk/i);
      await expect(searchInput).toBeVisible();
    }
  });

  test('should not have critical console errors', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('Warning:') &&
      !error.includes('Download the React DevTools') &&
      !error.includes('Clerk:')
    );

    if (criticalErrors.length > 0) {
      console.log('Search Page Console Errors:', criticalErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });

  test('should render product search heading', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    const heading = await page.getByText(/product search/i).isVisible().catch(() => false);
    expect(heading).toBe(true);
  });
});
