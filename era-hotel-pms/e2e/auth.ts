import type { Page } from '@playwright/test';

export const DEFAULT_LOGIN = process.env.PLAYWRIGHT_LOGIN ?? 'admin';
export const DEFAULT_PASSWORD = process.env.PLAYWRIGHT_PASSWORD ?? 'admin123';

/** Hotel PMS login form (EN labels from AuthLoginCard). */
export async function loginHotelPms(
  page: Page,
  login = DEFAULT_LOGIN,
  password = DEFAULT_PASSWORD,
) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /username|email|phone|login|istifadəçi|логин/i }).fill(login);
  await page.getByRole('textbox', { name: /^password$|şifrə|пароль/i }).fill(password);
  await page.getByRole('button', { name: /sign in|daxil|войти/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
}
