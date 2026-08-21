import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Satellite entitlement gate — fail-closed. */
export async function requireWholesaleSatellite(): Promise<void> {
  await requireSatelliteModule("industry_wholesale");
}
