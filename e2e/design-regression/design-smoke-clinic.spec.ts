import { test, expect } from '@playwright/test';
import { loginClinic } from './auth/helpers';

test('clinic appointment modal opens', async ({ page }) => {
  await loginClinic(page);
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
});
