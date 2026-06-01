import { test, expect } from '@playwright/test';
import { loginHotelPms } from './auth';

test.describe('Hotel PMS smoke', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('authenticated shell shows core nav after login', async ({ page }) => {
    await loginHotelPms(page);
    await expect(page.locator('#era-app-sidebar, aside')).toBeVisible({ timeout: 20000 });
  });
});
