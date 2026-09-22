import { bakuYmd } from "@era/satellite-kit/time";

/** Age in full years from a calendar birth date vs Asia/Baku “as of”. */
export function ageYearsFromBirthDate(
  birthDate: Date | string | null | undefined,
  asOf: Date = new Date(),
): number | null {
  if (birthDate == null || birthDate === "") return null;
  const d = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (Number.isNaN(d.getTime())) return null;
  const asOfParts = bakuYmd(asOf);
  const by = d.getUTCFullYear();
  const bm = d.getUTCMonth() + 1;
  const bd = d.getUTCDate();
  let age = asOfParts.y - by;
  if (asOfParts.m < bm || (asOfParts.m === bm && asOfParts.day < bd)) {
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

export function birthDateToInputValue(value: Date | string | null | undefined): string {
  if (value == null || value === "") return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
