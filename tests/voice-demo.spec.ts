import { test, expect } from '@playwright/test';

test.describe('Voice Demo Page Tests', () => {
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

  test('should load voice demo page', async ({ page }) => {
    await page.goto('/voice-demo');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/voice-demo');
    await page.screenshot({ path: 'tests/screenshots/voice-demo.png', fullPage: true });
  });

  test('should display voice demo interface or auth requirement', async ({ page }) => {
    await page.goto('/voice-demo');
    await page.waitForLoadState('networkidle');

    // Should show either voice interface or auth requirement
    const voiceInterface = await page.getByText(/voice|microphone|demo/i).isVisible().catch(() => false);
    const authRequired = await page.getByText(/authentication required|sign in/i).isVisible().catch(() => false);

    expect(voiceInterface || authRequired).toBe(true);
  });

  test('should not have critical console errors', async ({ page }) => {
    await page.goto('/voice-demo');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('Warning:') &&
      !error.includes('Download the React DevTools') &&
      !error.includes('Clerk:') &&
      !error.includes('NEXT_PUBLIC_GEMINI_API_KEY') // Expected warning
    );

    if (criticalErrors.length > 0) {
      console.log('Voice Demo Page Console Errors:', criticalErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });

  test('should check for voice components', async ({ page }) => {
    await page.goto('/voice-demo');
    await page.waitForLoadState('networkidle');

    // Look for voice-related UI elements
    const hasMicButton = await page.locator('button').filter({ hasText: /start|mic|voice/i }).isVisible().catch(() => false);
    const hasVoiceText = await page.getByText(/voice/i).isVisible().catch(() => false);

    // At least one voice-related element should be present
    expect(hasMicButton || hasVoiceText).toBe(true);
  });
});
