import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, type Locale } from "@era/i18n-common";
import { getTranslations } from "next-intl/server";
import { SitePublicShell } from "../../../../components/site/site-public-shell";
import { SiteJsonLd } from "../../../../components/site/site-json-ld";
import { fetchSiteCatalog } from "../../../../lib/site/fetch-site-catalog";
import { siteLocalePath } from "../../../../lib/site/locale-path";
import { calcHrefForIndustry } from "../../../../lib/site/calc-href-for-industry";
import { getSiteNavCopy } from "../../../../lib/i18n/site-nav-copy";
import { PilotBadge } from "../../../../components/site/pilot-badge";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { siteUrl } from "../../../../lib/site/site-origins";
import {
  buildSiteMetadata,
  jsonLdProduct,
  pageTitle,
} from "../../../../lib/site/site-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const locale = raw as Locale;
  const catalog = await fetchSiteCatalog(locale);
  const industry = catalog.industries.find((i) => i.slug === slug);
  if (!industry) return {};
  const t = await getTranslations({ locale, namespace: "site.industries" });
  const description =
    industry.description?.trim() ||
    t("intro");
  return buildSiteMetadata({
    locale,
    path: `/industries/${slug}`,
    title: pageTitle(industry.name),
    description,
  });
}

export default async function IndustryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const catalog = await fetchSiteCatalog(locale);
  const industry = catalog.industries.find((i) => i.slug === slug);
  if (!industry) notFound();

  const t = await getTranslations({ locale, namespace: "site.industries" });
  const nav = getSiteNavCopy(locale);
  const calcHref = calcHrefForIndustry(locale, industry);
  const description =
    industry.description?.trim() || t("intro");
  const industryUrl = siteUrl(`/industries/${industry.slug}`, locale);

  return (
    <SitePublicShell locale={locale} catalog={catalog}>
      <SiteJsonLd
        data={jsonLdProduct({
          name: industry.name,
          description,
          url: industryUrl,
        })}
      />
      <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
        {t("kicker")}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-[#34495E]">
        ERA 365 — {industry.name}
        {industry.maturity === "pilot" ? <PilotBadge label={nav.pilot} /> : null}
      </h1>
      {industry.description ? (
        <p className="mt-3 max-w-2xl text-sm text-[#7F8C8D]">{industry.description}</p>
      ) : null}

      <section className="mt-10">
        <h2 className="m-0 text-lg font-semibold text-[#34495E]">{nav.includes}</h2>
        <ul className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
          {industry.items.map((item) => (
            <li
              key={`${item.satelliteKey}-${item.moduleKey ?? "x"}`}
              className="rounded-2xl border border-[#D5DADF]/80 bg-white p-4"
            >
              <p className="m-0 font-medium text-[#34495E]">
                {item.name}
                {item.maturity === "pilot" ? <PilotBadge label={nav.pilot} /> : null}
              </p>
              {item.publicSlug ? (
                <Link
                  href={siteLocalePath(locale, `/satellites/${item.publicSlug}`)}
                  className="mt-2 inline-block text-sm text-[#2980B9] no-underline"
                >
                  {nav.viewProduct}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={calcHref} className={`${SECONDARY_BUTTON_CLASS} text-xs no-underline`}>
          {nav.calculator}
        </Link>
        <Link href={siteLocalePath(locale, "/demo")} className={`${PRIMARY_BUTTON_CLASS} text-xs no-underline`}>
          {nav.ctaDemo}
        </Link>
      </div>
      <p className="mt-6 text-xs text-[#7F8C8D]">{t("stubNote")}</p>
    </SitePublicShell>
  );
}