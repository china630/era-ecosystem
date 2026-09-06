"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@era/i18n-common";
import { PublicLegalFooter } from "@era/satellite-kit/ui";
import { getLandingMarketingCopy } from "../../lib/i18n/landing-marketing-copy";
import type { LandingEcosystemCopy } from "../../lib/i18n/landing-marketing-copy";
import { fetchPublicPricingSnapshot } from "../../lib/pricing/fetch-public-pricing";
import type { PublicPricingResponse } from "../../lib/public-pricing-types";
import { LandingChrome } from "./landing-chrome";
import { LandingFeatureSplits } from "./landing-feature-splits";
import { LandingFaq } from "./landing-faq";
import { LandingHero } from "./landing-hero";
import { LandingPageShell } from "./landing-page-shell";
import { LandingEcosystemGrid } from "./landing-ecosystem-grid";
import { LandingLegacyCompare } from "./landing-legacy-compare";
import { LandingTrialBanner } from "./landing-trial-banner";
import { LandingZeroKnowledge } from "./landing-zero-knowledge";
import { LandingBottomCta } from "./landing-bottom-cta";

const FAQ_LABELS = {
  az: { navAria: "Hüquqi keçidlər", faq: "FAQ", terms: "Şərtlər", privacy: "Məxfilik", status: "Status" },
  ru: { navAria: "Юридические ссылки", faq: "FAQ", terms: "Условия", privacy: "Конфиденциальность", status: "Статус" },
  en: { navAria: "Legal links", faq: "FAQ", terms: "Terms", privacy: "Privacy", status: "Status" },
} as const;

function overlayEcosystemPrices(
  ecosystem: LandingEcosystemCopy,
  snapshot: PublicPricingResponse | null,
  locale: Locale,
): LandingEcosystemCopy {
  if (!snapshot || snapshot.unavailable) return ecosystem;
  const byKey = new Map(snapshot.pricingModules.map((m) => [m.key, m.pricePerMonth]));
  const suffix = locale === "ru" ? "/ мес" : "/ ay";
  const fmt = (n: number) => `${n.toFixed(n % 1 === 0 ? 0 : 2)} AZN ${suffix}`;
  return {
    ...ecosystem,
    sections: ecosystem.sections.map((section) => ({
      ...section,
      modules: section.modules.map((mod) => {
        if (!mod.pricingKey) return mod;
        if (mod.pricingKey === "foundation") {
          return { ...mod, priceLabel: fmt(snapshot.foundationMonthlyAzn) };
        }
        const n = byKey.get(mod.pricingKey);
        if (n == null) return mod;
        if (mod.status === "beta") {
          return { ...mod, priceLabel: `Gate ${fmt(n)}` };
        }
        return { ...mod, priceLabel: fmt(n) };
      }),
    })),
  };
}

export function LandingPageView({ initialLocale }: { initialLocale: Locale }) {
  const [locale, setLocale] = useState(initialLocale);
  const [pricing, setPricing] = useState<PublicPricingResponse | null>(null);
  const copy = useMemo(() => getLandingMarketingCopy(locale), [locale]);
  const ecosystem = useMemo(
    () => overlayEcosystemPrices(copy.ecosystem, pricing, locale),
    [copy.ecosystem, pricing, locale],
  );
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
        locale={locale}
        onLocaleChange={setLocale}
      />
      <main id="landing-main">
        <div className="mx-auto max-w-6xl">
          <LandingHero copy={copy.hero} />
          <LandingTrialBanner copy={copy.trial} />
        </div>
        <LandingEcosystemGrid copy={ecosystem} />
        <LandingZeroKnowledge copy={copy.zeroKnowledge} />
        <LandingLegacyCompare copy={copy.legacyCompare} />
        <LandingFeatureSplits copy={copy} />
        <LandingFaq faq={copy.faq} />
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
