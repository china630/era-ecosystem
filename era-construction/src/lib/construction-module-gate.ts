import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Satellite entitlement gate — fail-closed. */
export async function requireConstructionSatellite(organizationId: string): Promise<void> {
  const org = organizationId?.trim();
  if (!org) throw new IndustryModuleInactiveError("industry_construction");
  await requireSatelliteModule("industry_construction", { organizationId: org });
}
