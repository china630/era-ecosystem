import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Retail has no submodule catalog — satellite gate only. */
export async function requireRetailSatellite(): Promise<void> {
  await requireSatelliteModule("industry_retail");
}
