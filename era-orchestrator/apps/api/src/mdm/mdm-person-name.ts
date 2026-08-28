/**
 * MDM fullName fill-not-clear for patronymic.
 * Keep in sync with era-hotel-pms/src/lib/person-documents.ts mergeFullNameWithPatronymic.
 */

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
