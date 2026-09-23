/** Clinic submodule keys — synced with orchestrator CLINIC_PRICING_MODULE_KEYS. */

export const CLINIC_PRICING_MODULE_KEYS = [
  "clinic_registry_emr",
  "clinic_lab",
  "clinic_sanatorium",
  "clinic_nurse_roster",
  "clinic_inpatient",
  "clinic_telehealth",
  "clinic_insurance",
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
 * UI/API path prefix → required clinic or platform module key.
 * Gate-only screens (schedule, appointments, catalog) are omitted — satellite gate is enough.
 * Cron handlers map separately via runCronIfEntitled.
 */
export const CLINIC_MODULE_BY_ROUTE: Record<string, string> = {
  "/patients": "clinic_registry_emr",
  "/api/patients": "clinic_registry_emr",
  "/visits": "clinic_registry_emr",
  "/api/visits": "clinic_registry_emr",
  "/doctor": "clinic_registry_emr",
  "/ehr": "clinic_registry_emr",
  "/print/visit-exam": "clinic_registry_emr",
  "/api/reports/diagnoses": "clinic_registry_emr",
  "/lab-orders": "clinic_lab",
  "/lab": "clinic_lab",
  "/api/lab-orders": "clinic_lab",
  "/api/lab": "clinic_lab",
  "/api/lis": "clinic_lab",
  "/api/admin/lis-profiles": "clinic_lab",
  "/admin/lis-profiles": "clinic_lab",
  "/print/lab-order": "clinic_lab",
  "/nurse": "clinic_nurse_roster",
  "/api/nurse": "clinic_nurse_roster",
  "/sanatorium/nurse-roster": "clinic_nurse_roster",
  "/api/sanatorium/nurse-roster": "clinic_nurse_roster",
  "/admin/program-templates": "clinic_sanatorium",
  "/api/admin/program-templates": "clinic_sanatorium",
  "/sanatorium": "clinic_sanatorium",
  "/api/sanatorium": "clinic_sanatorium",
  "/inpatient": "clinic_inpatient",
  "/api/inpatient": "clinic_inpatient",
  "/admin/wards": "clinic_inpatient",
  "/api/admin/wards": "clinic_inpatient",
  "/api/admin/beds": "clinic_inpatient",
  "/portal": "platform_portal",
  "/api/portal": "platform_portal",
  "/telehealth": "clinic_telehealth",
  "/insurance": "clinic_insurance",
  "/api/insurance": "clinic_insurance",
  "/api/cron/episode-walkin-close": "clinic_sanatorium",
  "/api/cron/appointment-reminders": "platform_notifications",
  "/api/cron/inpatient-daily-charges": "clinic_inpatient",
};

/** Cabinet drag on the appointment board. Creating an appointment stays on the gate. */
const APPOINTMENT_RESCHEDULE = /^\/api\/appointments\/[^/]+\/reschedule\/?$/;

export function resolveClinicModuleForPathname(pathname: string): string | null {
  const path = pathname.split("?")[0] ?? pathname;
  if (APPOINTMENT_RESCHEDULE.test(path)) return "clinic_registry_emr";
  const sorted = Object.keys(CLINIC_MODULE_BY_ROUTE).sort((a, b) => b.length - a.length);
  const prefix = sorted.find((p) => path === p || path.startsWith(`${p}/`));
  return prefix ? CLINIC_MODULE_BY_ROUTE[prefix]! : null;
}
