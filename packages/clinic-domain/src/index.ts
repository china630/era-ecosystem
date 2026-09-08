export const CLINIC_PRESET = {
  OUTPATIENT: "outpatient",
  INPATIENT_DAY: "inpatient_day",
  SANATORIUM_CLINICAL: "sanatorium_clinical",
  WELLNESS: "wellness",
} as const;

export type ClinicPresetCode =
  (typeof CLINIC_PRESET)[keyof typeof CLINIC_PRESET];

export function isClinicPreset(value: string): value is ClinicPresetCode {
  return Object.values(CLINIC_PRESET).includes(value as ClinicPresetCode);
}

export function patientHasMdmIdentifier(input: {
  finCode?: string | null;
  passportNumber?: string | null;
  issuingCountry?: string | null;
}): boolean {
  if (input.finCode?.trim()) return true;
  if (input.passportNumber?.trim() && input.issuingCountry?.trim()) return true;
  return false;
}

export function canAssignBed(bedStatus: string, hasActiveAssignment: boolean): boolean {
  return bedStatus === "AVAILABLE" && !hasActiveAssignment;
}

export function wardDayChargeReference(admissionId: string, chargeDate: string): string {
  return `ward-day:${admissionId}:${chargeDate}`;
}

export {
  localizedCatalogDescription,
  type CatalogDescriptionFields,
} from "./localized-catalog-description";
