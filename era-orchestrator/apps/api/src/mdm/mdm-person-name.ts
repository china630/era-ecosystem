/**
 * MDM person name helpers.
 * Canonical implementation lives in `@era/satellite-kit` `integration/person-name`
 * (imported via package subpath — not the kit barrel — so Jest/Nest avoid jose).
 * Keep this file's re-exports in sync with that module.
 */

export {
  composePersonFullName,
  splitFullNameToParts,
  mergePersonNameParts,
  normalizeNationalityIso,
  hasPersonNameInput,
  resolveIncomingNameParts,
  type PersonNameParts,
} from "@era/satellite-kit/integration/person-name";

/** @deprecated Prefer mergePersonNameParts. Kept for back-compat unit tests. */
function foldPersonName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(name: string): string[] {
  return name.trim().split(/\s+/).filter(Boolean);
}

/** @deprecated Prefer mergePersonNameParts per-field fill-not-clear. */
export function mergeFullNameWithPatronymic(
  existing: string | null | undefined,
  incoming: string,
): string {
  const next = incoming.trim();
  const prev = (existing ?? "").trim();
  if (!prev) return next;
  if (!next) return prev;
  if (foldPersonName(prev) === foldPersonName(next)) return prev;
  if (tokens(next).length > tokens(prev).length) return next;
  return prev;
}
