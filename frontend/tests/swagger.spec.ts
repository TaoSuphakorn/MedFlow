import { test, expect } from '@playwright/test';

test('Swagger through Nginx supports normal login and CSRF-protected Try it out', async ({
  page,
  request,
}) => {
  const document = await request.get('/swagger/v1/swagger.json');
  expect(document.status()).toBe(200);
  expect((await document.json()).info.title).toBe('MedFlow AI API');
  const health = await request.get('/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: 'healthy' });
  await page.goto('/swagger/');
  const uiResponse = await request.get('/swagger/index.html');
  expect(uiResponse.headers()['content-security-policy']).toContain("script-src 'self';");
  expect(uiResponse.headers()['content-security-policy']).not.toContain('unsafe-eval');
  await expect(page.getByRole('heading', { name: 'Demo API session', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in to API' }).click();
  await expect(page.getByRole('status')).toContainText('Doctor');
  const patients = page.locator('#operations-Patients-ListPatients');
  await patients.locator('.opblock-summary-control').click();
  await patients.getByRole('button', { name: 'Try it out' }).click();
  const [list] = await Promise.all([
    page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/patients' && r.request().method() === 'GET',
    ),
    patients.getByRole('button', { name: 'Execute', exact: true }).click(),
  ]);
  expect(list.status()).toBe(200);
  expect((await list.json()).length).toBeGreaterThanOrEqual(15);
  const create = page.locator('#operations-Clinical_notes-CreateSoapDraft');
  await create.locator('.opblock-summary-control').click();
  await create.getByRole('button', { name: 'Try it out' }).click();
  await create.getByPlaceholder('id', { exact: true }).fill('1');
  await create.locator('textarea').fill(
    JSON.stringify({
      subjective: 'Synthetic Swagger draft',
      objective: 'Synthetic observations',
      assessment: 'Clinician review required',
      plan: 'Review required',
      version: 0,
    }),
  );
  const [saved] = await Promise.all([
    page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/patients/1/notes' && r.request().method() === 'POST',
    ),
    create.getByRole('button', { name: 'Execute', exact: true }).click(),
  ]);
  expect(saved.status()).toBe(201);
  expect((await saved.json()).status).toBe('Draft');
  await page.getByRole('button', { name: 'Sign out of API' }).click();
  await expect(page.getByRole('status')).toContainText('Not signed in');
  await patients.locator('.opblock-summary-control').click();
  await create.locator('.opblock-summary-control').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/swagger.png', fullPage: true });
});

test('Swagger remains available directly on the backend service', async ({ request }) => {
  const response = await request.get('http://backend:8080/swagger/v1/swagger.json');
  expect(response.status()).toBe(200);
  expect((await response.json()).info.title).toBe('MedFlow AI API');
});

test('Swagger session controls fit a 360px phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/swagger/');
  await expect(page.getByRole('heading', { name: 'Demo API session', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Sign in to API' }).click();
  await expect(page.getByRole('status')).toContainText('Doctor');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'screenshots/swagger-mobile.png' });
});
