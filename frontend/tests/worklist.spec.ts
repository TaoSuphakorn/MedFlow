import { test, expect } from './workspace-fixture';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('medflow.language', 'en'));
});

test('nurse checks a patient in and the doctor runs the visit from the worklist', async ({ page }) => {
  const reason = `Synthetic walk-in ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Nurse', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const worklist = page.getByRole('region', { name: 'Today’s clinic queue' });
  await expect(worklist).toBeVisible();
  await worklist.getByRole('button', { name: 'Check in patient' }).click();
  const dialog = page.getByRole('dialog', { name: 'Check in patient' });
  await dialog.getByRole('combobox', { name: 'Patient' }).click();
  const option = page.getByRole('option').last();
  const name = (await option.textContent())!.split(' · ')[0].trim();
  await option.click();
  await dialog.getByLabel('Visit reason').fill(reason);
  await dialog.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`${name} checked in.`);
  const card = worklist.getByRole('listitem').filter({ hasText: reason });
  await expect(card).toContainText('Waiting');
  await page.getByRole('button', { name: 'Sign out' }).click();

  await page.getByRole('button', { name: 'Doctor', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Start exam' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(card).toContainText('In exam');
  await card.getByRole('button', { name: 'Complete visit' }).click();
  await expect(page.getByRole('status')).toContainText(`Visit completed for ${name}.`);
  await worklist.getByRole('button', { name: /^Completed/ }).click();
  await expect(card).toContainText('Completed');
  await expect(card.getByRole('button', { name: 'Start exam' })).toHaveCount(0);
});

test('administrator can read the worklist but cannot change visits', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Administrator', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const worklist = page.getByRole('region', { name: 'Today’s clinic queue' });
  await expect(worklist.getByRole('listitem').first()).toBeVisible();
  await expect(worklist.getByRole('button', { name: 'Check in patient' })).toHaveCount(0);
  await expect(worklist.getByRole('button', { name: 'Start exam' })).toHaveCount(0);
  await expect(worklist.getByRole('button', { name: /^Open record for / }).first()).toBeVisible();
});

test('worklist fits tablet portrait without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const worklist = page.getByRole('region', { name: 'Today’s clinic queue' });
  await expect(worklist.getByRole('listitem').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await worklist.getByRole('button', { name: /^Open record for / }).first().boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await worklist.screenshot({ path: 'screenshots/worklist-tablet.png' });
});
