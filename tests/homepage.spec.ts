import { test, expect } from '@playwright/test';

test.describe('Homepage Tests', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });
  });

  test('should load homepage without errors', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if page loaded
    expect(page.url()).toContain('localhost:3000');

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/homepage.png', fullPage: true });
  });

  test('should display welcome message', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for welcome text
    const welcomeText = await page.getByText(/Welcome to Hands Off Ur Keyboard|VIBED/i);
    await expect(welcomeText).toBeVisible();
  });

  test('should show sign in options when not authenticated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for sign in button
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeVisible();

    // Check for create account button
    const createAccountButton = page.getByRole('button', { name: /create account/i });
    await expect(createAccountButton).toBeVisible();
  });

  test('should not have console errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait a bit for any async errors
    await page.waitForTimeout(2000);

    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('Warning:') &&
      !error.includes('Download the React DevTools')
    );

    if (criticalErrors.length > 0) {
      console.log('Console Errors Found:', criticalErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check title
    const title = await page.title();
    expect(title).toBeTruthy();

    // Check viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBeTruthy();
  });
});
