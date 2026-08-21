/** Clinic submodule keys — synced with orchestrator CLINIC_PRICING_MODULE_KEYS. */

export const CLINIC_PRICING_MODULE_KEYS = [
  "clinic_shell",
  "clinic_patients",
  "clinic_schedule",
  "clinic_appointments",
  "clinic_visit",
  "clinic_lab",
  "clinic_service_catalog",
  "clinic_notifications",
  "clinic_portal",
  "clinic_reschedule",
  "clinic_ehr",
  "clinic_lis_import",
  "clinic_insurance",
  "clinic_inpatient",
  "clinic_telehealth",
] as const;

export type ClinicPricingModuleKey = (typeof CLINIC_PRICING_MODULE_KEYS)[number];

export function isClinicModuleActive(
  activeModules: readonly string[],
  moduleKey: string,
): boolean {
  const set = new Set(activeModules.map((m) => m.trim()).filter(Boolean));
  return set.has(moduleKey);
}

/**
 * UI/API path prefix → required clinic module key.
 * Cron handlers map separately via runCronIfEntitled.
 */
export const CLINIC_MODULE_BY_ROUTE: Record<string, string> = {
  "/patients": "clinic_patients",
  "/api/patients": "clinic_patients",
  "/appointments": "clinic_appointments",
  "/api/appointments": "clinic_appointments",
  "/api/booking": "clinic_appointments",
  "/schedule": "clinic_schedule",
  "/api/schedule": "clinic_schedule",
  "/visits": "clinic_visit",
  "/api/visits": "clinic_visit",
  "/lab": "clinic_lab",
  "/api/lab-orders": "clinic_lab",
  "/api/lis": "clinic_lis_import",
  "/catalog": "clinic_service_catalog",
  "/api/catalog": "clinic_service_catalog",
  "/sanatorium": "clinic_inpatient",
  "/api/sanatorium": "clinic_inpatient",
  "/inpatient": "clinic_inpatient",
  "/api/inpatient": "clinic_inpatient",
  "/portal": "clinic_portal",
  "/telehealth": "clinic_telehealth",
  "/ehr": "clinic_ehr",
  "/insurance": "clinic_insurance",
};

export function resolveClinicModuleForPathname(pathname: string): string | null {
  const sorted = Object.keys(CLINIC_MODULE_BY_ROUTE).sort((a, b) => b.length - a.length);
  const prefix = sorted.find((p) => pathname === p || pathname.startsWith(`${p}/`));
  return prefix ? CLINIC_MODULE_BY_ROUTE[prefix]! : null;
}
