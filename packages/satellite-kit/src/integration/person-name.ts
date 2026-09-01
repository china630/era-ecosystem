/**
 * Person name parts — canonical order: given name + patronymic + surname
 * (firstName + middleName + lastName). Shared by satellite-kit and MDM.
 */

export type PersonNameParts = {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
};

/** Display / MDM denorm order: given name, patronymic, surname. */
export function composePersonFullName(
  firstName?: string | null,
  middleName?: string | null,
  lastName?: string | null,
): string {
  return [firstName, middleName, lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Split a fullName blob into parts (EW / MDM given-first order).
 * 1 token → firstName; 2 → first + last; 3+ → first + middle(middle tokens) + last.
 * Particles like oglu/qizi stay inside middleName when they appear in the middle.
 */
export function splitFullNameToParts(
  fullName: string | null | undefined,
): PersonNameParts {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: null, middleName: null, lastName: null };
  }
  if (parts.length === 1) {
    return { firstName: parts[0]!, middleName: null, lastName: null };
  }
  if (parts.length === 2) {
    return { firstName: parts[0]!, middleName: null, lastName: parts[1]! };
  }
  return {
    firstName: parts[0]!,
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1]!,
  };
}

/**
 * Fill-not-clear per field: non-empty incoming writes the field;
 * empty / omit keeps existing. Recompose fullName from the merged parts.
 */
export function mergePersonNameParts(
  existing: PersonNameParts,
  incoming: Partial<PersonNameParts>,
): PersonNameParts & { fullName: string } {
  const nextFirst =
    incoming.firstName != null && incoming.firstName.trim()
      ? incoming.firstName.trim()
      : existing.firstName?.trim() || null;
  const nextMiddle =
    incoming.middleName != null && incoming.middleName.trim()
      ? incoming.middleName.trim()
      : existing.middleName?.trim() || null;
  const nextLast =
    incoming.lastName != null && incoming.lastName.trim()
      ? incoming.lastName.trim()
      : existing.lastName?.trim() || null;
  return {
    firstName: nextFirst,
    middleName: nextMiddle,
    lastName: nextLast,
    fullName: composePersonFullName(nextFirst, nextMiddle, nextLast),
  };
}

/** Normalize citizenship to ISO 3166-1 alpha-2, or null if OTHER/garbage (do not write). */
export function normalizeNationalityIso(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const s = raw.trim().toUpperCase();
  if (!s || s === "OTHER" || s === "UNKNOWN" || s === "N/A" || s === "NA") {
    return null;
  }
  if (/^[A-Z]{2}$/.test(s)) return s;
  return null;
}

/** True when resolve input has enough name to create/update. */
export function hasPersonNameInput(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): boolean {
  if (input.fullName?.trim()) return true;
  if (input.firstName?.trim() && input.lastName?.trim()) return true;
  return false;
}

/**
 * Normalize resolve name input: prefer explicit parts; else split fullName.
 * Returns null if neither parts nor fullName are usable.
 */
export function resolveIncomingNameParts(input: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): PersonNameParts | null {
  const first = input.firstName?.trim() || null;
  const middle = input.middleName?.trim() || null;
  const last = input.lastName?.trim() || null;
  if (first || last) {
    return { firstName: first, middleName: middle, lastName: last };
  }
  const blob = input.fullName?.trim();
  if (!blob) return null;
  return splitFullNameToParts(blob);
}
