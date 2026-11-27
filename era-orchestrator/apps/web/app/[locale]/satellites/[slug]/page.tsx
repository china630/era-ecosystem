import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale, type Locale } from "@era/i18n-common";
import { PilotBadge } from "../../../../components/site/pilot-badge";
import { SitePublicShell } from "../../../../components/site/site-public-shell";
import { getSiteNavCopy } from "../../../../lib/i18n/site-nav-copy";
import { calcHrefForIndustry } from "../../../../lib/site/calc-href-for-industry";
import { fetchSiteCatalog } from "../../../../lib/site/fetch-site-catalog";
import { siteLocalePath } from "../../../../lib/site/locale-path";
import { siteUrl } from "../../../../lib/site/site-origins";
import {
  buildSiteMetadata,
  jsonLdSoftwareApplication,
  pageTitle,
} from "../../../../lib/site/site-metadata";
import { SiteJsonLd } from "../../../../components/site/site-json-ld";

export function generateStaticParams() {
  return [{ locale: "az" }, { locale: "ru" }, { locale: "en" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const locale = raw as Locale;
  const catalog = await fetchSiteCatalog(locale);
  const labels = getSiteNavCopy(locale);
  const product = catalog.satellites.find((s) => s.publicSlug === slug);
  if (!product) return {};
  const description =
    product.description?.trim() ||
    product.tagline?.trim() ||
    labels.minCardHint;
  return buildSiteMetadata({
    locale,
    path: `/satellites/${slug}`,
    title: pageTitle(product.name),
    description,
  });
}

export default async function LocaleSatellitePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const catalog = await fetchSiteCatalog(locale);
  const labels = getSiteNavCopy(locale);

  const byCommercial = catalog.satellites.find((s) => s.satelliteKey === slug);
  if (byCommercial && byCommercial.publicSlug !== slug) {
    redirect(siteLocalePath(locale, `/satellites/${byCommercial.publicSlug}`));
  }

  const product = catalog.satellites.find((s) => s.publicSlug === slug);
  if (!product) notFound();

  const related = catalog.industries.filter((ind) =>
    ind.items.some((it) => it.publicSlug === product.publicSlug),
  );

  const description =
    product.description?.trim() ||
    product.tagline?.trim() ||
    labels.minCardHint;
  const productUrl = siteUrl(`/satellites/${product.publicSlug}`, locale);

  return (
    <SitePublicShell locale={locale} catalog={catalog}>
      <SiteJsonLd
        data={jsonLdSoftwareApplication({
          name: product.name,
          description,
          url: productUrl,
        })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold text-[#34495E]">{product.name}</h1>
        {product.maturity === "pilot" ? <PilotBadge label={labels.pilot} /> : null}
      </div>
      {product.tagline ? (
        <p className="mt-2 max-w-3xl text-base font-medium text-[#34495E]">{product.tagline}</p>
      ) : null}
      {product.description ? (
        <p className="mt-3 max-w-3xl text-[#7F8C8D]">{product.description}</p>
      ) : !product.tagline ? (
        <p className="mt-3 max-w-3xl text-sm text-[#7F8C8D]">{labels.minCardHint}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={siteLocalePath(locale, "/demo")}
          className="rounded-lg bg-[#2980B9] px-4 py-2 text-sm font-medium text-white"
          data-track="cta_demo_click"
          data-track-location="solution_page"
        >
          {labels.requestDemo}
        </Link>
        <Link
          href="/calc"
          className="rounded-lg border border-[#2980B9] px-4 py-2 text-sm font-medium text-[#2980B9]"
          data-track="cta_calc_click"
          data-track-location="solution_page"
        >
          {labels.calculator}
        </Link>
        <Link
          href={siteLocalePath(locale, "/pricing")}
          className="rounded-lg border border-[#D5DADF] px-4 py-2 text-sm font-medium text-[#34495E]"
        >
          {labels.pricing}
        </Link>
      </div>

      {(product.modules ?? []).length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-[#34495E]">{labels.modules}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {(product.modules ?? []).map((m) => (
              <li
                key={m.key}
                className="rounded-2xl border border-[#D5DADF] bg-white p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#34495E]">{m.name}</span>
                  {m.maturity === "pilot" ? (
                    <PilotBadge label={labels.pilot} />
                  ) : null}
                </div>
                {m.description ? (
                  <p className="mt-1 text-sm text-[#7F8C8D]">{m.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-[#34495E]">{labels.industries}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {related.map((ind) => (
              <li key={ind.slug}>
                <Link
                  href={siteLocalePath(locale, `/industries/${ind.slug}`)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#D5DADF] px-3 py-1.5 text-sm text-[#34495E]"
                >
                  {ind.name}
                  {ind.maturity === "pilot" ? (
                    <PilotBadge label={labels.pilot} />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {related[0] ? (
        <p className="mt-8 text-sm text-[#7F8C8D]">
          <Link
            href={calcHrefForIndustry(locale, related[0])}
            className="text-[#2980B9] underline"
          >
            {labels.calcForIndustry}
          </Link>
        </p>
      ) : null}
    </SitePublicShell>
  );
}
