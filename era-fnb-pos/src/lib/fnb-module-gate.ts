import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** F&B has no submodule catalog — satellite gate only. */
export async function requireFnbSatellite(organizationId?: string): Promise<void> {
  const org = organizationId?.trim();
  if (org) {
    await requireSatelliteModule("industry_fnb_pos", { organizationId: org });
    return;
  }
  await requireSatelliteModule("industry_fnb_pos");
}
