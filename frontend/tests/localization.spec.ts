import { test, expect } from '@playwright/test';

test('save and confirmation notifications follow the active language', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'เข้าสู่พื้นที่ทำงาน' }).click();
  await page.getByRole('button', { name: 'ผู้ป่วย', exact: true }).click();
  await page.getByRole('button', { name: 'เปิด Somchai' }).click();
  for (const label of [
    'อาการและประวัติ (Subjective)',
    'ผลตรวจ (Objective)',
    'การประเมิน (Assessment)',
    'แผนการรักษา (Plan)',
  ]) {
    await page.getByLabel(label, { exact: true }).fill('Synthetic locale notification test');
  }
  await page.getByRole('button', { name: 'บันทึกฉบับร่าง', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('บันทึกฉบับร่างแล้ว');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Draft saved');
  await page
    .getByLabel('I have reviewed and edited this note and take responsibility for its content.')
    .check();
  await page.getByRole('button', { name: 'ภาษาไทย', exact: true }).click();
  await page.getByRole('button', { name: 'ยืนยันบันทึกการรักษา' }).click();
  await expect(page.getByRole('status')).toContainText('ยืนยันบันทึกการรักษาแล้ว');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Clinical note confirmed');
});

test('English dates follow the active locale when storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'medflow.language') throw new DOMException('Blocked', 'SecurityError');
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'medflow.language') throw new DOMException('Blocked', 'SecurityError');
      set.call(this, key, value);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: 'Open Somchai' }).click();
  await expect(page.locator('.record-heading').first()).toContainText('2026');
});

test('Thai and English UI switch, persist, and preserve clinical text', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ MedFlow' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await page.screenshot({ path: 'screenshots/login-th.png', fullPage: true });
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to MedFlow' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Clinical overview' })).toBeVisible();
  await page.getByRole('button', { name: 'ภาษาไทย', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ภาพรวมคลินิก' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ภาพรวมคลินิก' })).toBeVisible();
  await page.screenshot({ path: 'screenshots/dashboard-th.png', fullPage: true });
  await page.getByRole('button', { name: 'ผู้ป่วย', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'ทะเบียนผู้ป่วย', exact: true }).first(),
  ).toBeVisible();
  await page.getByPlaceholder('ค้นหาชื่อ ชื่อภาษาไทย หรือรหัสผู้ป่วย…').fill('สมชาย');
  await page.getByRole('button', { name: 'เปิด Somchai' }).click();
  await expect(page.getByRole('heading', { name: 'Somchai Jaidee' })).toBeVisible();
  const subjective = page.getByLabel('อาการและประวัติ (Subjective)', { exact: true });
  await subjective.fill('ข้อความทดสอบที่ยังไม่บันทึก');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByLabel('Subjective', { exact: true })).toHaveValue(
    'ข้อความทดสอบที่ยังไม่บันทึก',
  );
  await page.getByRole('button', { name: 'ภาษาไทย', exact: true }).click();
  await expect(subjective).toHaveValue('ข้อความทดสอบที่ยังไม่บันทึก');
  await page.screenshot({ path: 'screenshots/patient-workspace-th.png', fullPage: true });
});

test('Thai login validation and tablet localization remain readable', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');
  await page.getByLabel('อีเมล', { exact: true }).fill('invalid');
  await page.getByRole('button', { name: 'เข้าสู่พื้นที่ทำงาน' }).click();
  await expect(page.getByText('กรุณากรอกอีเมลให้ถูกต้อง')).toBeVisible();
  await page.getByLabel('อีเมล', { exact: true }).fill('doctor@medflow.demo');
  await page.getByRole('button', { name: 'เข้าสู่พื้นที่ทำงาน' }).click();
  await page.getByRole('button', { name: 'ผู้ป่วย', exact: true }).click();
  await page.getByRole('button', { name: 'เปิด Somchai' }).click();
  await expect(page.getByLabel('อาการและประวัติ (Subjective)', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'screenshots/patient-tablet-th.png', fullPage: true });
});
