import {
  requireSatelliteModule,
  IndustryModuleInactiveError,
} from "@era/satellite-kit";

export { IndustryModuleInactiveError };

/** DBO channel gate — satellite or banking_dbo submodule, for the session org only. */
export async function requireDboSatellite(organizationId: string): Promise<void> {
  const org = organizationId?.trim();
  if (!org) throw new IndustryModuleInactiveError("banking_dbo");
  try {
    await requireSatelliteModule("banking_dbo", { organizationId: org });
  } catch {
    await requireSatelliteModule("industry_banking", { organizationId: org });
  }
}
