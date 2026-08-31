"use strict";

/**
 * Overlay clinic #24 programCode from EW FO-with-Notes extract
 * (agency prefix / Həmkarlar / Extra Req ERA-PKG / Res·CIn·Operator·Payment phrases).
 *
 *   node era-clinic/scripts/nafta-cutover/stamp-clinic-program.cjs
 *   node era-clinic/scripts/nafta-cutover/stamp-clinic-program.cjs --apply
 *
 * Rebuild/bake call overlayPatientProgramCodes() before writing 24-Patients.xlsx.
 * Then Re-Apply wizard #24 so ClinicalEpisode.programCode updates.
 */

const fs = require("fs");
const path = require("path");

const PKG = new Set(["PKG-STANDART", "PKG-PREMIUM", "PKG-DERMO", "PKG-DETOKS"]);

const DEFAULT_ENRICHED = path.join(
  __dirname,
  "../../../reports/nafta-ew-notes-2026/migration-rows-enriched.json",
);

function foldName(value) {
  return String(value || "")
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

function ymd(value) {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    if (y >= 2020) return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  const iso = raw.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const yy = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${yy}-${String(mdy[1]).padStart(2, "0")}-${String(mdy[2]).padStart(2, "0")}`;
  }
  return "";
}

function roomKey(value) {
  return String(value || "")
    .trim()
    .replace(/^0+/, "")
    .toUpperCase();
}

function normalizePkg(raw) {
  if (!raw) return "";
  const u = String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^PKG-?/, "PKG-");
  const compact = u.replace(/^PKG-/, "");
  const aliases = {
    STANDART: "PKG-STANDART",
    STANDARD: "PKG-STANDART",
    PREMIUM: "PKG-PREMIUM",
    DERMO: "PKG-DERMO",
    DETOKS: "PKG-DETOKS",
    DETOX: "PKG-DETOKS",
    "PKG-STANDART": "PKG-STANDART",
    "PKG-STANDARD": "PKG-STANDART",
    "PKG-PREMIUM": "PKG-PREMIUM",
    "PKG-DERMO": "PKG-DERMO",
    "PKG-DETOKS": "PKG-DETOKS",
    "PKG-DETOX": "PKG-DETOKS",
  };
  const hit = aliases[u] || aliases[compact] || aliases[`PKG-${compact}`];
  return PKG.has(hit) ? hit : "";
}

/**
 * Cutover overlay (default): agency / phrases / ERA-PKG / Price Note / Walkin medical → Standart.
 * Live-bridge strict: pass `{ cutover: false }` — then medical-default, low, and bare medical are skipped.
 * Never stamp leisure or mix (two packages on one card).
 */
function resolveStampSku(row, opts = {}) {
  const cutover = opts.cutover !== false;
  if (/leisure/i.test(String(row.stayKind || ""))) return "";
  if (/walkin\s+leisure/i.test(String(row.agency || ""))) return "";
  if (row.mixHint) return "";
  const sku = normalizePkg(row.migrationSku || row.resolvedSku || row.sku);
  const src = String(row.migrationSource || row.resolveSource || row.src || "")
    .trim()
    .toLowerCase();
  if (src === "agency-prefix" || src === "agency" || src === "phrase" || src === "era-pkg") {
    return sku;
  }
  if (String(row.migrationConf || row.conf || "").toLowerCase() === "high" && sku) return sku;
  if (!cutover) return "";
  if (src === "agency-medical-default") return sku || "PKG-STANDART";
  if (sku) return sku;
  if (/medical/i.test(String(row.stayKind || ""))) return "PKG-STANDART";
  return "";
}

function shouldStampProgram(row, opts = {}) {
  return Boolean(resolveStampSku(row, opts));
}

function guestNames(guests) {
  return String(guests || "")
    .split("/")
    .map((g) => foldName(g))
    .filter(Boolean);
}

function loadEnrichedStamps(filePath) {
  const fp = filePath || DEFAULT_ENRICHED;
  if (!fs.existsSync(fp)) return [];
  const doc = JSON.parse(fs.readFileSync(fp, "utf8"));
  return Array.isArray(doc) ? doc : [];
}

function sourceRank(src) {
  const s = String(src || "").toLowerCase();
  if (s === "era-pkg") return 4;
  if (s === "agency-prefix" || s === "agency") return 3;
  if (s === "phrase") return 2;
  if (s === "price-note") return 1;
  return 0;
}

function betterStamp(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ca = String(a.migrationConf || "") === "high" ? 1 : 0;
  const cb = String(b.migrationConf || "") === "high" ? 1 : 0;
  if (ca !== cb) return ca > cb ? a : b;
  return sourceRank(a.migrationSource) >= sourceRank(b.migrationSource) ? a : b;
}

function addDays(isoDay, delta) {
  if (!isoDay) return "";
  const t = Date.parse(`${isoDay}T12:00:00Z`);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + delta * 86400000);
  return d.toISOString().slice(0, 10);
}

function nearbyDays(isoDay) {
  return [isoDay, addDays(isoDay, -1), addDays(isoDay, 1)].filter(Boolean);
}

function indexStamps(rows, opts = {}) {
  const byNameDate = new Map();
  const byLastDate = new Map();
  const byRoomDate = new Map();
  for (const row of rows) {
    const sku = resolveStampSku(row, opts);
    if (!sku) continue;
    const stamp = { ...row, migrationSku: sku };
    const day = ymd(row.arrival);
    if (!day) continue;
    for (const name of guestNames(row.guests)) {
      const k = `${name}\t${day}`;
      byNameDate.set(k, betterStamp(byNameDate.get(k), stamp));
      const last = name.split(" ").pop();
      if (last && last.length > 2) {
        const lk = `${last}\t${day}`;
        const list = byLastDate.get(lk) || [];
        list.push(stamp);
        byLastDate.set(lk, list);
      }
    }
    const room = roomKey(row.room);
    if (room) {
      const rk = `${room}\t${day}`;
      const list = byRoomDate.get(rk) || [];
      list.push(stamp);
      byRoomDate.set(rk, list);
    }
  }
  return { byNameDate, byLastDate, byRoomDate };
}

function uniqueStamp(list) {
  if (!list || !list.length) return null;
  const skus = [...new Set(list.map((s) => s.migrationSku).filter(Boolean))];
  if (skus.length === 1) return list[0];
  return null;
}

function overlayPatientProgramCodes(patientRows, stamps, opts = {}) {
  const { byNameDate, byLastDate, byRoomDate } = indexStamps(stamps, opts);
  const stats = {
    total: patientRows.length,
    stamped: 0,
    overwritten: 0,
    unmatched: 0,
    bySource: {},
    bySku: {},
  };
  for (const row of patientRows) {
    const previous = normalizePkg(row.programCode);
    const day = ymd(row.checkIn);
    const names = [foldName(row.fullName), foldName(`${row.givenName || ""} ${row.surname || ""}`)].filter(
      Boolean,
    );
    let hit = null;
    for (const n of names) {
      for (const d of nearbyDays(day)) {
        hit = byNameDate.get(`${n}\t${d}`);
        if (hit) break;
      }
      if (hit) break;
    }
    if (!hit) {
      const last = foldName(row.fullName).split(" ").pop();
      if (last && last.length > 2) {
        const lastHits = [];
        for (const d of nearbyDays(day)) {
          lastHits.push(...(byLastDate.get(`${last}\t${d}`) || []));
        }
        hit = uniqueStamp(lastHits);
      }
    }
    if (!hit) {
      const roomHits = [];
      for (const d of nearbyDays(day)) {
        roomHits.push(...(byRoomDate.get(`${roomKey(row.roomNumber)}\t${d}`) || []));
      }
      hit = uniqueStamp(roomHits);
    }
    if (!hit) {
      stats.unmatched += 1;
      continue;
    }
    row.programCode = hit.migrationSku;
    stats.stamped += 1;
    if (previous && previous !== hit.migrationSku) stats.overwritten += 1;
    const src = hit.migrationSource || (hit.migrationSku ? "medical-default" : "unknown");
    stats.bySource[src] = (stats.bySource[src] || 0) + 1;
    stats.bySku[hit.migrationSku] = (stats.bySku[hit.migrationSku] || 0) + 1;
  }
  return stats;
}

function loadXlsx() {
  const candidates = [
    path.join(__dirname, "../../node_modules/xlsx"),
    path.join(__dirname, "../../../era-hotel-pms/node_modules/xlsx"),
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

function overlayPatientsWorkbook(xlsxPath, stamps, XLSX) {
  const wb = XLSX.readFile(xlsxPath, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
  const stats = overlayPatientProgramCodes(rows, stamps);
  const headers = Object.keys(rows[0] || {});
  const aoa = [headers, ...rows.map((r) => headers.map((h) => (r[h] == null ? "" : r[h])))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const out = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(out, ws, sheetName || "import");
  XLSX.writeFile(out, xlsxPath);
  return { ...stats, file: xlsxPath };
}

function main() {
  const apply = process.argv.includes("--apply");
  const stamps = loadEnrichedStamps();
  if (!stamps.length) {
    console.error("Missing", DEFAULT_ENRICHED);
    process.exit(1);
  }
  const { FILES } = require("./pack-layout.cjs");
  const OUT = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");
  const xlsxPath = path.join(OUT, FILES.clinicPatients);
  if (!fs.existsSync(xlsxPath)) {
    console.error("Missing", xlsxPath);
    process.exit(1);
  }
  const XLSX = loadXlsx();
  if (!apply) {
    const wb = XLSX.readFile(xlsxPath, { cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const copy = rows.map((r) => ({ ...r }));
    const stats = overlayPatientProgramCodes(copy, stamps);
    console.log(JSON.stringify({ dryRun: true, file: xlsxPath, ...stats }, null, 2));
    return;
  }
  const stats = overlayPatientsWorkbook(xlsxPath, stamps, XLSX);
  console.log(JSON.stringify({ apply: true, ...stats }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  foldName,
  ymd,
  roomKey,
  normalizePkg,
  shouldStampProgram,
  resolveStampSku,
  overlayPatientProgramCodes,
  loadEnrichedStamps,
  overlayPatientsWorkbook,
};

