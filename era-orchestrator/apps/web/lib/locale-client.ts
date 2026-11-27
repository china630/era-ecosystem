"use client";

import { ERA_I18N_COOKIE, type Locale } from "@era/i18n-common";

/** Persist locale for next-intl SSR — no Secure flag (works on local HTTP Docker). */
export function persistClientLocale(locale: Locale) {
  try {
    localStorage.setItem(ERA_I18N_COOKIE, locale);
  } catch {
    // ignore
  }
  const host =
    typeof window !== "undefined" ? window.location.hostname : "";
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? ";Secure"
      : "";
  const domain =
    host === "era-365.online" ||
    host === "www.era-365.online" ||
    host === "app.era-365.online" ||
    host.endsWith(".era-365.online")
      ? ";Domain=.era-365.online"
      : "";
  document.cookie = `${ERA_I18N_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax${domain}${secure}`;
}
