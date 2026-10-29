/**
 * Per-outlet operational profile (nav + route gates).
 * Canon: docs/adr/fnb-outlet-capabilities-and-gate.md
 */

export const OUTLET_SHAPE_HINTS = [
  "cafe",
  "restaurant",
  "buffet_kitchen",
  "disco",
] as const;
export type OutletShapeHint = (typeof OUTLET_SHAPE_HINTS)[number];

export type OutletCapabilities = {
  till: boolean;
  tables: boolean;
  buffetPlanner: boolean;
  shapeHint: OutletShapeHint | null;
};

export function defaultCapabilitiesForShape(
  shape: OutletShapeHint,
): OutletCapabilities {
  switch (shape) {
    case "cafe":
      return { till: true, tables: true, buffetPlanner: false, shapeHint: "cafe" };
    case "restaurant":
      return {
        till: true,
        tables: true,
        buffetPlanner: true,
        shapeHint: "restaurant",
      };
    case "buffet_kitchen":
      return {
        till: false,
        tables: false,
        buffetPlanner: true,
        shapeHint: "buffet_kitchen",
      };
    case "disco":
      return { till: true, tables: false, buffetPlanner: false, shapeHint: "disco" };
    default:
      return { till: true, tables: true, buffetPlanner: false, shapeHint: null };
  }
}

/** Infer shape from outlet code when shape_hint is null (migration backfill). */
export function inferShapeFromCode(code: string): OutletShapeHint | null {
  const c = code.trim().toUpperCase();
  if (c === "KAFE" || c === "XUDMANI" || c === "HOODMANI" || c === "HUDMANI") {
    return "cafe";
  }
  if (c === "NAFTANI" || c === "RESTAURANT") return "restaurant";
  if (c === "BUFFET") return "buffet_kitchen";
  if (c === "DISCO") return "disco";
  return null;
}

export function capabilitiesFromOutletRow(row: {
  code: string;
  capTill?: boolean;
  capTables?: boolean;
  capBuffetPlanner?: boolean;
  shapeHint?: string | null;
}): OutletCapabilities {
  const hintRaw = row.shapeHint?.trim() || null;
  const hint =
    hintRaw && (OUTLET_SHAPE_HINTS as readonly string[]).includes(hintRaw)
      ? (hintRaw as OutletShapeHint)
      : inferShapeFromCode(row.code);
  if (
    row.capTill === undefined &&
    row.capTables === undefined &&
    row.capBuffetPlanner === undefined &&
    !row.shapeHint
  ) {
    return hint
      ? defaultCapabilitiesForShape(hint)
      : { till: true, tables: true, buffetPlanner: false, shapeHint: null };
  }
  return {
    till: row.capTill !== false,
    tables: row.capTables !== false,
    buffetPlanner: row.capBuffetPlanner === true,
    shapeHint: hint,
  };
}

export function homePathForCapabilities(caps: OutletCapabilities): string {
  if (caps.till) return "/floor";
  if (caps.buffetPlanner) return "/admin/buffet";
  return "/";
}

/** Till / floor / shift APIs — buffet kitchen and similar must not open POS. */
export function outletAllowsTill(row: {
  code: string;
  capTill?: boolean;
  capTables?: boolean;
  capBuffetPlanner?: boolean;
  shapeHint?: string | null;
}): boolean {
  return capabilitiesFromOutletRow(row).till;
}
