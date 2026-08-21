import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Satellite entitlement gate — fail-closed. */
export async function requireBankSatellite(): Promise<void> {
  await requireSatelliteModule("industry_banking");
}

/** Optional L2 banking_* submodule gate (BFF already maps modules via engine-client). */
export async function requireBankingModule(moduleKey: string): Promise<void> {
  await requireSatelliteModule(moduleKey);
}
