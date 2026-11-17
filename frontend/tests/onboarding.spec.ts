import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('medflow.language', 'en'));
  // Model an account that has not seen the guide; auth and writes remain real.
  await page.route('**/api/auth/me', async (route) => {
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    await route.fulfill({ response, json: { ...(await response.json()), onboardingSeenAt: null } });
  });
});

test('first login completes the guide and remembers it on a new browser session', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const tour = page.getByRole('dialog', { name: 'Welcome to your workspace' });
  await expect(tour).toBeVisible();
  await page.screenshot({ path: 'screenshots/onboarding-desktop.png' });
  await tour.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(tour.getByRole('heading', { name: 'Find a patient' })).toBeVisible();
  await tour.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(tour.getByText('Step 1 of 4')).toBeVisible();
  for (let i = 0; i < 3; i++) await tour.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(tour.getByText('Only doctors can confirm a reviewed note. AI never approves it for you.')).toBeVisible();
  await tour.getByRole('button', { name: 'Start using MedFlow' }).click();
  await expect(tour).toHaveCount(0);
  await expect(page.getByRole('main')).toBeFocused();
  const fresh = await browser.newContext();
  const next = await fresh.newPage();
  await next.addInitScript(() => localStorage.setItem('medflow.language', 'en'));
  await next.goto('/');
  await next.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(next.getByRole('heading', { name: 'Clinical overview' })).toBeVisible();
  await expect(next.getByRole('dialog')).toHaveCount(0);
  await fresh.close();
});

test('mobile Thai guide skips and replays from Help without changing records', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const tour = page.getByRole('dialog', { name: 'Welcome to your workspace' });
  await expect(tour).toBeVisible();
  await tour.getByRole('button', { name: 'ภาษาไทย', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ยินดีต้อนรับสู่พื้นที่ทำงาน' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'ข้ามบทสอน' })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: 'screenshots/onboarding-mobile-th.png' });
  await page.getByRole('button', { name: 'ข้ามบทสอน' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'เปิดเมนู' }).click();
  await page.getByRole('button', { name: 'วิธีใช้งานและคู่มือสาธิต' }).click();
  await page.getByRole('button', { name: 'เริ่มบทสอนอีกครั้ง' }).click();
  await expect(page.getByRole('heading', { name: 'ยินดีต้อนรับสู่พื้นที่ทำงาน' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'เปิดเมนู' })).toBeFocused();
});

test('failed dismissal stays open and can be retried', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const tour = page.getByRole('dialog', { name: 'Welcome to your workspace' });
  await expect(tour).toBeVisible();
  await page.route('**/api/auth/onboarding', route => route.fulfill({ status: 503, json: { error: 'Something went wrong. Please try again.' } }));
  await tour.getByRole('button', { name: 'Skip guide' }).click();
  await expect(tour.getByRole('alert')).toBeVisible();
  await expect(tour).toBeVisible();
  await page.unroute('**/api/auth/onboarding');
  await tour.getByRole('button', { name: 'Skip guide' }).click();
  await expect(tour).toHaveCount(0);
});

for (const role of ['Nurse', 'Administrator']) {
  test(`${role} guide explains the account permissions`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: role, exact: true }).click();
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();
    const tour = page.getByRole('dialog', { name: 'Welcome to your workspace' });
    for (let i = 0; i < 3; i++) await tour.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(tour.getByText(role === 'Nurse'
      ? 'You can write and save drafts. A doctor must review and confirm them.'
      : 'You can inspect records and the audit log. You cannot write or confirm clinical notes.')).toBeVisible();
    await tour.getByRole('button', { name: 'Start using MedFlow' }).click();
    await expect(tour).toHaveCount(0);
  });
}

test('replaying the guide preserves an unsaved SOAP draft', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Skip guide' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  const subject = page.getByLabel('Subjective', { exact: true });
  await subject.fill('Unsaved synthetic draft retained during the guide');
  await page.getByRole('button', { name: 'Help & demo guide' }).click();
  await page.getByRole('button', { name: 'Restart walkthrough' }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome to your workspace' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(subject).toHaveValue('Unsaved synthetic draft retained during the guide');
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Help & demo guide' })).toBeFocused();
});

test('expired session during dismissal returns to login', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome to your workspace' })).toBeVisible();
  await page.route('**/api/auth/onboarding', route => route.fulfill({ status: 401, json: {} }));
  await page.getByRole('button', { name: 'Skip guide' }).click();
  await expect(page.getByRole('button', { name: 'Sign in to workspace' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
