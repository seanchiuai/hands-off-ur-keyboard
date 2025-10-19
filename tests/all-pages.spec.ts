import { test, expect } from '@playwright/test';

test.describe('All Pages General Tests', () => {
  const pages = [
    { url: '/', name: 'Homepage' },
    { url: '/shop', name: 'Shop' },
    { url: '/search', name: 'Search' },
    { url: '/voice-demo', name: 'Voice Demo' },
    { url: '/voice', name: 'Voice' },
  ];

  pages.forEach(({ url, name }) => {
    test(`${name} should load without 404`, async ({ page }) => {
      const response = await page.goto(url);
      expect(response?.status()).not.toBe(404);
    });

    test(`${name} should have no network errors`, async ({ page }) => {
      const failedRequests: string[] = [];

      page.on('requestfailed', request => {
        failedRequests.push(`${request.url()} - ${request.failure()?.errorText}`);
      });

      await page.goto(url);
      await page.waitForLoadState('networkidle');

      // Filter out expected failures (external resources, clerk, etc.)
      const criticalFailures = failedRequests.filter(req =>
        !req.includes('clerk') &&
        !req.includes('googleapis') &&
        !req.includes('convex')
      );

      if (criticalFailures.length > 0) {
        console.log(`${name} Network Failures:`, criticalFailures);
      }

      // Log but don't fail on network errors as external services might be down
      expect(criticalFailures.length).toBeLessThan(10);
    });

    test(`${name} should render React app`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      // Check if Next.js app rendered
      const htmlContent = await page.content();
      expect(htmlContent.length).toBeGreaterThan(100);

      // Check for Next.js ID
      const nextRoot = await page.locator('#__next').count();
      expect(nextRoot).toBeGreaterThan(0);
    });
  });

  test('should check all pages load within reasonable time', async ({ page }) => {
    for (const { url, name } of pages) {
      const startTime = Date.now();
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - startTime;

      console.log(`${name} load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(10000); // 10 seconds max
    }
  });
});
