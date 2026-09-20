"use client";

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
import { LandingChrome } from "./landing-chrome";
import { LandingFaq } from "./landing-faq";
import { LandingHero } from "./landing-hero";
import { LandingPageShell } from "./landing-page-shell";
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
  const suffix = locale === "ru" ? "/ мес" : "/ ay";
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} AZN ${suffix}`;
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
      href: `/satellites/${page.slug}`,
      priceLabel,
    };
  });
}

export function LandingPageView({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const [pricing, setPricing] = useState<PublicPricingResponse | null>(null);
  const copy = useMemo(() => getLandingMarketingCopy(locale), [locale]);
  const cards = useMemo(() => hubCards(locale, pricing), [locale, pricing]);
  const legalLabels = FAQ_LABELS[locale] ?? FAQ_LABELS.az;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    void fetchPublicPricingSnapshot().then(setPricing);
  }, []);

  return (
    <LandingPageShell>
      <LandingChrome
        hero={copy.hero}
        loginLabel={copy.chrome.login}
        satellitesLabel={copy.chrome.navSatellites}
        locale={locale}
        onLocaleChange={setLocale}
      />
      <main id="landing-main">
        <div className="mx-auto max-w-6xl">
          <LandingHero copy={copy.hero} />
          <LandingTrialBanner copy={copy.trial} />
        </div>
        <LandingHubGrid hub={copy.hub} satellites={cards} />
        <LandingZeroKnowledge copy={copy.zeroKnowledge} />
        <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
          <LandingFaq faq={copy.faq} />
        </div>
        <LandingBottomCta copy={copy.bottomCta} />
      </main>
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
