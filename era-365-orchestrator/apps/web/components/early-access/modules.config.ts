import type { IndustryModuleKey } from "@era/satellite-kit";

export type EarlyAccessModuleKey = IndustryModuleKey;

export const EARLY_ACCESS_MODULES: Record<
  EarlyAccessModuleKey,
  { title: string; priceAzn: number }
> = {
  RETAIL_ECOM: { title: "Retail & E-commerce", priceAzn: 15 },
  LOGISTICS_CUSTOMS: { title: "Logistics & Customs", priceAzn: 25 },
  CONSTRUCTION: { title: "Construction", priceAzn: 20 },
  CRM_WHATSAPP: { title: "CRM & WhatsApp", priceAzn: 10 },
  AUTO_STO: { title: "Auto STO", priceAzn: 18 },
  CLINIC: { title: "Clinic", priceAzn: 22 },
  WHOLESALE: { title: "Wholesale", priceAzn: 20 },
  HOTEL_PMS: { title: "Hotel PMS", priceAzn: 28 },
  FB_POS: { title: "F&B POS", priceAzn: 18 },
};
