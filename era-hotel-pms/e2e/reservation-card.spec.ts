import { test, expect } from '@playwright/test';
import { loginHotelPms } from './auth';

test.describe('Reservation card FO parity', () => {
  test.beforeEach(async ({ page }) => {
    await loginHotelPms(page);
  });

  test('rack filters: agency and pay status', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('101').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByLabel(/agency|agentlik|агентство/i).first()).toBeVisible();
    await expect(page.getByLabel(/payment status|ödəniş|оплат/i).first()).toBeVisible();
  });

  test('open reservation card from list and see tabs', async ({ page }) => {
    await page.goto('/reports/reservations');
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 });
    const idBtn = page.locator('table tbody button.font-mono').first();
    await idBtn.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByText(/guests|qonaqlar|гости/i).first()).toBeVisible();
    await expect(dialog.getByText(/pricing|qiymət|цены/i).first()).toBeVisible();
    await expect(dialog.getByText(/folio/i).first()).toBeVisible();
  });

  test('new booking opens create reservation card', async ({ page }) => {
    await page.goto('/');
    const newBtn = page.getByRole('button', { name: /new booking|yeni|новая/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 20000 });
    await newBtn.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByText(/new reservation|yeni rezerv|новая/i).first()).toBeVisible();
  });
});

test.describe('Reservation full API', () => {
  test('PATCH schema fields via authenticated API', async ({ request }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { login: 'admin', password: 'admin123' },
    });
    expect(loginRes.ok()).toBeTruthy();

    const listRes = await request.get('/api/reservations');
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    expect(Array.isArray(list)).toBeTruthy();
    const id = list[0]?.id as string | undefined;
    expect(id).toBeTruthy();

    const patchRes = await request.patch(`/api/reservations/${id}/full`, {
      data: {
        booker: 'E2E Booker',
        guestRep: 'E2E Rep',
        rateType: 'BAR',
      },
    });
    expect(patchRes.ok()).toBeTruthy();
    const body = await patchRes.json();
    expect(body.booker).toBe('E2E Booker');
    expect(body.guestRep).toBe('E2E Rep');
    expect(body.rateType).toBe('BAR');

    const waveERes = await request.patch(`/api/reservations/${id}/full`, {
      data: {
        preferredLocation: 'Sea view',
        contractRef: 'CTR-E2E',
        dailyRates: [],
      },
    });
    expect(waveERes.ok()).toBeTruthy();
    const waveEBody = await waveERes.json();
    expect(waveEBody.preferredLocation).toBe('Sea view');
    expect(waveEBody.contractRef).toBe('CTR-E2E');
  });

  test('reservation card: pricing columns and folio first person tab', async ({ page }) => {
    await page.goto('/reports/reservations');
    await page.locator('table tbody button.font-mono').first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await dialog.getByText(/pricing|qiymət|цены/i).first().click();
    await expect(dialog.getByText(/currency|valyuta|валюта/i).first()).toBeVisible();
    await dialog.getByText(/folio/i).first().click();
    await dialog.getByText(/1st|1-ci|1-е/i).first().click();
  });
});
