import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Satellite entitlement gate — fail-closed. */
export async function requireBankSatellite(organizationId: string): Promise<void> {
  const org = organizationId?.trim();
  if (!org) throw new IndustryModuleInactiveError("industry_banking");
  await requireSatelliteModule("industry_banking", { organizationId: org });
}

/** Optional L2 banking_* submodule gate (BFF already maps modules via engine-client). */
export async function requireBankingModule(
  moduleKey: string,
  organizationId: string,
): Promise<void> {
  const org = organizationId?.trim();
  if (!org) throw new IndustryModuleInactiveError(moduleKey);
  await requireSatelliteModule(moduleKey, { organizationId: org });
}
