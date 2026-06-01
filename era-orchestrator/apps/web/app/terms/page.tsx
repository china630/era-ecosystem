import { getLocale, getTranslations } from "next-intl/server";
import { TermsPageClient } from "./terms-client";
import type { Locale } from "@era/i18n-common";

export default async function TermsPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("terms");
  return (
    <TermsPageClient
      locale={locale}
      content={{
        title: t("title"),
        intro: t("intro"),
        section1Title: t("section1Title"),
        section1Body: t("section1Body"),
        section2Title: t("section2Title"),
        section2Body: t("section2Body"),
        section3Title: t("section3Title"),
        section3Body: t("section3Body"),
      }}
    />
  );
}
