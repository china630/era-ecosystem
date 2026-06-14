"use client";

import { ERA_I18N_COOKIE, type Locale } from "@era/i18n-common";

/** Persist locale for next-intl SSR — no Secure flag (works on local HTTP Docker). */
export function persistClientLocale(locale: Locale) {
  try {
    localStorage.setItem(ERA_I18N_COOKIE, locale);
  } catch {
    // ignore
  }
  document.cookie = `${ERA_I18N_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}
