"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FaqSection, SatelliteLocaleToggle, PublicLegalFooter } from "@era/satellite-kit/ui";
import { orchPublicHref } from "@era/satellite-kit/ui";
import type { Locale } from "@era/i18n-common";

export default function HelpPage() {
  const t = useTranslations("help");
  const tAuth = useTranslations("auth");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const items = useMemo(
    () => [
      { id: "platform", question: t("items.platform.q"), answer: t("items.platform.a") },
      { id: "sso", question: t("items.sso.q"), answer: t("items.sso.a") },
      { id: "pos", question: t("items.pos.q"), answer: t("items.pos.a") },
    ],
    [t],
  );

  return (
    <main className="mx-auto max-w-lg py-6">
      <div className="mb-4 flex justify-end">
        <SatelliteLocaleToggle locale={locale} />
      </div>
      <FaqSection title={t("title")} items={items} />
      <PublicLegalFooter
        locale={locale}
        faqHref={orchPublicHref("/help")}
        labels={{
          navAria: tAuth("footerLegalNavAria"),
          faq: tAuth("footerFaq"),
          terms: tAuth("footerTerms"),
          privacy: tAuth("footerPrivacy"),
          status: tAuth("footerStatus"),
        }}
      />
    </main>
  );
}
