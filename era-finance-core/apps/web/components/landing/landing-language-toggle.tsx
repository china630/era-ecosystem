"use client";

import { LocaleToggle } from "@era/satellite-kit/ui";
import { uiLang, type Locale } from "@era/i18n-common";

export function LandingLanguageToggle({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange?: (next: Locale) => void;
}) {
  return (
    <LocaleToggle
      locale={locale}
      variant="buttons"
      onChange={onLocaleChange}
    />
  );
}
