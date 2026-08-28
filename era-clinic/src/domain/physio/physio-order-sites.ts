import { PhysioCatalogError } from "./physio-catalog";
import { BODY_PART_CODES } from "@/lib/body-part-codes";

export const PROCEDURE_SITE_APPLY_MODES = ["TOGETHER", "TURN"] as const;
export type ProcedureSiteApplyModeCode = (typeof PROCEDURE_SITE_APPLY_MODES)[number];

const COARSE_SET = new Set<string>(BODY_PART_CODES);

export function uniqueOrderedIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Single ProcedureOrder.bodyPart for rotation / silhouette.
 * Site order preserved; FULL_BODY wins if any selected S rolls up to it.
 */
export function deriveCoarseBodyPart(sites: { coarse: string[] }[]): string | null {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const site of sites) {
    for (const raw of site.coarse) {
      const code = raw.trim().toUpperCase();
      if (!code || !COARSE_SET.has(code) || seen.has(code)) continue;
      seen.add(code);
      ordered.push(code);
    }
  }
  if (ordered.length === 0) return null;
  if (ordered.includes("FULL_BODY")) return "FULL_BODY";
  return ordered[0] ?? null;
}

export function resolveSiteApplyMode(
  siteCount: number,
  requested?: string | null,
): ProcedureSiteApplyModeCode | null {
  if (siteCount < 2) return null;
  if (requested === "TURN" || requested === "TOGETHER") return requested;
  return "TOGETHER";
}

export function parseApplyMode(raw: string | null | undefined): ProcedureSiteApplyModeCode | null {
  if (raw == null || raw === "") return null;
  if (raw === "TURN" || raw === "TOGETHER") return raw;
  throw new PhysioCatalogError("siteApplyMode must be TOGETHER or TURN");
}
