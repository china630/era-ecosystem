import {
  IndustryModuleInactiveError,
  requireSatelliteModule,
} from '@era/satellite-kit';

export const SANATORIUM_MODULE_KEY = 'hotel_medical_sanatorium';

/** True when the org has Medical & Sanatorium entitled (or DEV unlock). */
export async function isSanatoriumModuleActive(organizationId: string): Promise<boolean> {
  const org = organizationId?.trim();
  if (!org) return false;
  try {
    await requireSatelliteModule(SANATORIUM_MODULE_KEY, { organizationId: org });
    return true;
  } catch (err) {
    if (err instanceof IndustryModuleInactiveError) return false;
    throw err;
  }
}

export async function requireSanatoriumModule(organizationId: string): Promise<void> {
  await requireSatelliteModule(SANATORIUM_MODULE_KEY, {
    organizationId: organizationId.trim(),
  });
}
