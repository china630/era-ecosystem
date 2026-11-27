import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@era/i18n-common";
import { LandingPageShell } from "../../../components/landing/landing-page-shell";
import { PricingPageView } from "../../../components/pricing/pricing-page-view";
import { SiteFooter } from "../../../components/site/site-footer";
import { SiteHeader } from "../../../components/site/site-header";
import { getSiteNavCopy } from "../../../lib/i18n/site-nav-copy";
import { fetchPublicPricingSnapshot } from "../../../lib/pricing/fetch-public-pricing";
import { fetchSiteCatalog } from "../../../lib/site/fetch-site-catalog";
import { buildSiteMetadata, pageTitle } from "../../../lib/site/site-metadata";

export const dynamic = "force-dynamic";

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
  const t = await getTranslations({ locale, namespace: "site.pricing" });
  return buildSiteMetadata({
    locale,
    path: "/pricing",
    title: pageTitle(t("seoTitle")),
    description: t("seoDescription"),
  });
}

export default async function LocalePricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const [snapshot, catalog] = await Promise.all([
    fetchPublicPricingSnapshot(),
    fetchSiteCatalog(locale),
  ]);
  const labels = getSiteNavCopy(locale);

  return (
    <LandingPageShell>
      <SiteHeader locale={locale} catalog={catalog} labels={labels} />
      <PricingPageView initialLocale={locale} snapshot={snapshot} hideChrome />
      <SiteFooter locale={locale} catalog={catalog} labels={labels} />
    </LandingPageShell>
  );
}
