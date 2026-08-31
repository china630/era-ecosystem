export type PatientNameParts = {
  givenName: string;
  surname: string;
  fatherName?: string | null;
};

/** Denormalized display + search string: Ad [Ata] Soyad. */
export function composeFullName(parts: PatientNameParts): string {
  const given = parts.givenName?.trim() ?? "";
  const father = parts.fatherName?.trim() ?? "";
  const surname = parts.surname?.trim() ?? "";
  return [given, father, surname].filter(Boolean).join(" ").trim();
}

export function formatPatientRefCode(seq: number): string {
  return `P-${String(seq).padStart(6, "0")}`;
}

export function isLegacyExternalPatientRefCode(refCode: string): boolean {
  const c = refCode.trim();
  return (
    /^wo[-:]patient[-:]/i.test(c) ||
    /^WALKIN-/i.test(c) ||
    /^HOTEL-/i.test(c) ||
    /^MDM-/i.test(c)
  );
}

export function isClinicPatientRefCode(refCode: string): boolean {
  return /^P-\d{6,}$/i.test(refCode.trim());
}

/** Map legacy display codes back to cutover externalRef when possible. */
export function legacyRefCodeToExternalRef(refCode: string): string | null {
  const c = refCode.trim();
  const m = c.match(/^wo[-:]patient[-:](\d+)$/i);
  if (m) return `wo:patient:${m[1]}`;
  if (/^wo:patient:/i.test(c)) return c.toLowerCase().startsWith("wo:") ? c : null;
  return null;
}
