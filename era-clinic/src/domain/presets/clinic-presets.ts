export const CLINIC_PRESET = {
  OUTPATIENT: "outpatient",
  INPATIENT_DAY: "inpatient_day",
  SANATORIUM_CLINICAL: "sanatorium_clinical",
  WELLNESS: "wellness",
} as const;

export type ClinicPresetCode =
  (typeof CLINIC_PRESET)[keyof typeof CLINIC_PRESET];

export const ALL_CLINIC_PRESETS: ClinicPresetCode[] = Object.values(CLINIC_PRESET);

/** Routes requiring one of these presets (middleware + nav). Any match is enough. */
export function presetsRequiredForPath(pathname: string): ClinicPresetCode[] | null {
  const path = pathname.split("?")[0] ?? pathname;
  const is = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  if (is("/appointments")) {
    return [CLINIC_PRESET.OUTPATIENT, CLINIC_PRESET.SANATORIUM_CLINICAL];
  }
  if (is("/reception/queue") || is("/cashier") || is("/doctor")) {
    return [CLINIC_PRESET.OUTPATIENT];
  }
  if (
    is("/reception/extra-tickets") ||
    is("/nurse") ||
    is("/check-in") ||
    is("/reports/procedures") ||
    is("/sanatorium") ||
    is("/admin/program-templates") ||
    is("/admin/procedure-rules") ||
    is("/admin/physio-sites") ||
    is("/admin/lookups") ||
    is("/admin/import")
  ) {
    return [CLINIC_PRESET.SANATORIUM_CLINICAL];
  }
  if (is("/inpatient") || is("/admin/wards")) {
    return [CLINIC_PRESET.INPATIENT_DAY];
  }
  return null;
}

export function isClinicPreset(value: string): value is ClinicPresetCode {
  return ALL_CLINIC_PRESETS.includes(value as ClinicPresetCode);
}
