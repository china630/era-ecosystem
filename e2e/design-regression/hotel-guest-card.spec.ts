import { test, expect } from '@playwright/test';
import { loginHotelPms } from './auth/helpers';

test.describe('Hotel guest card visual', () => {
  test.beforeEach(async ({ page }) => {
    await loginHotelPms(page);
  });

  test('guest card dialog', async ({ page }) => {
    await page.goto('/in-house');
    await expect(page.locator('table tbody button').first()).toBeVisible({ timeout: 20000 });
    await page.locator('table tbody button').first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByText(/identity|şəxsiyyət|контакт/i).first()).toBeVisible();
    await expect(dialog).toHaveScreenshot('hotel-guest-card.png', {
      mask: [dialog.locator('.font-mono'), dialog.locator('h2'), dialog.locator('[class*="font-semibold"]').first()],
    });
  });
});
