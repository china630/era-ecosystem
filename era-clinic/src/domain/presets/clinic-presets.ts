export const CLINIC_PRESET = {
  OUTPATIENT: "outpatient",
  INPATIENT_DAY: "inpatient_day",
  SANATORIUM_CLINICAL: "sanatorium_clinical",
  WELLNESS: "wellness",
} as const;

export type ClinicPresetCode =
  (typeof CLINIC_PRESET)[keyof typeof CLINIC_PRESET];

export const ALL_CLINIC_PRESETS: ClinicPresetCode[] = Object.values(CLINIC_PRESET);

/** Routes requiring a specific preset (middleware + nav). */
export const PRESET_ROUTE_GUARDS: Record<string, ClinicPresetCode> = {
  "/sanatorium": CLINIC_PRESET.SANATORIUM_CLINICAL,
  "/sanatorium/resources": CLINIC_PRESET.SANATORIUM_CLINICAL,
  "/inpatient": CLINIC_PRESET.INPATIENT_DAY,
};

export function isClinicPreset(value: string): value is ClinicPresetCode {
  return ALL_CLINIC_PRESETS.includes(value as ClinicPresetCode);
}
