import { test, expect } from '@playwright/test';

for (const { width, language } of [
  { width: 360, language: 'th' },
  { width: 390, language: 'en' },
  { width: 768, language: 'th' },
  { width: 1024, language: 'en' },
]) {
  test(`${width}px ${language}: patient actions and SOAP editor fit the screen`, async ({
    page,
  }) => {
    const th = language === 'th';
    await page.addInitScript((lang) => localStorage.setItem('medflow.language', lang), language);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page
      .getByRole('button', { name: th ? 'เข้าสู่พื้นที่ทำงาน' : 'Sign in to workspace' })
      .click();
    await expect(
      page.getByRole('heading', { name: th ? 'ภาพรวมคลินิก' : 'Clinical overview' }),
    ).toBeVisible();
    const menu = page.getByRole('button', { name: th ? 'เปิดเมนู' : 'Open navigation' });
    if (width <= 800) {
      await expect(
        page.getByRole('button', { name: th ? 'ผู้ป่วย' : 'Patients', exact: true }),
      ).toHaveCount(0);
      await menu.click();
      await expect(
        page.getByRole('dialog', { name: th ? 'เมนูหลัก' : 'Main navigation' }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeFocused();
      await menu.click();
    }
    await page.getByRole('button', { name: th ? 'ผู้ป่วย' : 'Patients', exact: true }).click();
    if (width <= 800) await expect(page.locator('#workspace-navigation')).not.toBeInViewport();
    const open = page.getByRole('button', { name: th ? 'เปิด Somchai' : 'Open Somchai' });
    const box = await open.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    if (width === 360) await page.screenshot({ path: 'screenshots/patients-mobile-th.png' });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await open.click();
    const editor = page.locator('.workspace-primary');
    if (width <= 800) {
      const ai = page.locator('.workspace-assistant');
      expect((await editor.boundingBox())!.y).toBeLessThan((await ai.boundingBox())!.y);
    }
    await page
      .getByLabel(th ? 'อาการและประวัติ (Subjective)' : 'Subjective', { exact: true })
      .fill('Synthetic responsive draft');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `screenshots/responsive-${width}-${language}.png`,
      fullPage: true,
    });
  });
}
