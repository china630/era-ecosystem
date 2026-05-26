/**
 * Re-export from @era/satellite-kit — canonical config lives on control plane (SP9).
 * Finance no longer hosts industry launcher UI.
 */
import type { EarlyAccessModuleKey } from "../components/early-access/modules.config";
import type { SubscriptionSnapshot } from "./subscription-context";

export {
  INDUSTRY_MODULE_SLUGS,
  INDUSTRY_NAV_ITEMS,
  industryItemByVertical,
  satelliteUrlForItem,
  type IndustryModuleSlug,
} from "@era/satellite-kit";

import {
  hasIndustryModuleAccess as hasIndustryModuleAccessBase,
  type IndustryModuleKey,
  type SubscriptionModulesSnapshot,
} from "@era/satellite-kit";

export function hasIndustryModuleAccess(
  snap: SubscriptionSnapshot | null,
  key: EarlyAccessModuleKey,
): boolean {
  return hasIndustryModuleAccessBase(
    snap as SubscriptionModulesSnapshot | null,
    key as IndustryModuleKey,
  );
}
