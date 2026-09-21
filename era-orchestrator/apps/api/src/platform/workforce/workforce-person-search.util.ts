/**
 * Shared Workforce person search for employments list + holding directory.
 * FIN → exact finBlindIndex; name → substring on decrypted MDM name parts.
 * Never matches UUID, staffCode, or finMasked.
 */

export const WORKFORCE_FIN_PATTERN = /^[0-9A-HJ-NP-Za-hj-np-z]{7}$/;

export type WorkforceAgeBucket =
  | "18-25"
  | "26-35"
  | "36-45"
  | "46-55"
  | "56-59"
  | "60+";

export type PersonNameParts = {
  displayName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  sex?: string | null;
  birthDate?: string | null;
};

export function isWorkforceFinQuery(q: string): boolean {
  return WORKFORCE_FIN_PATTERN.test(q.trim().toUpperCase());
}

export function personMatchesNameQuery(
  profile: PersonNameParts | null | undefined,
  qLower: string,
): boolean {
  if (!profile || !qLower) return false;
  const hay = [
    profile.displayName,
    profile.firstName,
    profile.middleName,
    profile.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(qLower);
}

/** Age in Asia/Baku calendar days (matches CP employments UI). */
export function ageInBaku(birthDateIso: string | null | undefined): number | null {
  if (!birthDateIso) return null;
  const parts = birthDateIso.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [ty, tm, td] = todayStr.split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age >= 0 ? age : null;
}

export function ageBucketFromBirth(
  birthDateIso: string | null | undefined,
): WorkforceAgeBucket | null {
  const age = ageInBaku(birthDateIso);
  if (age == null || age < 18) return null;
  if (age <= 25) return "18-25";
  if (age <= 35) return "26-35";
  if (age <= 45) return "36-45";
  if (age <= 55) return "46-55";
  if (age <= 59) return "56-59";
  return "60+";
}

export function personMatchesSexAge(
  profile: PersonNameParts | null | undefined,
  sex?: string,
  ageBucket?: string,
): boolean {
  if (sex) {
    const pSex = profile?.sex ?? "UNKNOWN";
    if (pSex !== sex) return false;
  }
  if (ageBucket) {
    if (ageBucketFromBirth(profile?.birthDate ?? null) !== ageBucket) {
      return false;
    }
  }
  return true;
}
