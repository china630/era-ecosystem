import {
  HOTEL_PRICING_MODULE_KEYS,
  isHotelModuleActive,
  type HotelPricingModuleKey,
} from "@era365/database";

export type HotelModuleEntitlements = Record<HotelPricingModuleKey, boolean>;

export function buildHotelModuleEntitlements(
  activeModules: readonly string[],
): HotelModuleEntitlements {
  const out = {} as HotelModuleEntitlements;
  for (const key of HOTEL_PRICING_MODULE_KEYS) {
    out[key] = isHotelModuleActive(activeModules, key);
  }
  return out;
}
