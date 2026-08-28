import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Retail has no submodule catalog — satellite gate only. */
export async function requireRetailSatellite(organizationId?: string): Promise<void> {
  const org = organizationId?.trim();
  if (org) {
    await requireSatelliteModule("industry_retail", { organizationId: org });
    return;
  }
  await requireSatelliteModule("industry_retail");
}
