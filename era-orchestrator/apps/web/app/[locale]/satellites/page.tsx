import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@era/i18n-common";
import { PilotBadge } from "../../../components/site/pilot-badge";
import { SitePublicShell } from "../../../components/site/site-public-shell";
import { getSiteNavCopy } from "../../../lib/i18n/site-nav-copy";
import { fetchSiteCatalog } from "../../../lib/site/fetch-site-catalog";
import { siteLocalePath } from "../../../lib/site/locale-path";
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
  const t = await getTranslations({ locale, namespace: "site.satellites" });
  return buildSiteMetadata({
    locale,
    path: "/satellites",
    title: pageTitle(t("seoTitle")),
    description: t("seoDescription"),
  });
}

export default async function LocaleSatellitesIndexPage({
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
      <h1 className="text-3xl font-semibold text-[#34495E]">{labels.solutions}</h1>
      <p className="mt-2 max-w-2xl text-[#7F8C8D]">{labels.solutionsBlurb}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.satellites.map((s) => (
          <li key={s.publicSlug}>
            <Link
              href={siteLocalePath(locale, `/satellites/${s.publicSlug}`)}
              className="block rounded-2xl border border-[#D5DADF] bg-white p-5 transition hover:border-[#2980B9]"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#34495E]">{s.name}</span>
                {s.maturity === "pilot" ? <PilotBadge label={labels.pilot} /> : null}
              </div>
              {s.description ? (
                <p className="mt-2 text-sm text-[#7F8C8D] line-clamp-3">{s.description}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </SitePublicShell>
  );
}
