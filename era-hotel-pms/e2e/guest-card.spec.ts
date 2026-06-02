import { test, expect } from '@playwright/test';
import { loginHotelPms } from './auth';

test.describe('Guest card D2', () => {
  test.beforeEach(async ({ page }) => {
    await loginHotelPms(page);
  });

  test('in-house opens guest card with tabs', async ({ page }) => {
    await page.goto('/in-house');
    const guestLink = page.locator('table tbody button').first();
    await expect(guestLink).toBeVisible({ timeout: 20000 });
    await guestLink.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByText(/identity|şəxsiyyət|контакт/i).first()).toBeVisible();
    await expect(dialog.getByText(/loyalty|loyallıq|лояльность/i).first()).toBeVisible();
  });

  test('ID reader modal and loyalty points tab', async ({ page }) => {
    await page.goto('/in-house');
    await page.locator('table tbody button').first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await dialog.getByRole('button', { name: /id reader|şəxsiyyət|сканер/i }).first().click();
    await expect(page.getByRole('dialog').nth(1)).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await dialog.getByText(/loyalty|loyallıq|лояльность/i).first().click();
    await expect(dialog.getByText(/points history|xallar|баллов/i).first()).toBeVisible();
  });

  test('time-share sub-tabs', async ({ page }) => {
    await page.goto('/in-house');
    await page.locator('table tbody button').first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await dialog.getByText(/time share|timeshare|taím/i).first().click();
    await expect(dialog.getByText(/quotation|təklif|котировка/i).first()).toBeVisible();
  });

  test('group page opens reservation card from row', async ({ page }) => {
    await page.goto('/reports/group-reservations');
    await expect(page.getByText(/GRP-NAFTA|NAFTA|SOCAR/i).first()).toBeVisible({ timeout: 20000 });
    const resBtn = page.locator('button.font-mono').first();
    if (await resBtn.isVisible()) {
      await resBtn.click();
      await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 15000 });
    }
  });
});
