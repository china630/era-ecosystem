"use client";

import { LocaleToggle } from "@era/satellite-kit/ui";
import { uiLang, type Locale } from "@era/i18n-common";
import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const locale = uiLang(i18n.language);

  return (
    <LocaleToggle
      locale={locale}
      labels={{
        groupAria: t("language"),
        az: t("az"),
        ru: t("ru"),
        en: "EN",
      }}
      onChange={(next) => {
        void i18n.changeLanguage(next);
      }}
    />
  );
}
