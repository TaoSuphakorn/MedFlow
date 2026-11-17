import { test as base, expect } from '@playwright/test';

// Existing workflow suites exercise returning users. Only the onboarding preference
// is overridden; identity, permissions, cookies, CSRF and clinical operations stay real.
export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    // The expanded suite can exceed the real 30 logins/minute limit.
    // Keep that production protection and wait for its window once on 429.
    testInfo.setTimeout(testInfo.timeout + 65_000);
    await context.route('**/api/auth/login', async route => {
      let response = await route.fetch();
      if (response.status() === 429) {
        await new Promise(resolve => setTimeout(resolve, 61_000));
        response = await route.fetch();
      }
      await route.fulfill({ response });
    });
    await use(context);
  },
  page: async ({ page }, use) => {
    await page.route('**/api/auth/me', async route => {
      const response = await route.fetch();
      if (!response.ok()) return route.fulfill({ response });
      await route.fulfill({ response, json: { ...(await response.json()), onboardingSeenAt: '2026-11-17T00:00:00Z' } });
    });
    await use(page);
  },
});
export { expect };
