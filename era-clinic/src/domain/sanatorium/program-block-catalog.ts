/**
 * Admin entitlement-block catalog cascade: kind selects source + fulfillment.
 */

export type ProgramBlockKind =
  | "PHYSIO"
  | "BATH"
  | "PARAFFIN"
  | "LAB"
  | "EXAM"
  | "CUSTOM";

export type ProgramBlockFulfillment = "PROCEDURE_ORDER" | "LAB_ORDER" | "VISIT";

export type CatalogSku = { code: string; name: string };

function foldHay(s: string): string {
  return s
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");
}

export function fulfillmentFromKind(
  kind: ProgramBlockKind | null | undefined,
): ProgramBlockFulfillment {
  if (kind === "LAB") return "LAB_ORDER";
  if (kind === "EXAM") return "VISIT";
  return "PROCEDURE_ORDER";
}

export function isPoolOrAliasCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  if (!c) return false;
  if (c.endsWith("_POOL") || c.endsWith("_BLOCK")) return true;
  if (c === "NAFTALAN_BATH" || c === "NAFTALAN") return true;
  return false;
}

/** Treatment ProcedureType family for PHYSIO / BATH / PARAFFIN pickers. */
export function treatmentFamily(
  code: string,
  name: string,
): "PARAFFIN" | "BATH" | "PHYSIO" {
  const hay = foldHay(`${code} ${name}`);
  if (/parafin|paraffin/.test(hay)) return "PARAFFIN";
  if (/naftalan/.test(hay) || (/\bvann/.test(hay) && !/parafin/.test(hay))) {
    return "BATH";
  }
  if (/\bbath\b/.test(hay) && !/parafin/.test(hay)) return "BATH";
  return "PHYSIO";
}

export function filterTreatmentSkus(
  kind: "PHYSIO" | "BATH" | "PARAFFIN",
  types: CatalogSku[],
): CatalogSku[] {
  return types.filter((t) => {
    if (isPoolOrAliasCode(t.code)) return false;
    return treatmentFamily(t.code, t.name) === kind;
  });
}

const CUSTOM_QUERY_MIN = 2;

export function filterCustomSkus(query: string, types: CatalogSku[]): CatalogSku[] {
  const q = query.trim().toLowerCase();
  if (q.length < CUSTOM_QUERY_MIN) return [];
  return types.filter(
    (t) =>
      t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
  );
}

export { CUSTOM_QUERY_MIN };
