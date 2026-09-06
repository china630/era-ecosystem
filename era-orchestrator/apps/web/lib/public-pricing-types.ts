/** Response shape of `GET /api/public/pricing` (read-only marketing storefront). */

export type MeterUnitPricing = {
  pricePerUserMonthAzn: number;
  pricePerGbMonthAzn: number;
  pricePerWhatsappAlertAzn: number;
  pricePerInvoiceAzn: number;
  pricePerOcrPageAzn: number;
};

export type QuotaUnitPricing = {
  employeeBlockSize: number;
  pricePerEmployeeBlockAzn: number;
  documentPackSize: number;
  pricePerDocumentPackAzn: number;
};

export type PublicPricingModule = {
  key: string;
  name: string;
  pricePerMonth: number;
  sortOrder: number;
  satelliteKey?: string | null;
  isPremium?: boolean;
};

export type PublicPricingBundle = {
  name: string;
  discountPercent: number;
  moduleKeys: string[];
  isTrialDefault: boolean;
  trialDurationDays: number | null;
};

export type PublicStandardModule = {
  id: string;
  moduleKeys: string[];
  pricePerMonthAzn: number;
};

export type PublicBundleStorefront = PublicPricingBundle & {
  marketingId: string;
  listPriceAzn: number;
  discountedPriceAzn: number;
};

export type PublicPremiumModule = {
  key: string;
  name: string;
  pricePerMonth: number;
  sortOrder: number;
};

export type PublicTierStorefront = {
  id: "TIER_0" | "TIER_1" | "TIER_2" | "TIER_3";
  spendCeilingAzn: number;
};

export type PublicIndustryGroup = {
  satelliteKey: string;
  gate: { key: string; name: string; pricePerMonth: number } | null;
  modules: Array<{
    key: string;
    name: string;
    pricePerMonth: number;
    isPremium: boolean;
  }>;
  bundles: PublicBundleStorefront[];
  capacity: { includedInGate: number; unitAzn: number; unit: string } | null;
  note: "banking_sandbox" | null;
};

export type PublicPlatformAddon = {
  key: string;
  name: string;
  pricePerMonth: number;
};

export type PublicPricingResponse = {
  currency: "AZN";
  foundationMonthlyAzn: number;
  yearlyDiscountPercent: number;
  pricingModules: PublicPricingModule[];
  pricingBundles: PublicPricingBundle[];
  meterUnitPricing: MeterUnitPricing;
  quotaUnitPricing?: QuotaUnitPricing | null;
  tierSpendCeilings: Partial<Record<string, number>>;
  standardModules?: PublicStandardModule[];
  premiumModules?: PublicPremiumModule[];
  bundles?: PublicBundleStorefront[];
  hospitalityBundles?: PublicBundleStorefront[];
  hospitalityModules?: Array<PublicPricingModule & { isPremium?: boolean }>;
  industryGroups?: PublicIndustryGroup[];
  platformAddons?: PublicPlatformAddon[];
  tiers?: PublicTierStorefront[];
  unavailable?: true;
};
