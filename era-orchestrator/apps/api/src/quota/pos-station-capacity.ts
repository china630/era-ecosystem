import { CAPACITY_DRIVERS } from "@era365/database";

/** Billable ERA stations = outlets/registers with a till — never KKM device rows. */
export function posStationOverageUnits(
  billableStationCount: number,
  satelliteKey: string,
): number {
  const driver = CAPACITY_DRIVERS.find((d) => d.satelliteKey === satelliteKey);
  if (!driver) return 0;
  const included = driver.includedInGate;
  return Math.max(0, billableStationCount - included);
}

export function posStationUnitAzn(satelliteKey: string): number {
  const driver = CAPACITY_DRIVERS.find((d) => d.satelliteKey === satelliteKey);
  return driver?.unitAzn ?? 19;
}
