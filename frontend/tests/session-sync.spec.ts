import { test, expect } from './workspace-fixture';

test('focus detects account changes when cross-tab broadcasting is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('medflow.language', 'en');
    Object.defineProperty(window, 'BroadcastChannel', { value: undefined });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Administrator', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Audit log', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workspace audit log' })).toBeVisible();
  const token = (await (await page.request.get('/api/auth/csrf')).json()).token;
  const changed = await page.request.post('/api/auth/login', {
    headers: { 'X-CSRF-TOKEN': token },
    data: { email: 'nurse@medflow.demo', password: 'Demo!2026' },
  });
  expect(changed.status()).toBe(200);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Clinical overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Audit log', exact: true })).toHaveCount(0);
  await expect(page.getByText('Nurse Mali Wong', { exact: true })).toBeVisible();
});

test('workspace clears administrator data when Swagger changes the account', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => localStorage.setItem('medflow.language', 'en'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Administrator', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Audit log', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workspace audit log' })).toBeVisible();
  const docs = await context.newPage();
  await docs.goto('/swagger/');
  await docs.getByLabel('Demo role', { exact: true }).selectOption('nurse');
  await docs.getByRole('button', { name: 'Sign in to API' }).click();
  await expect(docs.getByRole('status')).toContainText('Nurse');
  await page.bringToFront();
  await expect(page.getByRole('heading', { name: 'Clinical overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Audit log', exact: true })).toHaveCount(0);
  await expect(page.getByText('Workspace Administrator', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  for (const label of ['Subjective', 'Objective', 'Assessment', 'Plan'])
    await page.getByLabel(label, { exact: true }).fill('Synthetic session handoff');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Draft saved');
  await docs.getByRole('button', { name: 'Sign out of API' }).click();
  await page.bringToFront();
  await expect(page.getByRole('button', { name: 'Sign in to workspace' })).toBeVisible();
});

test('Swagger session status follows login and logout through Try it out', async ({ page }) => {
  await page.goto('/swagger/');
  const login = page.locator('#operations-Authentication-SignIn');
  await login.locator('.opblock-summary-control').click();
  await login.getByRole('button', { name: 'Try it out' }).click();
  await login
    .locator('textarea')
    .fill(JSON.stringify({ email: 'nurse@medflow.demo', password: 'Demo!2026' }));
  await login.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Nurse');
  const logout = page.locator('#operations-Authentication-SignOut');
  await logout.locator('.opblock-summary-control').click();
  await logout.getByRole('button', { name: 'Try it out' }).click();
  await logout.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Not signed in');
});

test('focus reconciliation preserves unsaved SOAP for the same account', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('medflow.language', 'en'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  await page.getByLabel('Subjective', { exact: true }).fill('Unsaved same-user draft');
  const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/me');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await response;
  await expect(page.getByLabel('Subjective', { exact: true })).toHaveValue(
    'Unsaved same-user draft',
  );
});
