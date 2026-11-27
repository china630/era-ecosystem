import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@era/i18n-common";
import { DemoRequestForm } from "../../../components/site/demo-request-form";
import { SitePublicShell } from "../../../components/site/site-public-shell";
import { getSiteNavCopy } from "../../../lib/i18n/site-nav-copy";
import { fetchSiteCatalog } from "../../../lib/site/fetch-site-catalog";
import { buildSiteMetadata, pageTitle } from "../../../lib/site/site-metadata";

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
  const t = await getTranslations({ locale, namespace: "site.demo" });
  return buildSiteMetadata({
    locale,
    path: "/demo",
    title: pageTitle(t("title")),
    description: t("intro"),
  });
}

export default async function DemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const catalog = await fetchSiteCatalog(locale);
  const labels = getSiteNavCopy(locale);

  return (
    <SitePublicShell locale={locale} catalog={catalog}>
      <h1 className="m-0 text-2xl font-bold text-[#34495E]">{labels.requestDemo}</h1>
      <DemoRequestForm locale={locale} catalog={catalog} source="demo_page" />
    </SitePublicShell>
  );
}
