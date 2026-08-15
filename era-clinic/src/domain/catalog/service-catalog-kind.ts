import type { ServiceCatalogKind } from "@prisma/client";

/** Infer catalog kind for seed/import/backfill when kind is not explicit. */
export function inferServiceCatalogKind(
  code: string,
  department?: string | null,
): ServiceCatalogKind {
  const c = code.trim().toUpperCase();
  if (!c) return "OTHER";
  if (c.startsWith("SVC-")) return "PROCEDURE";
  if (department && department.trim()) return "PROCEDURE";
  if (c.startsWith("LAB-") || c.startsWith("LAB_")) return "LAB";
  if (
    c.startsWith("CT-") ||
    c.startsWith("MR-") ||
    c.startsWith("XR-") ||
    c.startsWith("US-") ||
    c.startsWith("USG") ||
    c.startsWith("ECG") ||
    c.startsWith("ECHO") ||
    c.startsWith("DXA") ||
    c.startsWith("ABPM") ||
    c.startsWith("AUDIO") ||
    c.startsWith("BRONCHO") ||
    c.startsWith("COLONO") ||
    c.startsWith("COLPO") ||
    c.startsWith("CORO") ||
    c.startsWith("CYSTO") ||
    c.startsWith("DERM") ||
    c.startsWith("ENDO") ||
    c.startsWith("EEG") ||
    c.startsWith("EMG") ||
    c.startsWith("HOLTER") ||
    c.startsWith("MAMMO") ||
    c.startsWith("PET") ||
    c.startsWith("SPIRO") ||
    c.startsWith("UROFLOW")
  ) {
    return "DIAGNOSTIC";
  }
  if (c.startsWith("VISIT-") || c === "CONSULT") return "VISIT";
  return "OTHER";
}

export function parseCatalogKindQuery(
  raw: string | null,
): ServiceCatalogKind[] | undefined {
  if (!raw?.trim()) return undefined;
  const allowed = new Set<string>([
    "PROCEDURE",
    "DIAGNOSTIC",
    "LAB",
    "VISIT",
    "OTHER",
  ]);
  const kinds = raw
    .split(",")
    .map((k) => k.trim().toUpperCase())
    .filter((k): k is ServiceCatalogKind => allowed.has(k));
  return kinds.length > 0 ? kinds : undefined;
}
