import { test, expect } from '@playwright/test';
import { loginHotelPms } from './auth';

test.describe('Guest CRM ElectraWeb', () => {
  test.beforeEach(async ({ page }) => {
    await loginHotelPms(page);
  });

  test('CRM tab shows enabled action links', async ({ page }) => {
    await page.goto('/in-house');
    await page.locator('table tbody button').first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await dialog.getByText(/crm|crm/i).first().click();
    await expect(dialog.getByRole('link', { name: /tasks|tapşırıq|задач/i }).first()).toBeVisible();
    await expect(dialog.getByRole('link', { name: /notes|qeyd|заметк/i }).first()).toBeVisible();
  });

  test('reservations grid accepts guestId query', async ({ request }) => {
    const guests = await request.get('/api/guests');
    expect(guests.ok()).toBeTruthy();
    const list = await guests.json();
    const guestId = Array.isArray(list) && list[0]?.id ? list[0].id : null;
    test.skip(!guestId, 'no guests in DB');
    const res = await request.get(`/api/reports/reservations-grid?guestId=${guestId}`);
    expect(res.ok()).toBeTruthy();
    const rows = await res.json();
    expect(Array.isArray(rows)).toBeTruthy();
  });
});
