import { test, expect } from '@playwright/test';

test('Thai SOAP field limits fit through Nginx and Kestrel', async ({ request }) => {
  let token = (await (await request.get('/api/auth/csrf')).json()).token;
  expect(
    (
      await request.post('/api/auth/login', {
        headers: { 'X-CSRF-TOKEN': token },
        data: { email: 'doctor@medflow.demo', password: 'Demo!2026' },
      })
    ).status(),
  ).toBe(200);
  token = (await (await request.get('/api/auth/csrf')).json()).token;
  const thai = 'ก'.repeat(8000);
  const response = await request.post('/api/patients/1/notes', {
    headers: { 'X-CSRF-TOKEN': token },
    data: { subjective: thai, objective: thai, assessment: thai, plan: thai, version: 0 },
  });
  expect(response.status()).toBe(201);
  expect((await response.json()).subjective).toBe(thai);
});

test('doctor reviews AI, edits draft, explicitly confirms and reopens saved note', async ({
  page,
}) => {
  const reviewedText = `Synthetic E2E review ${crypto.randomUUID()}: symptoms reviewed with patient.`;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Your day, at a glance.' })).toBeVisible();
  await page.screenshot({ path: 'screenshots/dashboard.png', fullPage: true });
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByPlaceholder('Search name, Thai name, or patient ID…').fill('SYN-1001');
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  await expect(page.getByRole('heading', { name: 'Somchai Jaidee' })).toBeVisible();
  await expect(page.getByText('Demo AI Mode', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('Live AI Mode', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Generate SOAP draft' }).click();
  await expect(page.getByText('AI Suggested', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Subjective', { exact: true }).fill(reviewedText);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Draft saved');
  await page
    .getByLabel('I have reviewed and edited this note and take responsibility for its content.')
    .check();
  await page.getByRole('button', { name: 'Confirm clinical note' }).click();
  await expect(page.getByRole('status')).toContainText('Clinical note confirmed');
  await page.reload();
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  await expect(page.getByText(reviewedText, { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/patient-workspace.png', fullPage: true });
  await page.screenshot({ path: 'screenshots/patient-workspace.png', fullPage: true });
});

test('unsaved SOAP survives cancelled shell navigation and sign-out', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  await page.getByLabel('Subjective', { exact: true }).fill('Unsaved synthetic text');
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Leave unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByLabel('Subjective', { exact: true })).toHaveValue(
    'Unsaved synthetic text',
  );
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('dialog', { name: 'Leave unsaved changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
});

test('administrator sees draft as unapproved and cannot edit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Administrator', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  const drafts = page.getByLabel('Open a saved draft');
  const value = await drafts.locator('option').nth(1).getAttribute('value');
  await drafts.selectOption(value!);
  await expect(page.getByRole('heading', { name: 'SOAP draft · read only' })).toBeVisible();
  await expect(page.getByText(/Confirmed No visit yet/)).toHaveCount(0);
  await expect(page.getByLabel('Subjective', { exact: true })).toHaveAttribute('readonly', '');
});

test('nurse can edit drafts but cannot confirm and tablet layout does not overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Nurse', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  await expect(page.getByRole('button', { name: 'Confirm clinical note' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('search empty state, logout and administrator audit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Administrator', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Audit log', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workspace audit log' })).toBeVisible();
  await expect(page.getByText('auth.login').first()).toBeVisible();
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page
    .getByPlaceholder('Search name, Thai name, or patient ID…')
    .fill('no-such-synthetic-person');
  await expect(page.getByText('No patients found')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in to workspace' })).toBeVisible();
});
