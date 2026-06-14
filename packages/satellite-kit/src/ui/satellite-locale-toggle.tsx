"use client";

import type { Locale } from "@era/i18n-common";
import { ERA_I18N_COOKIE } from "@era/i18n-common";
import { LocaleToggle } from "./locale-toggle";

type Props = {
  locale: Locale;
  labels?: {
    groupAria?: string;
    az?: string;
    ru?: string;
    en?: string;
  };
};

function persistLocaleCookie(locale: Locale) {
  try {
    localStorage.setItem(ERA_I18N_COOKIE, locale);
  } catch {
    // ignore
  }
  document.cookie = `${ERA_I18N_COOKIE}=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

/** Persist locale via client cookie (HTTP-safe) + optional API, then reload. */
export function SatelliteLocaleToggle({ locale, labels }: Props) {
  async function switchLocale(next: Locale) {
    if (next === locale) return;
    persistLocaleCookie(next);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
    } catch {
      // client cookie is enough for next-intl SSR
    }
    window.location.reload();
  }

  return <LocaleToggle locale={locale} onChange={switchLocale} labels={labels} />;
}
