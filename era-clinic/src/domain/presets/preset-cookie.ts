import {
  CLINIC_PRESET,
  isClinicPreset,
  presetsRequiredForPath,
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

export function pathnameRequiresPreset(pathname: string): ClinicPresetCode[] | null {
  return presetsRequiredForPath(pathname);
}

export function hasPresetInList(
  enabled: ClinicPresetCode[],
  required: ClinicPresetCode | ClinicPresetCode[],
): boolean {
  const need = Array.isArray(required) ? required : [required];
  return need.some((code) => enabled.includes(code));
}
