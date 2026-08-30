/**
 * Merge satellite base physio zones + Nafta overlay → matcher catalog shape.
 * CJS twin of domain helper for cutover scripts / coverage CLI.
 */
"use strict";

const fs = require("fs");
const path = require("path");

function seedDataRoot(cwd = process.cwd()) {
  return path.join(cwd, "prisma", "seed-data");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function mergePhysioZonesCatalog(base, overlay) {
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

function loadMergedPhysioZonesCatalog(cwd = process.cwd()) {
  const root = seedDataRoot(cwd);
  const basePath = path.join(root, "base", "physio-zones-s.json");
  const overlayPath = path.join(root, "nafta", "physio-zones-overlay.json");
  const legacyMerged = path.join(root, "nafta", "physio-zones-s.json");
  if (fs.existsSync(basePath) && fs.existsSync(overlayPath)) {
    return mergePhysioZonesCatalog(readJson(basePath), readJson(overlayPath));
  }
  return readJson(legacyMerged);
}

module.exports = {
  mergePhysioZonesCatalog,
  loadMergedPhysioZonesCatalog,
  seedDataRoot,
};
