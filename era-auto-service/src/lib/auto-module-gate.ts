import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Satellite entitlement gate — fail-closed. */
export async function requireAutoSatellite(): Promise<void> {
  await requireSatelliteModule("industry_auto_service");
}
