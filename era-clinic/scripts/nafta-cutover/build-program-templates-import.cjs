"use strict";

/**
 * Bake READY #23 from START hotel/14-Package-Prices-2026.csv (PDF parse).
 * One row per (package, nights, inclusion line) → ProgramTemplateQuotaKnot.
 *
 *   node era-clinic/scripts/nafta-cutover/build-program-templates-import.cjs
 */

const fs = require("fs");
const path = require("path");
const { HEADERS } = require("./map.cjs");
const { FILES, START_ARCHIVE, fileAt } = require("./pack-layout.cjs");

const START = process.env.NAFTA_START || path.join("D:", "ERA-BACKUP", "NAFTA-START");
const READY = process.env.NAFTA_READY || path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY");

const PKG = {
  "Standart paket": { code: "PKG-STANDART", name: "Nafta Standart", minNights: 5, maxNights: 21, durationDays: 10 },
  "Premium paket": { code: "PKG-PREMIUM", name: "Nafta Premium", minNights: 7, maxNights: 21, durationDays: 10 },
  "Dermo paket": { code: "PKG-DERMO", name: "Nafta Dermo", minNights: 14, maxNights: 21, durationDays: 14 },
  "Detoks paket": { code: "PKG-DETOKS", name: "Nafta Detoks", minNights: 7, maxNights: 21, durationDays: 7 },
};

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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (!q && c === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (!q && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      if (cur !== "" || row.length) {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      }
      continue;
    }
    cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function fold(value) {
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

function mapInclusionItem(item) {
  const s = fold(item);
  if (s.includes("hekim muayine")) return { procedureCode: "THERAPIST", procedureName: "Hekim muayinesi" };
  if (s.startsWith("nevropatolog")) return { procedureCode: "NEURO", procedureName: "Nevropatolog muayinesi" };
  if (s.includes("ginekolog")) return { procedureCode: "GYN", procedureName: "Ginekolog/urolog muayinesi" };
  if (s.includes("ekq")) return { procedureCode: "ECG", procedureName: "EKQ ve kardiolog muayinesi" };
  if (s.includes("usm")) return { procedureCode: "USG", procedureName: "Qarin / kicik canaq USM" };
  if (s.includes("qan umumi") || s.includes("qan 19")) return { procedureCode: "LAB-CBC", procedureName: "Qan umumi analiz 19 parametr" };
  if (s.includes("sidik")) return { procedureCode: "LAB-URINE", procedureName: "Sidik umumi analizi" };
  if (s.includes("sekar")) return { procedureCode: "GLU", procedureName: "Sekar qanda" };
  if (s === "alat") return { procedureCode: "ALT", procedureName: "ALAT" };
  if (s === "asat") return { procedureCode: "AST", procedureName: "ASAT" };
  if (s.includes("naftalan vannasi") || s.startsWith("vanna (naftalan")) {
    return { procedureCode: "NAFTALAN_BATH", procedureName: "Naftalan vannasi" };
  }
  if (s.includes("hbsag")) return { procedureCode: "LAB-SEROLOGY-CARD", procedureName: "HBsAg/HCV/Syphilis card" };
  if (s.startsWith("parafin")) return { procedureCode: "PARAFFIN_POOL", procedureName: "Parafin*" };
  if (s.startsWith("fizioprosedur")) return { procedureCode: "PHYSIO_POOL", procedureName: "Fizioprosedurlar*" };
  if (s.includes("duz otagi")) return { procedureCode: "WO-TR-148", procedureName: "Speleoterapiya (Duz otagi)" };
  if (s.includes("paid physio")) return { procedureCode: "PHYSIO_PAID", procedureName: "Paid physio quota" };
  if (s.includes("paid labs")) return { procedureCode: "LAB_PAID", procedureName: "Paid labs quota" };
  if (s.includes("hidrokolon")) return { procedureCode: "WO-TR-60", procedureName: "Hidrokolon" };
  if (s.includes("ozon")) return { procedureCode: "WO-TR-83", procedureName: "Ozonterapiya" };
  if (s.includes("karbon vann")) return { procedureCode: "WO-TR-61", procedureName: "Karbon vannasi" };
  if (s.includes("hidromasaj")) return { procedureCode: "WO-TR-46", procedureName: "Hidromasaj vanna" };
  if (s.includes("linfodrenaj") || s.includes("limfodrenaj")) {
    return { procedureCode: "WO-TR-88", procedureName: "Limfodrenaj" };
  }
  if (s.includes("bukme")) return { procedureCode: "WO-TR-58", procedureName: "Bukme" };
  if (s.includes("fitobocka")) return { procedureCode: "WO-TR-116", procedureName: "Fitoterapiya (bocka)" };
  if (s.includes("ufb")) return { procedureCode: "WO-TR-64", procedureName: "UFB terapiya" };
  if (s.includes("turunda")) return { procedureCode: "WO-TR-117", procedureName: "Turunda burun" };
  const slug = s.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  return { procedureCode: `PDF-${slug || "ITEM"}`, procedureName: String(item).trim() };
}

function main() {
  const XLSX = loadXlsx();
  const csvPath = fileAt(START, START_ARCHIVE.packageCsv);
  if (!fs.existsSync(csvPath)) throw new Error(`Missing ${csvPath}`);
  const table = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const header = table[0];
  const idx = Object.fromEntries(header.map((x, i) => [x, i]));
  const rows = [];
  const unmapped = [];
  for (const r of table.slice(1)) {
    if (r[idx.section] !== "package_inclusion") continue;
    const pkgName = r[idx.package];
    const meta = PKG[pkgName];
    if (!meta) {
      unmapped.push(pkgName);
      continue;
    }
    const mapped = mapInclusionItem(r[idx.item]);
    rows.push({
      templateCode: meta.code,
      templateName: meta.name,
      minNights: meta.minNights,
      maxNights: meta.maxNights,
      durationDays: meta.durationDays,
      nights: Number(r[idx.nights]) || 0,
      procedureCode: mapped.procedureCode,
      procedureName: mapped.procedureName,
      qty: Number(r[idx.qty]) || 0,
    });
  }

  const outFile = path.join(READY, FILES.clinicTemplates);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const headers = HEADERS.programTemplates;
  const aoa = [headers, ...rows.map((row) => headers.map((h) => (row[h] == null ? "" : row[h])))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "import");
  XLSX.writeFile(wb, outFile);
  const codes = [...new Set(rows.map((r) => r.procedureCode))].sort();
  console.log(
    JSON.stringify(
      {
        outFile,
        rows: rows.length,
        templates: [...new Set(rows.map((r) => r.templateCode))],
        procedureCodes: codes,
        unknownPackages: [...new Set(unmapped)],
      },
      null,
      2,
    ),
  );
}

module.exports = { mapInclusionItem, PKG };

if (require.main === module) main();
