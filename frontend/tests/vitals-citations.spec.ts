import type { Page } from '@playwright/test';
import { test, expect } from './workspace-fixture';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('medflow.language', 'en'));
});

async function openPatient(page: Page, first: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: `Open ${first}` }).click();
}

test('AI summary sentences link to their source visits and flag unsupported text', async ({ page }) => {
  await openPatient(page, 'Suda');
  await page.getByRole('button', { name: 'Summarize patient records' }).click();
  await expect(page.getByRole('status')).toContainText('AI summary ready');
  const summary = page.locator('.cited-summary');
  await expect(summary.getByText('No source visit. Verify against the patient profile.')).toBeVisible();
  const citation = summary.getByRole('button', { name: /^Show source visit / }).last();
  const label = (await citation.textContent())!.trim();
  await citation.click();
  await expect(page.getByRole('button', { name: /Visit history/ })).toHaveClass(/selected/);
  const source = page.locator('article.record[aria-current="true"]');
  await expect(source).toHaveCount(1);
  await expect(source).toContainText(label);
  await expect(source.getByRole('button').first()).toHaveAttribute('aria-expanded', 'true');
  await expect(source.getByRole('button').first()).toBeFocused();
});

test('vital signs show alerts, trends, a table view and validate new readings', async ({ page }) => {
  await openPatient(page, 'Malee');
  await page.getByRole('button', { name: 'Vital signs', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Vital signs' });
  await expect(panel.getByText('Systolic BP')).toBeVisible();
  await expect(panel.getByRole('img', { name: /^Blood pressure trend/ })).toBeVisible();
  await panel.getByRole('button', { name: 'Show table' }).click();
  await expect(panel.getByRole('table')).toBeVisible();
  await panel.getByRole('button', { name: 'Show charts' }).click();

  const fill = async (values: Record<string, string>) => {
    await panel.getByRole('button', { name: 'Record vital signs' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record vital signs' });
    for (const [label, value] of Object.entries(values)) await dialog.getByLabel(label).fill(value);
    await dialog.getByRole('button', { name: 'Save vital signs' }).click();
    return dialog;
  };
  const normal = { 'Systolic BP': '120', 'Diastolic BP': '78', Pulse: '72', Temperature: '36.8', 'Respiratory rate': '16', 'SpO₂': '98' };

  const invalid = await fill({ ...normal, 'Diastolic BP': '130' });
  await expect(invalid.getByRole('alert')).toContainText('outside the possible range');
  await invalid.getByRole('button', { name: 'Cancel' }).click();

  await fill(normal);
  await expect(page.getByRole('status')).toContainText('All values are within the normal range.');
  await expect(panel.locator('.vitals-alert')).toHaveCount(0);

  await fill({ ...normal, 'SpO₂': '88', Pulse: '134' });
  await expect(page.getByRole('status')).toContainText('Vital signs saved with 2 alerts');
  await expect(panel.locator('.vitals-alert')).toContainText('2 critical alerts in the latest reading');
  await expect(panel.locator('.vital-tile.is-critical')).toHaveCount(2);
  await expect(panel.locator('.vital-tile.is-critical').first()).toContainText('Critically');
  await page.screenshot({ path: 'screenshots/vitals.png', fullPage: true });
});
