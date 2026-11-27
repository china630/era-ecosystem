import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BedDouble,
  Building2,
  Car,
  ClipboardList,
  Database,
  Factory,
  Hotel,
  Package,
  ShoppingBag,
  Stethoscope,
  Truck,
  Users,
  UtensilsCrossed,
  Warehouse,
} from "lucide-react";

/** Icon per publicSlug / satelliteKey for mega-menu and architecture map. */
const BY_SLUG: Record<string, LucideIcon> = {
  finance: Banknote,
  banking: Building2,
  hotel: Hotel,
  fnb: UtensilsCrossed,
  clinic: Stethoscope,
  retail: ShoppingBag,
  auto: Car,
  logistics: Truck,
  wholesale: Warehouse,
  construction: Factory,
  crm: ClipboardList,
  workforce: Users,
  "data-hub": Database,
};

const BY_KEY: Record<string, LucideIcon> = {
  finance_core: Banknote,
  industry_banking: Building2,
  industry_hotel_pms: BedDouble,
  industry_fnb_pos: UtensilsCrossed,
  industry_clinic: Stethoscope,
  industry_retail: ShoppingBag,
  industry_auto_service: Car,
  industry_logistics: Truck,
  industry_wholesale: Warehouse,
  industry_construction: Factory,
  industry_crm: ClipboardList,
  platform_workforce: Users,
  platform_datahub: Database,
};

export function siteProductIcon(
  publicSlugOrKey: string,
): LucideIcon {
  return BY_SLUG[publicSlugOrKey] ?? BY_KEY[publicSlugOrKey] ?? Package;
}
