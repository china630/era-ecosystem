import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Satellite entitlement gate — fail-closed. */
export async function requireCrmSatellite(organizationId: string): Promise<void> {
  const org = organizationId?.trim();
  if (!org) throw new IndustryModuleInactiveError("industry_crm");
  await requireSatelliteModule("industry_crm", { organizationId: org });
}
