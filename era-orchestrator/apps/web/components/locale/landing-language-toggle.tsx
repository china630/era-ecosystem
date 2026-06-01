"use client";

import type { Locale } from "@era/i18n-common";
import { LocaleToggle } from "@era/satellite-kit/ui";

export function LandingLanguageToggle({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (next: Locale) => void;
}) {
  return <LocaleToggle locale={locale} onChange={onChange} labels={{ az: "AZ", ru: "RU", en: "EN" }} />;
}
