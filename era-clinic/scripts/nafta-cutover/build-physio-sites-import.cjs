"use strict";

/**
 * Bake READY #17 from physio seed JSON (base zones + Nafta WO aliases).
 * Runtime SoR after Apply/seed is SatAdmin DB — this book is the wizard snapshot.
 *
 *   node era-clinic/scripts/nafta-cutover/build-physio-sites-import.cjs
 */

const fs = require("fs");
const path = require("path");
const { HEADERS, FILES } = (() => {
  const map = require("./map.cjs");
  const pack = require("./pack-layout.cjs");
  return { HEADERS: map.HEADERS, FILES: pack.FILES };
})();

const READY = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");
const SEED = path.join(__dirname, "../../prisma/seed-data");

function loadXlsx() {
  const candidates = [
    path.join(__dirname, "../../../era-hotel-pms/node_modules/xlsx"),
    path.join(__dirname, "../../node_modules/xlsx"),
    "xlsx",
  ];
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* next */
    }
  }
  throw new Error("xlsx package not found");
}

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(SEED, rel), "utf8"));
}

function foldAlias(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g");
}

function unique(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const k = foldAlias(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(item).trim());
  }
  return out;
}

function main() {
  const XLSX = loadXlsx();
  const base = loadJson("base/physio-zones-s.json");
  const overlay = loadJson("nafta/physio-zones-overlay.json");
  const aliasByCode = new Map();
  for (const entry of overlay.siteAliases || []) {
    const code = String(entry.code || "")
      .trim()
      .toUpperCase();
    if (!code) continue;
    aliasByCode.set(code, unique([...(aliasByCode.get(code) || []), ...(entry.woAliases || [])]));
  }

  const rows = (base.zones || []).map((zone, index) => {
    const code = String(zone.code || "")
      .trim()
      .toUpperCase();
    const aliases = unique([...(zone.woAliases || []), ...(aliasByCode.get(code) || [])]);
    return {
      code,
      kind: zone.kind || "",
      prikaz817: zone.prikaz817 == null ? "" : zone.prikaz817,
      laterality: zone.laterality ? "true" : "false",
      titleAz: zone.titleAz || "",
      titleRu: zone.titleRu || "",
      titleEn: zone.titleEn || "",
      titleLa: zone.titleLa || "",
      boundary: zone.boundary || "",
      coarse: (zone.coarse || []).join(","),
      woAliases: aliases.join(" | "),
      sortOrder: zone.prikaz817 ?? (index + 1) * 10,
    };
  });

  const outFile = path.join(READY, FILES.clinicPhysio);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const headers = HEADERS.physioSites;
  const aoa = [headers, ...rows.map((r) => headers.map((h) => (r[h] == null ? "" : r[h])))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "import");
  XLSX.writeFile(wb, outFile);
  console.log(JSON.stringify({ outFile, rows: rows.length }, null, 2));
}

main();
