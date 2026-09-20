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
    await expect(page.getByText(/inspected only|yalnız yoxlan|только проверен/i).first()).toBeVisible();
    await expect(page.getByText(/out of order|yalnız ooo|только ooo/i).first()).toBeVisible();
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
    await expect(dialog.getByRole('button', { name: /^Stay window$|^Qalma pəncərəsi$|^Окно проживания$/i })).toBeVisible();
    await expect(dialog.getByText(/^Billing$|^Billing$|^Биллинг$/i).first()).toBeVisible();
    await expect(dialog.getByTestId('reservation-card-header-snapshot')).toBeVisible();
    await dialog.getByText(/guests|qonaqlar|гости/i).first().click();
    await expect(dialog.getByTestId('reservation-guests-tab')).toBeVisible();
    await dialog.getByText(/pricing|qiymət|цены/i).first().click();
    await expect(dialog.getByTestId('reservation-pricing-tab')).toBeVisible();
    await dialog.getByText(/^folio$/i).first().click();
    await expect(dialog.getByTestId('reservation-folio-tab')).toBeVisible();
    await expect(dialog.getByTestId('folio-chip-guest')).toBeVisible();
    await expect(dialog.getByTestId('folio-chip-company')).toBeVisible();
    await dialog.getByText(/notes|qeydlər|заметк/i).first().click();
    await expect(dialog.getByTestId('reservation-notes-tab')).toBeVisible();
    await expect(dialog.getByTestId('notes-dept-fo')).toBeVisible();
  });

  test('new booking opens create reservation card', async ({ page }) => {
    await page.goto('/');
    const newBtn = page.getByRole('button', { name: /new booking|yeni|новая/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 20000 });
    await newBtn.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(dialog.getByText(/new reservation|yeni rezerv|новая/i).first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Stay window$|^Qalma pəncərəsi$|^Окно проживания$/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Rate & source$|^Tarif və mənbə$|^Тариф и источник$/i })).toBeVisible();
    await expect(dialog.getByLabel(/check-in time|giriş vaxtı|время заезда/i).first()).toBeVisible();
    await expect(dialog.getByTestId('reservation-card-header-snapshot')).toBeVisible();
    await expect(dialog.locator('[data-testid="field-row"]').first()).toBeVisible();
    await expect(dialog.getByLabel(/package \/ rate|paket|пакет|tarif|тариф/i).first()).toBeVisible();
  });

  test('right pane guests specials and pricing quote chrome', async ({ page }) => {
    await page.goto('/');
    const newBtn = page.getByRole('button', { name: /new booking|yeni|новая/i }).first();
    await expect(newBtn).toBeVisible({ timeout: 20000 });
    await newBtn.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await dialog.getByText(/guests|qonaqlar|гости/i).first().click();
    await expect(dialog.getByTestId('reservation-guests-specials')).toBeVisible();
    await dialog.getByText(/pricing|qiymət|цены/i).first().click();
    await expect(dialog.getByTestId('reservation-pricing-tab')).toBeVisible();
  });

  test('saved stay: rate grid, folio chips, guest name opens card', async ({ page }) => {
    await page.goto('/reports/reservations');
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 20000 });
    await page.locator('table tbody button.font-mono').first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 15000 });

    await dialog.getByText(/pricing|qiymət|цены/i).first().click();
    await expect(dialog.getByTestId('reservation-pricing-tab')).toBeVisible();
    const rateGrid = dialog.getByTestId('rate-grid-table');
    if (await rateGrid.count()) {
      await expect(rateGrid.locator('tbody tr').first()).toBeVisible();
    } else {
      await expect(dialog.getByTestId('pricing-toolbar')).toBeVisible();
    }

    await dialog.getByText(/^folio$/i).first().click();
    await expect(dialog.getByTestId('folio-chip-all')).toBeVisible();
    await expect(dialog.getByTestId('folio-chip-agency')).toBeVisible();
    const empty = dialog.getByTestId('folio-empty-state');
    if (await empty.count()) {
      await expect(empty).toBeVisible();
      await expect(empty.locator(`a[href*="/folio/"]`).first()).toBeVisible();
    }

    await dialog.getByText(/guests|qonaqlar|гости/i).first().click();
    const nameLink = dialog.getByTestId('pax-name-link').first();
    if (await nameLink.count()) {
      await nameLink.click();
      await expect(page.getByRole('dialog').nth(1)).toBeVisible({ timeout: 10000 });
    }
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
});
