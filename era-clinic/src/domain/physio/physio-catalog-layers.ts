/**
 * Merge satellite base physio zones + Nafta overlay → matcher catalog shape.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { NahiyeMatchCatalog } from "./nahiye-match";

export type PhysioZonesBaseJson = {
  sources?: unknown;
  notes?: string[];
  zones?: Array<Record<string, unknown> & { code: string; woAliases?: string[] }>;
};

export type PhysioZonesOverlayJson = {
  siteAliases?: Array<{ code: string; woAliases?: string[] }>;
  orderFieldsNotZones?: NahiyeMatchCatalog["orderFieldsNotZones"];
  matchRules?: NahiyeMatchCatalog["matchRules"];
  compositeMaps?: NahiyeMatchCatalog["compositeMaps"];
  closedDecisions?: unknown;
  naftaResourceSketch?: unknown;
};

export function mergePhysioZonesCatalog(
  base: PhysioZonesBaseJson,
  overlay: PhysioZonesOverlayJson,
): NahiyeMatchCatalog & Record<string, unknown> {
  const aliasByCode = new Map(
    (overlay.siteAliases || []).map((a) => [a.code, a.woAliases || []]),
  );
  return {
    id: "physio-zones-s-merged",
    layer: "merged",
    notProductSoR: true,
    sources: base.sources,
    notes: base.notes,
    orderFieldsNotZones: overlay.orderFieldsNotZones ?? [],
    zones: (base.zones || []).map((z) => ({
      ...z,
      woAliases: aliasByCode.get(z.code) || z.woAliases || [],
    })),
    closedDecisions: overlay.closedDecisions ?? [],
    matchRules: overlay.matchRules ?? {},
    compositeMaps: overlay.compositeMaps ?? [],
    naftaResourceSketch: overlay.naftaResourceSketch ?? null,
  };
}

export function loadMergedPhysioZonesCatalog(cwd = process.cwd()): NahiyeMatchCatalog {
  const root = join(cwd, "prisma", "seed-data");
  const basePath = join(root, "base", "physio-zones-s.json");
  const overlayPath = join(root, "nafta", "physio-zones-overlay.json");
  const legacyMerged = join(root, "nafta", "physio-zones-s.json");
  if (existsSync(basePath) && existsSync(overlayPath)) {
    return mergePhysioZonesCatalog(
      JSON.parse(readFileSync(basePath, "utf8")) as PhysioZonesBaseJson,
      JSON.parse(readFileSync(overlayPath, "utf8")) as PhysioZonesOverlayJson,
    ) as NahiyeMatchCatalog;
  }
  return JSON.parse(readFileSync(legacyMerged, "utf8")) as NahiyeMatchCatalog;
}
