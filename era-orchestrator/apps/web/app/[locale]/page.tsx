import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@era/i18n-common";
import { LandingPageView } from "../../components/landing/landing-page-view";
import { LandingPageShell } from "../../components/landing/landing-page-shell";
import { SiteFooter } from "../../components/site/site-footer";
import { SiteHeader } from "../../components/site/site-header";
import { SiteJsonLd } from "../../components/site/site-json-ld";
import { getSiteNavCopy } from "../../lib/i18n/site-nav-copy";
import { fetchSiteCatalog } from "../../lib/site/fetch-site-catalog";
import { fetchSiteContacts } from "../../lib/site/fetch-site-contacts";
import { buildSiteMetadata, jsonLdOrganization } from "../../lib/site/site-metadata";

export function generateStaticParams() {
  return [{ locale: "az" }, { locale: "ru" }, { locale: "en" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale = raw as Locale;
  const t = await getTranslations({ locale, namespace: "site.home" });
  return buildSiteMetadata({
    locale,
    path: "/",
    title: t("seoTitle"),
    description: t("seoDescription"),
  });
}

/** SSR public home — no `useAuth` gate; marketing HTML is in the first response. */
export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const [catalog, labels, contacts] = await Promise.all([
    fetchSiteCatalog(locale),
    Promise.resolve(getSiteNavCopy(locale)),
    fetchSiteContacts(),
  ]);

  return (
    <LandingPageShell>
      <SiteJsonLd data={jsonLdOrganization(contacts)} />
      <SiteHeader locale={locale} catalog={catalog} labels={labels} />
      <LandingPageView initialLocale={locale} hideChrome />
      <SiteFooter locale={locale} catalog={catalog} labels={labels} />
    </LandingPageShell>
  );
}