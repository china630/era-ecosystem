import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** Satellite entitlement gate — fail-closed. */
export async function requireLogisticsSatellite(): Promise<void> {
  await requireSatelliteModule("industry_logistics");
}
