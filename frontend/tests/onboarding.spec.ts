import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('medflow.language', 'en'));
  await page.route('**/api/auth/me', async route => {
    const response = await route.fetch();
    if (!response.ok()) return route.fulfill({ response });
    await route.fulfill({ response, json: { ...(await response.json()), onboardingSeenAt: null } });
  });
});

test('teaches real navigation and search then remembers completion', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const guide = page.getByRole('dialog', { name: 'Interactive tutorial' });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'screenshots/onboarding-desktop.png' });
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await expect(guide.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.getByPlaceholder('Search name, Thai name, or patient ID…').fill('NO_MATCH_123');
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await guide.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByPlaceholder('Search name, Thai name, or patient ID…').fill('Somchai');
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  await expect(guide.getByRole('heading', { name: 'Review patient history' })).toBeVisible();
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await guide.getByRole('button', { name: 'Start using MedFlow' }).click();
  await expect(guide).toHaveCount(0);
  await expect(page.getByRole('main')).toBeFocused();
  const context = await browser.newContext();
  const next = await context.newPage();
  await next.addInitScript(() => localStorage.setItem('medflow.language', 'en'));
  await next.goto('/');
  await next.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(next.getByRole('heading', { name: 'Clinical overview' })).toBeVisible();
  await expect(next.getByRole('dialog')).toHaveCount(0);
  await context.close();
});

test('phone Thai tutorial uses the drawer and keeps its tooltip in view', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('dialog', { name: 'Interactive tutorial' }).getByRole('button', { name: 'ภาษาไทย' }).click();
  await page.getByRole('button', { name: 'เปิดเมนู' }).click();
  await page.getByRole('button', { name: 'ผู้ป่วย', exact: true }).click();
  await expect(page.locator('#workspace-navigation')).not.toBeInViewport();
  await page.getByPlaceholder('ค้นหาชื่อ ชื่อภาษาไทย หรือรหัสผู้ป่วย…').fill('สมชาย');
  await expect(page.getByRole('button', { name: 'ถัดไป', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'ถัดไป', exact: true }).evaluate(async el => {
    await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
  await expect(page.getByRole('dialog', { name: 'ระบบสอนใช้งาน' })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: 'screenshots/onboarding-mobile-th.png' });
  await page.getByRole('button', { name: 'ข้ามบทสอน' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('replay from visit history guides back to the actual SOAP field', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Skip guide' }).click();
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  await page.getByRole('button', { name: /Visit history/ }).click();
  await page.getByRole('button', { name: 'Help & demo guide' }).click();
  await page.getByRole('button', { name: 'Restart walkthrough' }).click();
  await page.getByRole('dialog', { name: 'Interactive tutorial' }).getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Clinical documentation', exact: true }).click();
  await page.getByRole('button', { name: 'Start using MedFlow' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('tutorial stays inside a visual viewport reduced by a phone keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByPlaceholder('Search name, Thai name, or patient ID…').fill('Somchai');
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 350 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => {
    const box = await page.getByRole('dialog', { name: 'Interactive tutorial' }).boundingBox();
    return box!.y + box!.height;
  }).toBeLessThanOrEqual(350);
  await page.getByRole('dialog', { name: 'Interactive tutorial' }).getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Skip guide' }).click();
});

test('failed dismissal retries and expired sessions return to login', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.route('**/api/auth/onboarding', route => route.fulfill({ status: 503, json: {} }));
  await page.getByRole('button', { name: 'Skip guide' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/auth/onboarding');
  await page.route('**/api/auth/onboarding', route => route.fulfill({ status: 401, json: {} }));
  await page.getByRole('button', { name: 'Skip guide' }).click();
  await expect(page.getByRole('button', { name: 'Sign in to workspace' })).toBeVisible();
});

for (const role of ['Doctor', 'Nurse', 'Administrator']) test(`${role} replay preserves current patient and unsaved text`, async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: role, exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Skip guide' }).click();
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  if (role !== 'Administrator') await page.getByLabel('Subjective', { exact: true }).fill('Unsaved synthetic tutorial text');
  await page.getByRole('button', { name: 'Help & demo guide' }).click();
  await page.getByRole('button', { name: 'Restart walkthrough' }).click();
  const guide = page.getByRole('dialog', { name: 'Interactive tutorial' });
  await expect(guide.getByRole('heading', { name: 'Review patient history' })).toBeVisible();
  await guide.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(guide.getByText(role === 'Doctor' ? 'Only doctors can confirm a reviewed note. AI never approves it for you.'
    : role === 'Nurse' ? 'You can write and save drafts. A doctor must review and confirm them.'
    : 'You can inspect records and the audit log. You cannot write or confirm clinical notes.')).toBeVisible();
  if (role !== 'Administrator') await expect(page.getByLabel('Subjective', { exact: true })).not.toBeFocused();
  await page.keyboard.press('Escape');
  await expect(guide).toHaveCount(0);
  if (role !== 'Administrator') await expect(page.getByLabel('Subjective', { exact: true })).toHaveValue('Unsaved synthetic tutorial text');
  await expect(page.getByRole('button', { name: 'Help & demo guide' })).toBeFocused();
});
