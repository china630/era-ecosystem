"use client";

import { PublicLegalFooter as KitPublicLegalFooter } from "@era/satellite-kit/ui";
import { uiLang } from "@era/i18n-common";
import { useTranslation } from "react-i18next";

export function PublicLegalFooter() {
  const { t, i18n } = useTranslation();
  const locale = uiLang(i18n.language);

  return (
    <KitPublicLegalFooter
      locale={locale}
      faqHref="/#faq"
      appPrefix="ERAFINANCE"
      labels={{
        navAria: t("auth.footerLegalNavAria"),
        faq: t("auth.footerFaq"),
        terms: t("auth.footerTerms"),
        privacy: t("auth.footerPrivacy"),
        status: t("auth.footerStatus"),
      }}
    />
  );
}
