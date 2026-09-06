/** Human-readable practitioner line: "Terapevt - Full Name". */
export function formatPractitionerLabel(
  specialty: string | null | undefined,
  fullName: string,
): string {
  const name = fullName.trim();
  const spec = specialty?.trim();
  if (spec && name) return `${spec} - ${name}`;
  return name || spec || "—";
}

export type PractitionerAuthorRef = {
  fullName: string;
  specialty: string | null;
} | null;

export function authorLabelFrom(ref: PractitionerAuthorRef): string | null {
  if (!ref?.fullName?.trim()) return null;
  return formatPractitionerLabel(ref.specialty, ref.fullName);
}
