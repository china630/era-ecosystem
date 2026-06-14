import {

  FINANCE_TILE,

  hasIndustryModuleAccess,

  INDUSTRY_NAV_ITEMS,

  type IndustryModuleKey,

} from "@era/satellite-kit/platform/industry-modules";

import {

  WORKSPACE_SATELLITE_KEY,

  type WorkspaceSystemKey,

} from "@era/satellite-kit/platform/workspace-system-catalog";

import type { SubscriptionSnapshot } from "./subscription-context";



const FINANCE_MODULE_SLUGS = new Set([

  "foundation",

  "nas",

  "ifrs",

  "ifrs_mapping",

  "production",

  "manufacturing",

  "fixed_assets",

  "inventory",

  "hr_full",

  "audit_hub",

  "cash_bank_pro",

  "kassa_pro",

  "banking_pro",

]);



export type WorkspaceSystemStatus =

  | "active"

  | "not_connected"

  | "not_subscribed"

  | "read_only";



function isSatelliteConnected(

  snapshot: SubscriptionSnapshot,

  satelliteKey: string,

): boolean {

  const rows = snapshot.satelliteEntitlements;

  if (!Array.isArray(rows)) return false;

  return rows.some((r) => r.satelliteKey === satelliteKey);

}



export function workspaceSystemStatus(

  snapshot: SubscriptionSnapshot | null,

  key: WorkspaceSystemKey,

): WorkspaceSystemStatus {

  if (!snapshot) return "not_connected";

  if (snapshot.readOnly) return "read_only";



  const satelliteKey = WORKSPACE_SATELLITE_KEY[key];



  if (key === "FINANCE") {

    const mods = snapshot.activeModules ?? [];

    if (isSatelliteConnected(snapshot, satelliteKey)) return "active";

    if (mods.some((m) => FINANCE_MODULE_SLUGS.has(m))) return "active";

    if (snapshot.isTrial) return "not_connected";

    return "not_subscribed";

  }



  const industryKey = key as IndustryModuleKey;

  if (hasIndustryModuleAccess(snapshot, industryKey)) return "active";

  if (snapshot.isTrial && !isSatelliteConnected(snapshot, satelliteKey)) {

    return "not_connected";

  }

  return "not_subscribed";

}



export function industryNavItemForKey(key: WorkspaceSystemKey) {

  if (key === "FINANCE") return null;

  return INDUSTRY_NAV_ITEMS.find((i) => i.key === key) ?? null;

}



export function workspaceOpenHref(key: WorkspaceSystemKey): string | null {

  if (key === "FINANCE") return FINANCE_TILE.href;

  const item = industryNavItemForKey(key);

  return item?.href ?? null;

}



export function workspacePricingHref(pricingModuleKey: string): string {

  return `/pricing#${pricingModuleKey}`;

}



export function workspaceSatelliteKey(key: WorkspaceSystemKey): string {

  return WORKSPACE_SATELLITE_KEY[key];

}


