import type { Page } from '@playwright/test';

export const DEFAULT_LOGIN = process.env.PLAYWRIGHT_LOGIN ?? 'admin';
export const DEFAULT_PASSWORD = process.env.PLAYWRIGHT_PASSWORD ?? 'admin123';
export const CLINIC_LOGIN = process.env.PLAYWRIGHT_CLINIC_LOGIN ?? process.env.ECOSYSTEM_DEMO_LOGIN ?? 'chingiz@era.com';
export const CLINIC_PASSWORD = process.env.PLAYWRIGHT_CLINIC_PASSWORD ?? process.env.ECOSYSTEM_DEMO_PASSWORD ?? '12345678';

export async function loginHotelPms(page: Page, login = DEFAULT_LOGIN, password = DEFAULT_PASSWORD) {
  await page.context().addCookies([{ name: 'NEXT_LOCALE', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username|email|phone|login|istifadəçi|логин/i }).fill(login);
  await page.getByRole('textbox', { name: /^password$|şifrə|пароль/i }).fill(password);
  await page.getByRole('button', { name: /sign in|daxil|войти/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
}

export async function loginClinic(page: Page, login = CLINIC_LOGIN, password = CLINIC_PASSWORD) {
  await page.context().addCookies([{ name: 'NEXT_LOCALE', value: 'en', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username|email|phone|login|istifadəçi|логин/i }).fill(login);
  await page.getByRole('textbox', { name: /^password$|şifrə|пароль/i }).fill(password);
  await page.getByRole('button', { name: /sign in|daxil|войти/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
}
