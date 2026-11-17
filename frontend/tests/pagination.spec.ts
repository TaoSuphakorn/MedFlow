import { test, expect } from './workspace-fixture';
import { signIn } from './login-request';

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('medflow.language', 'en'));
  await page.goto('/');
  if (testInfo.title.startsWith('audit')) await page.getByRole('button', { name: 'Administrator', exact: true }).click();
  await signIn(page);
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
});

test('patient paging filters all records and resets when criteria or page size change', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Open Thanakorn' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
  await page.getByPlaceholder('Search name, Thai name, or patient ID…').fill('Somchai');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open Somchai' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.getByRole('combobox', { name: 'Rows per page' }).click();
  await page.getByRole('option', { name: '5', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('button', { name: 'Page 3', exact: true }).click();
  await page.getByRole('combobox', { name: 'Filter patients' }).click();
  await page.getByRole('option', { name: 'Follow-up', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Page 1', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('combobox', { name: 'Filter patients' }).click();
  await page.screenshot({ path: 'screenshots/dropdown-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox', { name: 'Filter patients' })).toBeFocused();
  await page.getByRole('navigation', { name: 'Pagination' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'screenshots/paging-desktop.png', fullPage: true });
});

test('saved draft dropdown preserves the unsaved-edit confirmation', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  await page.getByLabel('Subjective', { exact: true }).fill('Synthetic unsaved dropdown check');
  await page.getByRole('combobox', { name: 'Open a saved draft' }).click();
  await page.getByRole('option').first().click();
  await expect(page.getByRole('dialog', { name: 'Leave unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Subjective', { exact: true })).toHaveValue('Synthetic unsaved dropdown check');
  await page.getByRole('combobox', { name: 'Open a saved draft' }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Discard unsaved edits', exact: true }).click();
  await expect(page.getByLabel('Subjective', { exact: true })).not.toHaveValue('Synthetic unsaved dropdown check');
});

test('returning from a patient preserves page size, filter and page', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Rows per page' }).click();
  await page.getByRole('option', { name: '5', exact: true }).click();
  await page.getByRole('combobox', { name: 'Filter patients' }).click();
  await page.getByRole('option', { name: 'Follow-up', exact: true }).click();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  const open = page.getByRole('button', { name: /^Open / }).first();
  const label = await open.getAttribute('aria-label');
  await open.click();
  await page.getByRole('button', { name: 'Back to patients' }).click();
  await expect(page.getByRole('combobox', { name: 'Rows per page' })).toContainText('5');
  await expect(page.getByRole('combobox', { name: 'Filter patients' })).toContainText('Follow-up');
  await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: label!, exact: true })).toBeVisible();
});

test('open draft menu closes while session verification is pending or failed', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  await page.getByLabel('Subjective', { exact: true }).fill('Synthetic text survives a failed session check');
  await page.getByRole('combobox', { name: 'Open a saved draft' }).click();
  await expect(page.getByRole('option').first()).toBeVisible();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const failedSession = async (route: import('@playwright/test').Route) => {
    await pending;
    await route.fulfill({ status: 503, json: {} });
  };
  await page.route('**/api/auth/me', failedSession);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  try { await expect(page.getByRole('listbox')).toHaveCount(0); }
  finally { release(); }
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.unroute('**/api/auth/me', failedSession);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByLabel('Subjective', { exact: true })).toHaveValue('Synthetic text survives a failed session check');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('audit table pages the loaded event list', async ({ page }) => {
  for (let index = 0; index < 12; index++) expect((await page.request.get('/api/patients/1')).ok()).toBe(true);
  await page.getByRole('button', { name: 'Audit log', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(await page.locator('tbody tr').count()).toBeGreaterThan(0);
  expect(await page.locator('tbody tr').count()).toBeLessThanOrEqual(10);
});

test('phone dropdown supports keyboard selection and pagination stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const filter = page.getByRole('combobox', { name: 'Filter patients' });
  await filter.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('option', { name: 'All patients', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('option', { name: 'Routine check', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(filter).toContainText('Routine check');
  await filter.click();
  await expect(page.getByRole('listbox')).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: 'screenshots/dropdown-mobile.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: 'Pagination' }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
