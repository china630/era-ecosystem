import {
  CLINIC_PRESET,
  isClinicPreset,
  type ClinicPresetCode,
} from "@/domain/presets/clinic-presets";

export const PRESETS_COOKIE = "era_clinic_presets";

export function serializePresetsCookie(presets: ClinicPresetCode[]): string {
  return presets.join(",");
}

export function parsePresetsCookie(raw: string | undefined | null): ClinicPresetCode[] {
  if (!raw?.trim()) return [CLINIC_PRESET.OUTPATIENT];
  const parsed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(isClinicPreset);
  return parsed.length > 0 ? parsed : [CLINIC_PRESET.OUTPATIENT];
}

export function pathnameRequiresPreset(pathname: string): ClinicPresetCode | null {
  if (pathname === "/sanatorium" || pathname.startsWith("/sanatorium/")) {
    return CLINIC_PRESET.SANATORIUM_CLINICAL;
  }
  if (pathname === "/inpatient" || pathname.startsWith("/inpatient/")) {
    return CLINIC_PRESET.INPATIENT_DAY;
  }
  return null;
}

export function hasPresetInList(
  enabled: ClinicPresetCode[],
  required: ClinicPresetCode,
): boolean {
  return enabled.includes(required);
}
