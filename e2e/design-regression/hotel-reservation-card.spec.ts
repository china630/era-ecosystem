import { test, expect } from '@playwright/test';
import { loginHotelPms } from './auth/helpers';

test.describe('Hotel reservation card visual', () => {
  test.beforeEach(async ({ page }) => {
    await loginHotelPms(page);
  });

  test('create dialog layout', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new booking|yeni|новая/i }).first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByRole('button', { name: /^Stay$|^Qalma$|^Проживание$/i })).toBeVisible();
    await expect(dialog).toHaveScreenshot('hotel-reservation-create.png', {
      mask: [dialog.locator('.font-mono'), dialog.getByText(/\d{4}-\d{2}-\d{2}/)],
    });
  });

  test('edit dialog layout', async ({ page }) => {
    await page.goto('/reports/reservations');
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 });
    await page.locator('table tbody button.font-mono').first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByRole('button', { name: /^Stay$|^Qalma$|^Проживание$/i })).toBeVisible();
    await expect(dialog).toHaveScreenshot('hotel-reservation-edit.png', {
      mask: [dialog.locator('.font-mono'), dialog.locator('button.font-mono')],
    });
  });
});
