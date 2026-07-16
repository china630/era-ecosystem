/** Age in full years from a calendar birth date (UTC date parts). */
export function ageYearsFromBirthDate(
  birthDate: Date | string | null | undefined,
  asOf: Date = new Date(),
): number | null {
  if (birthDate == null || birthDate === "") return null;
  const d = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (Number.isNaN(d.getTime())) return null;
  let age = asOf.getUTCFullYear() - d.getUTCFullYear();
  const monthDelta = asOf.getUTCMonth() - d.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getUTCDate() < d.getUTCDate())) {
    age -= 1;
  }
  return age < 0 ? null : age;
}

/** Normalize HTML date input / ISO to UTC midnight Date for Prisma `@db.Date`. */
export function parseBirthDateInput(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(y, mo - 1, day));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

export function birthDateToInputValue(birthDate: Date | string | null | undefined): string {
  if (birthDate == null) return "";
  const d = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}
