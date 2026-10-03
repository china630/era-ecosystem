import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Retail has no submodule catalog — satellite gate only. */
export async function requireRetailSatellite(organizationId: string): Promise<void> {
  const org = organizationId?.trim();
  if (!org) throw new IndustryModuleInactiveError("industry_retail");
  await requireSatelliteModule("industry_retail", { organizationId: org });
}
