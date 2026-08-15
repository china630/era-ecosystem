export type TierKey = "TIER_0" | "TIER_1" | "TIER_2" | "TIER_3";

export type BillingPayload = {
  prices: Record<string, number>;
  quotas: Record<string, unknown>;
  foundationMonthlyAzn: number;
  bankingFoundationMonthlyAzn: number;
  trialPeriodDays: number;
  yearlyDiscountPercent: number;
  quotaPricing: {
    employeeBlockSize: number;
    pricePerEmployeeBlockAzn: number;
    documentPackSize: number;
    pricePerDocumentPackAzn: number;
  };
  meterUnitPricing?: Record<string, number>;
  tierSpendCeilings?: Record<string, number>;
  pricingModules: Array<{
    id: string;
    key: string;
    name: string;
    pricePerMonth: number;
    sortOrder: number;
    isPremium: boolean;
    satelliteKey?: string | null;
    catalogKind?: string | null;
  }>;
  pricingBundles: Array<{
    id: string;
    name: string;
    discountPercent: number;
    moduleKeys: string[];
    isTrialDefault?: boolean;
    trialDurationDays?: number | null;
    trialQuotas?: Record<string, unknown> | null;
    archivedAt?: string | null;
  }>;
};
