import { test, expect } from '@playwright/test';
import { loginHotelPms } from './auth/helpers';

test('hotel reservation create has field system sections', async ({ page }) => {
  await loginHotelPms(page);
  await page.goto('/');
  await page.getByRole('button', { name: /new booking|yeni|новая/i }).first().click();
  const dialog = page.getByRole('dialog').first();
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByRole('button', { name: /^Stay$|^Qalma$|^Проживание$/i })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^Commercial$|^Kommersial$|^Коммерция$/i })).toBeVisible();
  await expect(dialog.locator('[data-testid="field-row"]').first()).toBeVisible();
});
