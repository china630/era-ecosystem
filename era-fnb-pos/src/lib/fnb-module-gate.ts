import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** F&B has no submodule catalog — satellite gate only. */
export async function requireFnbSatellite(): Promise<void> {
  await requireSatelliteModule("industry_fnb_pos");
}
