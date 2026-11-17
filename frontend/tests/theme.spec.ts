import { test, expect } from './workspace-fixture';

test('login and overview fit narrow, landscape and enlarged text layouts', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('medflow.language', 'th'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'เข้าสู่พื้นที่ทำงาน' })).toBeVisible();
  await page.screenshot({ path: 'screenshots/calm-care-login.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'screenshots/calm-care-login-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'เข้าสู่พื้นที่ทำงาน' }).click();
  await expect(page.getByRole('heading', { name: 'ภาพรวมคลินิก' })).toBeVisible();
  for (const size of [{ width: 375, height: 812 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(size);
    await page.addStyleTag({ content: 'html { font-size: 125%; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'screenshots/calm-care-overview.png', fullPage: true });
});
