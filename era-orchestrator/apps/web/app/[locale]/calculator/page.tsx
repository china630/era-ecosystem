import { notFound } from "next/navigation";
import Link from "next/link";
import { isLocale, type Locale } from "@era/i18n-common";
import { getTranslations } from "next-intl/server";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { SitePublicShell } from "../../../components/site/site-public-shell";
import { fetchSiteCatalog } from "../../../lib/site/fetch-site-catalog";
import { calcHrefForIndustry, calcPublicHref } from "../../../lib/site/calc-href-for-industry";
import { siteLocalePath } from "../../../lib/site/locale-path";
import { getSiteNavCopy } from "../../../lib/i18n/site-nav-copy";

export default async function CalculatorLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const t = await getTranslations({ locale, namespace: "site.calculator" });
  const catalog = await fetchSiteCatalog(locale);
  const nav = getSiteNavCopy(locale);

  return (
    <SitePublicShell locale={locale} catalog={catalog}>
      <h1 className="m-0 text-2xl font-bold text-[#34495E]">{t("title")}</h1>
      <p className="mt-2 text-sm text-[#7F8C8D]">{t("intro")}</p>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-[#34495E]">
        <li>{t("step1")}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
      </ol>

      <section className="mt-10">
        <h2 className="m-0 text-lg font-semibold text-[#34495E]">{t("byIndustry")}</h2>
        <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
          {catalog.industries.map((ind) => (
            <li key={ind.slug}>
              <Link
                href={calcHrefForIndustry(locale, ind)}
                className="rounded-full border border-[#2980B9]/25 bg-[#EBF5FB] px-3 py-1 text-xs font-medium text-[#2471A3] no-underline"
              >
                {ind.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={calcPublicHref()} className={`${PRIMARY_BUTTON_CLASS} text-xs no-underline`}>
          {nav.calcCardCta}
        </Link>
        <Link href={siteLocalePath(locale, "/demo")} className={`${SECONDARY_BUTTON_CLASS} text-xs no-underline`}>
          {nav.ctaDemo}
        </Link>
      </div>
    </SitePublicShell>
  );
}