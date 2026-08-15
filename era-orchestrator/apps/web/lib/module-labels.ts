import type { PublicPricingResponse } from "./public-pricing-types";

/**
 * Human labels for module slugs that are not part of the sellable satellite
 * catalog (finance foundation modules, platform add-ons). The public pricing
 * snapshot is the primary source; this map is the fallback for slugs the
 * catalog does not name.
 */
const STATIC_MODULE_LABELS: Record<string, string> = {
  platform_workforce: "Workforce (HR hub)",
  nas: "NAS (national standards)",
  foundation: "Foundation",
  ifrs: "IFRS",
  ifrs_mapping: "IFRS mapping",
  production: "Production",
  manufacturing: "Manufacturing",
  fixed_assets: "Fixed assets",
  inventory: "Inventory",
  hr_full: "HR & Payroll",
  audit_hub: "Audit hub",
  cash_bank_pro: "Cash & Bank Pro",
  kassa_pro: "Cashier Pro",
  banking_pro: "Banking Pro",
  tax_pro: "Tax Pro",
  trade_pro: "Trade Pro",
};

function prettify(slug: string): string {
  return slug
    .replace(/^(industry_|hotel_|platform_)/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns a labeler that maps a module slug to a human-readable name using the
 * pricing catalog first, then static overrides, then a prettified slug.
 */
export function buildModuleLabeler(
  pricing: PublicPricingResponse | null,
): (slug: string) => string {
  const map = new Map<string, string>();
  if (pricing && !pricing.unavailable) {
    for (const m of pricing.pricingModules ?? []) map.set(m.key, m.name);
    for (const m of pricing.hospitalityModules ?? []) map.set(m.key, m.name);
    for (const m of pricing.premiumModules ?? []) map.set(m.key, m.name);
  }
  return (slug: string): string =>
    map.get(slug) ?? STATIC_MODULE_LABELS[slug] ?? prettify(slug);
}
