import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Car,
  HardHat,
  MessageSquare,
  Package,
  ShoppingBag,
  Stethoscope,
  Truck,
  UtensilsCrossed,
} from "lucide-react";

/** Mirrors Prisma enum `EarlyAccessModuleKey` (painted-door verticals). */
export type EarlyAccessModuleKey =
  | "RETAIL_ECOM"
  | "LOGISTICS_CUSTOMS"
  | "CONSTRUCTION"
  | "CRM_WHATSAPP"
  | "AUTO_STO"
  | "CLINIC"
  | "WHOLESALE"
  | "HOTEL_PMS"
  | "FB_POS";

export const EARLY_ACCESS_MODULE_ORDER: EarlyAccessModuleKey[] = [
  "RETAIL_ECOM",
  "LOGISTICS_CUSTOMS",
  "CONSTRUCTION",
  "CRM_WHATSAPP",
  "AUTO_STO",
  "CLINIC",
  "WHOLESALE",
  "HOTEL_PMS",
  "FB_POS",
];

export const EARLY_ACCESS_MODULES: Record<
  EarlyAccessModuleKey,
  { icon: LucideIcon; priceAzn: number; i18nKey: string }
> = {
  RETAIL_ECOM: { icon: ShoppingBag, priceAzn: 15, i18nKey: "retailEcom" },
  LOGISTICS_CUSTOMS: { icon: Truck, priceAzn: 25, i18nKey: "logisticsCustoms" },
  CONSTRUCTION: { icon: HardHat, priceAzn: 20, i18nKey: "construction" },
  CRM_WHATSAPP: { icon: MessageSquare, priceAzn: 10, i18nKey: "crmWhatsapp" },
  AUTO_STO: { icon: Car, priceAzn: 18, i18nKey: "autoSto" },
  CLINIC: { icon: Stethoscope, priceAzn: 22, i18nKey: "clinic" },
  WHOLESALE: { icon: Package, priceAzn: 20, i18nKey: "wholesale" },
  HOTEL_PMS: { icon: Building2, priceAzn: 28, i18nKey: "hotelPms" },
  FB_POS: { icon: UtensilsCrossed, priceAzn: 18, i18nKey: "fbPos" },
};
