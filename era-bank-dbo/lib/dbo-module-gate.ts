import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** DBO channel gate — satellite or banking_dbo submodule. */
export async function requireDboSatellite(): Promise<void> {
  try {
    await requireSatelliteModule("banking_dbo");
  } catch {
    await requireSatelliteModule("industry_banking");
  }
}
