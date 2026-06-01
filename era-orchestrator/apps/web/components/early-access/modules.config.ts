import type { IndustryModuleKey } from "@era/satellite-kit/platform/industry-modules";

export type EarlyAccessModuleKey = IndustryModuleKey;

export const EARLY_ACCESS_MODULES: Record<
  EarlyAccessModuleKey,
  { title: string; priceAzn: number }
> = {
  RETAIL: { title: "Retail & E-commerce", priceAzn: 15 },
  LOGISTICS: { title: "Logistics & Customs", priceAzn: 25 },
  CONSTRUCTION: { title: "Construction", priceAzn: 20 },
  CRM: { title: "CRM & Communications", priceAzn: 10 },
  AUTO_SERVICE: { title: "Auto Service", priceAzn: 18 },
  CLINIC: { title: "Clinic", priceAzn: 22 },
  WHOLESALE: { title: "Wholesale & Distribution", priceAzn: 20 },
  HOTEL_PMS: { title: "Hotel PMS", priceAzn: 28 },
  FNB_POS: { title: "F&B POS", priceAzn: 18 },
};
