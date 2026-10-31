"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@era/i18n-common";
import { LocaleToggle } from "@era/satellite-kit/ui";
import { persistClientLocale } from "../../lib/locale-client";

/** Same UX as finance `LanguageSwitcher` — client persist + reload for next-intl. */
export function OrchLanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("auth");

  function switchLocale(next: Locale) {
    if (next === locale) return;
    persistClientLocale(next);
    window.location.reload();
  }

  return (
    <LocaleToggle
      locale={locale}
      labels={{
        groupAria: t("localeToggleAria"),
        az: t("localeAz"),
        ru: t("localeRu"),
        en: t("localeEn"),
      }}
      onChange={switchLocale}
    />
  );
}
