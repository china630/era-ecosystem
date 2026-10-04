import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Satellite entitlement gate — fail-closed. */
export async function requireWholesaleSatellite(organizationId: string): Promise<void> {
  const org = organizationId?.trim();
  if (!org) throw new IndustryModuleInactiveError("industry_wholesale");
  await requireSatelliteModule("industry_wholesale", { organizationId: org });
}
