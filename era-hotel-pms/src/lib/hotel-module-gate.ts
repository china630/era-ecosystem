import {
  assertHotelModuleActive,
  IndustryModuleInactiveError,
} from '@era/satellite-kit';

export { IndustryModuleInactiveError };

/** Skip gate when org id is unset (local dev without CP wiring). */
export async function requireHotelModule(moduleKey: string): Promise<void> {
  const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();
  if (!organizationId) return;
  await assertHotelModuleActive(organizationId, moduleKey);
}
