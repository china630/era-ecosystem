import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Satellite entitlement gate — fail-closed. */
export async function requireAutoSatellite(organizationId: string): Promise<void> {
  const org = organizationId?.trim();
  if (!org) throw new IndustryModuleInactiveError("industry_auto_service");
  await requireSatelliteModule("industry_auto_service", { organizationId: org });
}
