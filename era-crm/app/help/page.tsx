"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { FaqSection, SatelliteLocaleToggle, PublicLegalFooter } from "@era/satellite-kit/ui";
import { orchPublicHref } from "@era/satellite-kit/ui";
import { useLocale } from "next-intl";
import type { Locale } from "@era/i18n-common";

export default function HelpPage() {
  const t = useTranslations("help");
  const locale = useLocale() as Locale;

  const items = useMemo(
    () => [
      { id: "platform", question: t("items.platform.q"), answer: t("items.platform.a") },
      { id: "sso", question: t("items.sso.q"), answer: t("items.sso.a") },
      { id: "register", question: t("items.register.q"), answer: t("items.register.a") },
    ],
    [t],
  );

  return (
    <main className="mx-auto max-w-lg py-10">
      <div className="mb-4 flex justify-end">
        <SatelliteLocaleToggle locale={locale} />
      </div>
      <FaqSection title={t("title")} items={items} />
      <PublicLegalFooter
        locale={locale}
        faqHref={orchPublicHref("/help")}
        labels={{
          navAria: "Legal",
          faq: "FAQ",
          terms: "Terms",
          privacy: "Privacy",
          status: "Status",
        }}
      />
    </main>
  );
}
