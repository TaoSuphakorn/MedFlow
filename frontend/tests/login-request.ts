import type { APIRequestContext, Page } from '@playwright/test';

export async function signIn(page: Page, label = 'Sign in to workspace') {
  async function submit() {
    const response = page.waitForResponse(result => result.url().endsWith('/api/auth/login') && result.request().method() === 'POST', { timeout: 75_000 });
    await page.getByRole('button', { name: label }).click();
    return response;
  }
  let response = await submit();
  if (response.status() === 429) {
    await new Promise(resolve => setTimeout(resolve, 61_000));
    response = await submit();
  }
  if (!response.ok()) throw new Error(`Demo sign-in returned ${response.status()}`);
}

// API-level account switching shares the same real login budget as browser tests.
export async function loginRequest(request: APIRequestContext, role: string, token: string) {
  const options = { headers: { 'X-CSRF-TOKEN': token }, data: { email: `${role}@medflow.demo`, password: 'Demo!2026' } };
  let response = await request.post('/api/auth/login', options);
  if (response.status() === 429) {
    await new Promise(resolve => setTimeout(resolve, 61_000));
    response = await request.post('/api/auth/login', options);
  }
  return response;
}
