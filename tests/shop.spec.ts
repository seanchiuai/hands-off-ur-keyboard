import { test, expect } from '@playwright/test';

test.describe('Shop Page Tests', () => {
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

  test('should load shop page', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');

    // Check if page loaded
    expect(page.url()).toContain('/shop');

    await page.screenshot({ path: 'tests/screenshots/shop.png', fullPage: true });
  });

  test('should show authentication requirement or content', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');

    // Should either show auth requirement or shop content
    const authRequired = await page.getByText(/sign in/i).isVisible().catch(() => false);
    const shopContent = await page.getByText(/voice shopping|shopping/i).isVisible().catch(() => false);

    expect(authRequired || shopContent).toBe(true);
  });

  test('should not have critical console errors', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('Warning:') &&
      !error.includes('Download the React DevTools') &&
      !error.includes('Clerk:')
    );

    if (criticalErrors.length > 0) {
      console.log('Shop Page Console Errors:', criticalErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });

  test('should render without React errors', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');

    // Check for React error boundaries
    const errorBoundary = await page.getByText(/something went wrong/i).isVisible().catch(() => false);
    expect(errorBoundary).toBe(false);
  });

  test('should have responsive layout', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Take mobile screenshot
    await page.screenshot({ path: 'tests/screenshots/shop-mobile.png', fullPage: true });
  });
});
