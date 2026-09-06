"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@era/i18n-common";
import { buildPricingStorefrontView } from "../../lib/pricing/build-pricing-storefront-view";
import { computePricingTotals } from "../../lib/pricing/compute-pricing-totals";
import { getPricingStorefrontUiCopy } from "../../lib/i18n/pricing-storefront-copy";
import type { PublicPricingResponse } from "../../lib/public-pricing-types";
import { LandingLanguageToggle } from "../locale/landing-language-toggle";
import { PublicLegalFooter } from "@era/satellite-kit/ui";
import { PricingBundlesSection } from "./pricing-bundles-section";
import { PricingCheckoutBar } from "./pricing-checkout-bar";
import { PricingCoreSuiteSection } from "./pricing-core-suite-section";
import { PricingHeroSection } from "./pricing-hero-section";
import { PricingPageShell } from "./pricing-page-shell";
import { PricingIndustrySection } from "./pricing-industry-section";
import { PricingPlatformAddonsSection } from "./pricing-platform-addons-section";
import { PricingPremiumPanel } from "./pricing-premium-panel";
import { PricingResourceMatrix } from "./pricing-resource-matrix";

const PRICING_LOGIN_BTN_CLASS =
  "inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm no-underline transition-all duration-200 hover:bg-slate-50";

export function PricingPageView({
  initialLocale,
  snapshot,
}: {
  initialLocale: "ru" | "az";
  snapshot: PublicPricingResponse;
}) {
  const [locale, setLocale] = useState<"az" | "ru">(initialLocale);
  const onLocaleChange = (next: Locale) => {
    if (next === "az" || next === "ru") setLocale(next);
  };
  const [selectedTierId, setSelectedTierId] =
    useState<"TIER_0" | "TIER_1" | "TIER_2" | "TIER_3">("TIER_0");
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(null);
  const [selectedIndustryBundles, setSelectedIndustryBundles] = useState<
    Record<string, string | null>
  >({});
  const [selectedPremiumSlugs, setSelectedPremiumSlugs] = useState<string[]>([]);

  const view = useMemo(
    () => buildPricingStorefrontView(snapshot, getPricingStorefrontUiCopy(locale)),
    [snapshot, locale],
  );

  const totals = useMemo(
    () =>
      computePricingTotals(
        view,
        selectedTierId,
        selectedPremiumSlugs,
        selectedBundleId,
        selectedIndustryBundles,
      ),
    [view, selectedTierId, selectedPremiumSlugs, selectedBundleId, selectedIndustryBundles],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const togglePremium = (slug: string) => {
    setSelectedPremiumSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  return (
    <PricingPageShell>
      <header className="sticky top-0 z-20 border-b border-slate-300/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-slate-800 no-underline"
          >
            ERA 365
          </Link>
          <div className="flex items-center gap-2">
            <LandingLanguageToggle locale={locale} onChange={onLocaleChange} />
            <Link href="/login" className={PRICING_LOGIN_BTN_CLASS}>
              {view.hero.ctaLogin}
            </Link>
          </div>
        </div>
      </header>

      {view.unavailable ? (
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-amber-800">
          {locale === "ru"
            ? "Каталог цен временно недоступен. Показаны только тексты интерфейса."
            : "Qiymət kataloqu müvəqqəti əlçatan deyil. Yalnız interfeys mətnləri göstərilir."}
        </p>
      ) : null}

      <main className="pb-36">
        <PricingHeroSection hero={view.hero} />

        <PricingCoreSuiteSection
          coreSuiteTitle={view.coreSuiteTitle}
          coreSuiteIntro={view.coreSuiteIntro}
          standardModulesTitle={view.standardModulesTitle}
          foundation={view.foundation}
          standardModules={view.standardModules}
          perMonthSuffix={view.pricePerMonthSuffix}
          trialPromoText={view.trialPromoText}
          trialPromoButton={view.trialPromoButton}
        />

        <PricingBundlesSection
          title={view.bundlesTitle}
          hint={view.bundlesHint}
          bundles={view.bundles}
          bundleCtaLabel={view.bundleCtaLabel}
          bundlePopularBadge={view.bundlePopularBadge}
          perMonthSuffix={view.pricePerMonthSuffix}
          selectedBundleId={selectedBundleId}
          onSelectBundle={setSelectedBundleId}
        />

        <PricingIndustrySection
          title={view.industriesTitle}
          intro={view.industriesIntro}
          bundleSelectLabel={view.hospitalityBundleSelect}
          perMonthSuffix={view.pricePerMonthSuffix}
          groups={view.industryGroups}
          selectedBySatellite={selectedIndustryBundles}
          onSelectBundle={(satelliteKey, marketingId) => {
            setSelectedIndustryBundles((prev) => ({ ...prev, [satelliteKey]: marketingId }));
          }}
        />

        <PricingPlatformAddonsSection
          title={view.platformAddonsTitle}
          hint={view.platformAddonsHint}
          xorHint={view.platformAddonsXor}
          perMonthSuffix={view.pricePerMonthSuffix}
          addons={view.platformAddons}
        />

        <PricingPremiumPanel
          title={view.premiumTitle}
          hint={view.premiumHint}
          premiumModules={view.premiumModules}
          premiumLockedTitle={view.premiumLockedTitle}
          premiumUpgradeCta={view.premiumUpgradeCta}
          selectedPremiumSlugs={selectedPremiumSlugs}
          onTogglePremium={togglePremium}
        />

        <PricingResourceMatrix
          title={view.matrixTitle}
          hint={view.matrixHint}
          tiers={view.tiers}
          unitPriceLabels={view.unitPriceLabels}
          meterUnitPricing={view.meterUnitPricing}
          quotaUnitPricing={view.quotaUnitPricing}
          selectedTierId={selectedTierId}
          onSelectTier={setSelectedTierId}
        />

        <div className="px-4 pb-8">
          <PublicLegalFooter
            locale={locale}
            faqHref="/help"
            labels={{
              navAria: locale === "ru" ? "Юридические ссылки и справка" : "Hüquqi keçidlər və kömək",
              faq: "FAQ",
              terms: locale === "ru" ? "Условия использования" : "İstifadə şərtləri",
              privacy: locale === "ru" ? "Конфиденциальность" : "Məxfilik",
              status: "Status",
            }}
          />
        </div>
      </main>

      <PricingCheckoutBar
        dueTodayLabel={totals.dueTodayLabel}
        postpaidLabel={totals.postpaidLabel}
        bakuNotice={view.calculator.bakuNotice}
      />
    </PricingPageShell>
  );
}
