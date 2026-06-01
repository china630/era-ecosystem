import { test, expect } from '@playwright/test';
import { loginHotelPms } from './auth';

test.describe('Demo FO dataset UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginHotelPms(page);
  });

  test('executive dashboard shows KPI cards', async ({ page }) => {
    await page.goto('/executive');
    await expect(page.getByText(/occupancy|doluluq|загрузка/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('room rack lists occupied rooms', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('101').first()).toBeVisible({ timeout: 20000 });
  });

  test('reservation list has rows and notes filter', async ({ page }) => {
    await page.goto('/reports/reservations');
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 });
    await page.goto('/reports/reservations?hasNotes=1');
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 });
  });

  test('in-house list opens guest card', async ({ page }) => {
    await page.goto('/in-house');
    const guestLink = page.locator('table tbody button').first();
    await expect(guestLink).toBeVisible({ timeout: 20000 });
    await guestLink.click();
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 15000 });
  });

  test('guest registry add opens guest card shell', async ({ page }) => {
    await page.goto('/guests');
    const addBtn = page.getByRole('button', { name: /add|əlavə|добавить|new guest/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 20000 });
    await addBtn.click();
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 15000 });
  });

  test('room plan shows reservation bars', async ({ page }) => {
    await page.goto('/room-plan');
    await expect(page.getByText(/101|201|STWN|DLX/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('group reservations list', async ({ page }) => {
    await page.goto('/reports/group-reservations');
    await expect(page.getByText(/GRP-NAFTA|NAFTA|SOCAR/i).first()).toBeVisible({ timeout: 20000 });
  });
});

test.describe('Demo FO dataset API', () => {
  test('seed counts via authenticated APIs', async ({ request }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { login: 'admin', password: 'admin123' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const guests = await request.get('/api/guests?limit=50');
    expect(guests.ok()).toBeTruthy();
    const guestList = await guests.json();
    expect(Array.isArray(guestList)).toBeTruthy();
    expect(guestList.length).toBeGreaterThanOrEqual(20);

    const res = await request.get('/api/reservations');
    expect(res.ok()).toBeTruthy();
    const resList = await res.json();
    expect(Array.isArray(resList)).toBeTruthy();
    expect(resList.length).toBeGreaterThanOrEqual(25);
  });
});
