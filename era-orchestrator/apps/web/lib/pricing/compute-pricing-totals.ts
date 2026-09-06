import type { PricingStorefrontView } from "./build-pricing-storefront-view";
import { estimatePostpaidWithBundleDedup } from "./pricing-public-dedup";

function fmtAzn(n: number): string {
  return `${n.toFixed(n % 1 === 0 ? 0 : 2)} AZN`;
}

export function computePricingTotals(
  view: PricingStorefrontView,
  selectedTierId: PricingStorefrontView["tiers"][number]["id"],
  selectedPremiumSlugs: readonly string[],
  selectedBundleId: string | null,
  selectedIndustryBundles: Record<string, string | null> = {},
): { dueTodayAzn: number; postpaidAzn: number; dueTodayLabel: string; postpaidLabel: string } {
  const premiumMonthly = selectedPremiumSlugs.reduce((s, slug) => {
    const mod = view.premiumModules.find((m) => m.slug === slug);
    return s + (mod?.pricePerMonth ?? 0);
  }, 0);

  const bundle = selectedBundleId
    ? view.bundles.find((b) => b.marketingId === selectedBundleId) ?? null
    : null;

  let industryMonthly = 0;
  for (const group of view.industryGroups) {
    const id = selectedIndustryBundles[group.satelliteKey];
    if (!id) continue;
    const hit = group.bundles.find((b) => b.marketingId === id);
    industryMonthly += hit?.discountedPriceAzn ?? 0;
  }

  const postpaidCore = estimatePostpaidWithBundleDedup({
    foundationMonthlyAzn: view.foundation.foundationMonthlyAzn,
    selectedBundle: bundle
      ? {
          moduleKeys: bundle.moduleKeys,
          discountedPriceAzn: bundle.discountedPriceAzn,
        }
      : null,
    selectedPremiumMonthly: premiumMonthly,
  });

  const postpaid = Math.round((postpaidCore + industryMonthly) * 100) / 100;
  const dueTodayAzn = 0;

  return {
    dueTodayAzn,
    postpaidAzn: postpaid,
    dueTodayLabel: view.calculator.dueTodayLabel.replace("{{amount}}", fmtAzn(dueTodayAzn)),
    postpaidLabel: view.calculator.postpaidLabel.replace("{{amount}}", fmtAzn(postpaid)),
  };
}
