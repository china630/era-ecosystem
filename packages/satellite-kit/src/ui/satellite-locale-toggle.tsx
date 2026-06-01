"use client";

import type { Locale } from "@era/i18n-common";
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

/** Persist locale via POST /api/locale, then full reload (avoids stale RSC/static cache). */
export function SatelliteLocaleToggle({ locale, labels }: Props) {
  async function switchLocale(next: Locale) {
    if (next === locale) return;
    try {
      const res = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      if (!res.ok) return;
      window.location.reload();
    } catch {
      // ignore network errors — keep current locale
    }
  }

  return <LocaleToggle locale={locale} onChange={switchLocale} labels={labels} />;
}
