import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, type Locale } from "@era/i18n-common";
import { SitePublicShell } from "../../../components/site/site-public-shell";
import { getTranslations } from "next-intl/server";
import { fetchSiteCatalog } from "../../../lib/site/fetch-site-catalog";
import { siteLocalePath } from "../../../lib/site/locale-path";
import { PilotBadge } from "../../../components/site/pilot-badge";
import { getSiteNavCopy } from "../../../lib/i18n/site-nav-copy";
import { buildSiteMetadata, pageTitle } from "../../../lib/site/site-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const locale = raw as Locale;
  const t = await getTranslations({ locale, namespace: "site.industries" });
  return buildSiteMetadata({
    locale,
    path: "/industries",
    title: pageTitle(t("title")),
    description: t("intro"),
  });
}

export default async function IndustriesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = await getTranslations({ locale, namespace: "site.industries" });
  const catalog = await fetchSiteCatalog(locale);
  const nav = getSiteNavCopy(locale);

  return (
    <SitePublicShell locale={locale} catalog={catalog}>
      <h1 className="m-0 text-2xl font-bold text-[#34495E]">{t("title")}</h1>
      <p className="mt-2 text-sm text-[#7F8C8D]">{t("intro")}</p>
      <ul className="mt-8 grid list-none gap-4 p-0 sm:grid-cols-2">
        {catalog.industries.map((ind) => (
          <li
            key={ind.slug}
            className="rounded-2xl border border-[#D5DADF]/80 bg-white p-4 shadow-sm"
          >
            <Link
              href={siteLocalePath(locale, `/industries/${ind.slug}`)}
              className="text-lg font-semibold text-[#34495E] no-underline hover:text-[#2980B9]"
            >
              {ind.name}
              {ind.maturity === "pilot" ? <PilotBadge label={nav.pilot} /> : null}
            </Link>
            {ind.description ? (
              <p className="mt-2 text-sm text-[#7F8C8D]">{ind.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </SitePublicShell>
  );
}