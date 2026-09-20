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
  "clinic_nurse_roster",
  "clinic_registry_emr",
  "clinic_sanatorium_clinical",
] as const;

export type ClinicPricingModuleKey = (typeof CLINIC_PRICING_MODULE_KEYS)[number];

const CLINIC_FEATURE_PARENTS: Readonly<Record<string, readonly string[]>> = {
  clinic_patients: ["clinic_registry_emr"],
  clinic_visit: ["clinic_registry_emr"],
  clinic_ehr: ["clinic_registry_emr"],
  clinic_reschedule: ["clinic_registry_emr"],
  clinic_lis_import: ["clinic_lab"],
};

export function isClinicModuleActive(
  activeModules: readonly string[],
  moduleKey: string,
): boolean {
  const set = new Set(activeModules.map((m) => m.trim()).filter(Boolean));
  if (set.has(moduleKey)) return true;
  for (const parent of CLINIC_FEATURE_PARENTS[moduleKey] ?? []) {
    if (set.has(parent)) return true;
  }
  if (moduleKey === "clinic_sanatorium_clinical" && set.has("clinic_inpatient")) {
    return true;
  }
  return false;
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
  "/sanatorium/nurse-roster": "clinic_nurse_roster",
  "/sanatorium": "clinic_sanatorium_clinical",
  "/api/sanatorium": "clinic_sanatorium_clinical",
  "/inpatient": "clinic_inpatient",
  "/api/inpatient": "clinic_inpatient",
  "/portal": "clinic_portal",
  "/telehealth": "clinic_telehealth",
  "/ehr": "clinic_ehr",
  "/insurance": "clinic_insurance",
  "/api/cron/procedure-auto-complete": "clinic_appointments",
  "/api/cron/procedure-no-show-sweep": "clinic_appointments",
  "/api/cron/episode-walkin-close": "clinic_inpatient",
  "/api/cron/appointment-reminders": "clinic_notifications",
  "/api/cron/inpatient-daily-charges": "clinic_inpatient",
  "/api/cron/catalog-sync": "clinic_service_catalog",
};

export function resolveClinicModuleForPathname(pathname: string): string | null {
  const sorted = Object.keys(CLINIC_MODULE_BY_ROUTE).sort((a, b) => b.length - a.length);
  const prefix = sorted.find((p) => pathname === p || pathname.startsWith(`${p}/`));
  return prefix ? CLINIC_MODULE_BY_ROUTE[prefix]! : null;
}
