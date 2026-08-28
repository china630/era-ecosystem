/**
 * MDM person-core sex/DOB helpers.
 * Keep in sync with `packages/satellite-kit/src/integration/person-sex.ts`.
 * Local copy so Nest/Jest MDM tests do not load the satellite-kit barrel (jose ESM).
 */

export const PERSON_SEX_VALUES = ["MALE", "FEMALE", "UNKNOWN"] as const;
export type PersonSex = (typeof PERSON_SEX_VALUES)[number];

function foldSexToken(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ə/g, "E")
    .replace(/\./g, "");
}

export function normalizePersonSex(raw: unknown): PersonSex | undefined {
  if (raw == null) return undefined;
  const s = foldSexToken(String(raw));
  if (!s) return undefined;
  if (s === "M" || s === "MALE" || s === "MAN" || s === "BAY" || s === "MR" || s === "KISI") {
    return "MALE";
  }
  if (
    s === "F" ||
    s === "FEMALE" ||
    s === "WOMAN" ||
    s === "XANIM" ||
    s === "MRS" ||
    s === "MS" ||
    s === "MISS" ||
    s === "QADIN"
  ) {
    return "FEMALE";
  }
  if (s === "UNKNOWN" || s === "OTHER" || s === "X" || s === "NA" || s === "N/A") {
    return "UNKNOWN";
  }
  return undefined;
}

export function parsePersonBirthDate(raw: unknown): Date | undefined {
  if (raw == null || raw === "") return undefined;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(Date.UTC(raw.getFullYear(), raw.getMonth(), raw.getDate()));
  }
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return undefined;
  return d;
}

export function formatPersonBirthDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function personCoreDemographicsWrite(input: {
  sex?: unknown;
  gender?: unknown;
  birthDate?: unknown;
  existingSex?: PersonSex | string | null;
}): { sex?: PersonSex; birthDate?: Date } {
  const next = normalizePersonSex(input.sex ?? input.gender);
  const birthDate = parsePersonBirthDate(input.birthDate);
  const existing = normalizePersonSex(input.existingSex);
  const out: { sex?: PersonSex; birthDate?: Date } = {};
  if (next === "MALE" || next === "FEMALE") {
    out.sex = next;
  } else if (next === "UNKNOWN" && (!existing || existing === "UNKNOWN")) {
    out.sex = "UNKNOWN";
  }
  if (birthDate) out.birthDate = birthDate;
  return out;
}
