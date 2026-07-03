import { test, expect } from '@playwright/test';
import { loginClinic } from './auth/helpers';

test.describe('Clinic appointment create visual', () => {
  test.beforeEach(async ({ page }) => {
    await loginClinic(page);
  });

  test('appointment create modal', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/appointments');
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/appointments') && resp.ok(),
      { timeout: 30_000 },
    );
    await expect(page.getByRole('heading', { level: 1, name: /appointments|qəbullar|приёмы/i })).toBeVisible({ timeout: 20_000 });
    const createBtn = page.getByRole('button', { name: /new appointment|yeni qəbul|новый приём/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    const dialog = page.locator('[role="dialog"][aria-modal="true"]').first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.locator('#era-modal-title')).toHaveText(/new appointment|yeni qəbul|новый приём/i);
    await page.waitForResponse(
      (resp) => resp.url().includes('/api/admin/practitioners') && resp.ok(),
      { timeout: 15_000 },
    );
    await expect(dialog).toHaveScreenshot('clinic-appointment-create.png', {
      mask: [dialog.locator('input[type="datetime-local"]')],
      timeout: 15_000,
    });
  });
});
