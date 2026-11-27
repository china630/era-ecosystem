"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@era/i18n-common";
import { PublicLegalFooter } from "@era/satellite-kit/ui";
import { getLandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";
import { getSatellitePageCopy } from "../../lib/i18n/satellite-page-copy";
import { fetchPublicPricingSnapshot } from "../../lib/pricing/fetch-public-pricing";
import type { PublicPricingResponse } from "../../lib/public-pricing-types";
import {
  PUBLIC_SATELLITE_PAGES,
  type PublicSatelliteSlug,
} from "../../lib/satellites/public-satellite-catalog";
import { calcNavLabel } from "../../lib/i18n/calc-copy";
import { siteLocalePath } from "../../lib/site/locale-path";
import { LandingFaq } from "./landing-faq";
import { LandingHero } from "./landing-hero";
import { LandingPageShell } from "./landing-page-shell";
import { ArchitectureMap } from "../site/architecture-map/ArchitectureMap";
import type { SiteCatalogResponse } from "../../lib/site/site-catalog-types";
import { LandingHubGrid } from "./landing-hub-grid";
import { LandingTrialBanner } from "./landing-trial-banner";
import { LandingZeroKnowledge } from "./landing-zero-knowledge";
import { LandingBottomCta } from "./landing-bottom-cta";

const FAQ_LABELS = {
  az: { navAria: "Hüquqi keçidlər", faq: "FAQ", terms: "Şərtlər", privacy: "Məxfilik", status: "Status" },
  ru: { navAria: "Юридические ссылки", faq: "FAQ", terms: "Условия", privacy: "Конфиденциальность", status: "Статус" },
  en: { navAria: "Legal links", faq: "FAQ", terms: "Terms", privacy: "Privacy", status: "Status" },
} as const;

function fmtPrice(n: number, locale: Locale): string {
  const suffix = locale === "ru" ? "/ мес" : locale === "en" ? "/ mo" : "/ ay";
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} AZN ${suffix}`;
}

function pricingByKeyFromSnapshot(
  snapshot: PublicPricingResponse | null,
): Record<string, { fromPriceAzn: number; unit: "month" | "person" }> | undefined {
  if (!snapshot || snapshot.unavailable) return undefined;
  const byKey = new Map((snapshot.pricingModules ?? []).map((m) => [m.key, m.pricePerMonth]));
  const out: Record<string, { fromPriceAzn: number; unit: "month" | "person" }> = {};
  for (const page of PUBLIC_SATELLITE_PAGES) {
    if (!page.satelliteKey || !page.pricingKey) continue;
    if (page.pricingKey === "foundation") continue;
    const n = byKey.get(page.pricingKey);
    if (n == null) continue;
    out[page.satelliteKey] = {
      fromPriceAzn: n,
      unit: page.satelliteKey === "platform_workforce" ? "person" : "month",
    };
  }
  const wf = byKey.get("platform_workforce");
  if (wf != null) {
    out.platform_workforce = { fromPriceAzn: wf, unit: "person" };
  }
  return out;
}

function LandingHubAddonsStrip({
  hub,
  calcLabel,
  locale,
}: {
  hub: ReturnType<typeof getLandingMarketingCopy>["hub"];
  calcLabel?: string;
  locale: Locale;
}) {
  return (
    <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#D5DADF] bg-white p-5 shadow-sm md:flex-row md:items-center">
      <div>
        <h3 className="m-0 text-[15px] font-semibold text-[#34495E]">{hub.addonsTitle}</h3>
        <p className="mt-1 m-0 max-w-2xl text-[13px] leading-relaxed text-[#7F8C8D]">{hub.addonsBody}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`${siteLocalePath(locale, "/pricing")}#addons`}
          className="rounded-xl border border-[#D5DADF] bg-white px-4 py-2 text-sm font-semibold text-[#34495E] no-underline hover:bg-[#EBEDF0]"
        >
          {hub.addonsCta}
        </Link>
        <Link
          href={siteLocalePath(locale, "/pricing")}
          className="rounded-xl bg-[#2980B9] px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-[#2471A3]"
        >
          {hub.catalogCta}
        </Link>
        {calcLabel ? (
          <Link
            href="/calc"
            className="rounded-xl border border-[#2980B9] bg-white px-4 py-2 text-sm font-semibold text-[#2980B9] no-underline hover:bg-[#EBF5FB]"
          >
            {calcLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function hubCards(locale: Locale, snapshot: PublicPricingResponse | null) {
  const byKey = new Map((snapshot?.pricingModules ?? []).map((m) => [m.key, m.pricePerMonth]));
  const live = snapshot && !snapshot.unavailable;
  return PUBLIC_SATELLITE_PAGES.map((page) => {
    const copy = getSatellitePageCopy(locale, page.slug);
    let priceLabel: string | undefined;
    if (live && page.pricingKey) {
      if (page.pricingKey === "foundation") {
        priceLabel = fmtPrice(snapshot.foundationMonthlyAzn, locale);
      } else {
        const n = byKey.get(page.pricingKey);
        if (n != null) priceLabel = page.kind === "industry" ? `Gate ${fmtPrice(n, locale)}` : fmtPrice(n, locale);
      }
    }
    return {
      slug: page.slug as PublicSatelliteSlug,
      title: copy.title.split("—")[0]?.trim() || copy.title,
      body: copy.tagline,
      href: siteLocalePath(locale, `/satellites/${page.slug}`),
      priceLabel,
    };
  });
}

export function LandingPageView({
  initialLocale,
  hideChrome,
  catalog,
}: {
  initialLocale: Locale;
  /** When true, render only main landing blocks (used under SiteHeader/SiteFooter). */
  hideChrome?: boolean;
  catalog?: SiteCatalogResponse;
}) {
  const [locale] = useState(initialLocale);
  const [pricing, setPricing] = useState<PublicPricingResponse | null>(null);
  const copy = useMemo(() => getLandingMarketingCopy(locale), [locale]);
  const cards = useMemo(() => hubCards(locale, pricing), [locale, pricing]);
  const archPricing = useMemo(() => pricingByKeyFromSnapshot(pricing), [pricing]);
  const useArchitectureMap = Boolean(hideChrome && catalog);
  const legalLabels = FAQ_LABELS[locale] ?? FAQ_LABELS.az;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    void fetchPublicPricingSnapshot().then(setPricing);
  }, []);

  const main = (
    <main id="landing-main">
      <div className="mx-auto max-w-6xl">
        <LandingHero copy={copy.hero} calcLabel={calcNavLabel(locale)} locale={locale} />
        <LandingTrialBanner copy={copy.trial} />
      </div>
      {useArchitectureMap && catalog ? (
        <div className="mx-auto max-w-6xl">
          <ArchitectureMap
            catalog={catalog}
            locale={locale}
            variant="home"
            foundationMonthlyAzn={
              pricing && !pricing.unavailable ? pricing.foundationMonthlyAzn : undefined
            }
            bankingMonthlyAzn={
              pricing && !pricing.unavailable ? archPricing?.industry_banking?.fromPriceAzn : undefined
            }
            pricingByKey={archPricing}
          />
          <LandingHubAddonsStrip
            hub={copy.hub}
            calcLabel={calcNavLabel(locale)}
            locale={locale}
          />
        </div>
      ) : (
        <LandingHubGrid
          hub={copy.hub}
          satellites={cards}
          calcLabel={calcNavLabel(locale)}
          pricingHref={siteLocalePath(locale, "/pricing")}
          addonsHref={`${siteLocalePath(locale, "/pricing")}#addons`}
        />
      )}
      <LandingZeroKnowledge copy={copy.zeroKnowledge} />
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <LandingFaq faq={copy.faq} />
      </div>
      <LandingBottomCta copy={copy.bottomCta} calcLabel={calcNavLabel(locale)} />
    </main>
  );

  /** Public chrome is always SiteHeader via SitePublicShell / locale pages — no LandingChrome. */
  if (hideChrome) return main;

  return (
    <LandingPageShell>
      {main}
      <footer className="border-t border-[#D5DADF]/80 px-4 py-8">
        <p className="text-center text-[12px] text-[#7F8C8D]">
          © {new Date().getFullYear()} {copy.footer}
        </p>
        <PublicLegalFooter
          locale={locale}
          faqHref="/#faq"
          appPrefix="ERA365"
          labels={legalLabels}
        />
      </footer>
    </LandingPageShell>
  );
}
