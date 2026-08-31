"use strict";

/**
 * Merge FnB dumps (START/fnb/_source/ew-2026-* or legacy START/2026) into #32
 * and guest Xudmani extras into hotel folio.
 *
 * 999 FB (Jan–early Jul): house POS on guest "999 FB".
 * Xudmani (Jul–Aug): CASH FOLIO walk-ins → #32; named in-house guests → hotel #13.
 *
 *   node era-hotel-pms/scripts/merge-fnb-2026.cjs
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const X = require(path.join(__dirname, "..", "node_modules", "xlsx"));
const { FILES, START_ARCHIVE, fileAt } = require(path.join(
  __dirname,
  "..",
  "..",
  "era-clinic",
  "scripts",
  "nafta-cutover",
  "pack-layout.cjs",
));

const START = process.env.NAFTA_START || "D:/ERA-BACKUP/NAFTA-START";
const READY = process.env.NAFTA_READY || "D:/ERA-BACKUP/NAFTA-ERA-READY";

function fnbSourceDir(oldName, slug) {
  const next = path.join(START, "fnb", "_source", slug);
  if (fs.existsSync(next)) return next;
  return path.join(START, "2026", oldName);
}

function filled(value) {
  if (value == null) return false;
  const s = String(value).trim();
  return s !== "" && s !== "null" && !/^nan$/i.test(s);
}

function foldGuest(name) {
  return String(name ?? "")
    .trim()
    .toUpperCase()
    .replace(/İ/g, "I");
}

function excelDay(value) {
  if (typeof value !== "number" || value < 1000 || value > 80000) return null;
  const d = X.SSF.parse_date_code(value);
  if (!d || d.y < 2020 || d.y > 2100) return null;
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

function listXlsx(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".xlsx"))
    .sort()
    .map((f) => path.join(dir, f));
}

function readBook(filePath) {
  const wb = X.readFile(filePath, { cellDates: false });
  const sheetName = wb.SheetNames[0];
  const rows = X.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: true });
  const headers = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return { sheetName, rows, headers };
}

function writeBook(filePath, rows, headers, sheetName) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const ws = X.utils.json_to_sheet(rows, { header: headers });
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, String(sheetName || "import").slice(0, 31));
  X.writeFile(wb, filePath, { compression: true });
}

function unionHeaders(base, extra) {
  const seen = new Set(base);
  const out = [...base];
  for (const h of extra) {
    if (!seen.has(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  return out;
}

function mergeById(baseRows, incoming, headersAcc) {
  const byId = new Map();
  for (const row of baseRows) {
    const id = String(row.Id ?? "").trim();
    if (id && id !== "NaN") byId.set(id, row);
    for (const k of Object.keys(row)) {
      if (!headersAcc.includes(k)) headersAcc.push(k);
    }
  }
  let added = 0;
  let updated = 0;
  for (const row of incoming) {
    const id = String(row.Id ?? "").trim();
    if (!id || id === "NaN") continue;
    for (const k of Object.keys(row)) {
      if (!headersAcc.includes(k)) headersAcc.push(k);
    }
    if (!byId.has(id)) {
      byId.set(id, row);
      added += 1;
    } else {
      byId.set(id, row);
      updated += 1;
    }
  }
  return { rows: [...byId.values()], added, updated, headers: headersAcc };
}

function loadDirRows(dir) {
  const files = listXlsx(dir);
  const rows = [];
  for (const f of files) rows.push(...readBook(f).rows);
  return { files: files.map((f) => path.basename(f)), rows };
}

function runNode(script, argv) {
  console.log(">>", path.basename(script), argv.join(" "));
  const r = spawnSync(process.execPath, [script, ...argv], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    windowsHide: true,
  });
  if (r.status) throw new Error(`${path.basename(script)} exited ${r.status}`);
}

function main() {
  const fb = loadDirRows(fnbSourceDir("999 FB", "ew-2026-999-fb"));
  const xud = loadDirRows(fnbSourceDir("Xudmani", "ew-2026-xudmani"));

  const fnbIncoming = [];
  const hotelIncoming = [];
  const stats = {
    fbRaw: fb.rows.length,
    xudRaw: xud.rows.length,
    fbKept: 0,
    fbJunkDate: 0,
    xudCash: 0,
    xudNamedHotel: 0,
    xudSkippedHouse: 0,
    xudNoResId: 0,
  };

  for (const row of fb.rows) {
    if (!excelDay(row.Date)) {
      stats.fbJunkDate += 1;
      continue;
    }
    const g = foldGuest(row["Guest Name"]);
    if (g.includes("999") && g.includes("FB")) {
      fnbIncoming.push(row);
      stats.fbKept += 1;
    }
  }

  for (const row of xud.rows) {
    if (!excelDay(row.Date)) {
      stats.fbJunkDate += 1;
      continue;
    }
    const g = foldGuest(row["Guest Name"]);
    if (g === "CASH FOLIO") {
      fnbIncoming.push(row);
      stats.xudCash += 1;
      continue;
    }
    if (!g || g === "BALANCE" || g.includes("DEBITOR") || g.includes("TEST QONAQ")) {
      stats.xudSkippedHouse += 1;
      continue;
    }
    const resId = String(row["Res Id"] ?? "").trim();
    if (!resId || resId === "0" || /^nan$/i.test(resId)) {
      stats.xudNoResId += 1;
      continue;
    }
    hotelIncoming.push(row);
    stats.xudNamedHotel += 1;
  }

  const fnbPath = fileAt(START, FILES.fnbTx);
  const fnbBase = fs.existsSync(fnbPath) ? readBook(fnbPath) : { rows: [], headers: [], sheetName: "FnB" };
  const fnbMerged = mergeById(fnbBase.rows, fnbIncoming, [...fnbBase.headers]);
  writeBook(fnbPath, fnbMerged.rows, fnbMerged.headers, fnbBase.sheetName || "FnB");
  fs.mkdirSync(path.dirname(fileAt(READY, FILES.fnbTx)), { recursive: true });
  fs.copyFileSync(fnbPath, fileAt(READY, FILES.fnbTx));

  let hotel = { added: 0, updated: 0, out: 0 };
  if (hotelIncoming.length) {
    const mergedPath = fileAt(START, START_ARCHIVE.folioMerged);
    const merged = readBook(mergedPath);
    const next = mergeById(merged.rows, hotelIncoming, [...merged.headers]);
    writeBook(mergedPath, next.rows, unionHeaders(merged.headers, next.headers), merged.sheetName);
    hotel = { added: next.added, updated: next.updated, out: next.rows.length };
    runNode(path.join(__dirname, "filter-hotel-folio-only.cjs"), ["--start", START, "--ready", READY]);
    runNode(path.join(__dirname, "split-hotel-folio-upload.cjs"), [READY]);
  }

  const report = {
    builtAt: new Date().toISOString(),
    stats,
    fnb: { added: fnbMerged.added, updated: fnbMerged.updated, out: fnbMerged.rows.length },
    hotelFolio: hotel,
  };
  const reportPath = path.join(START, "fnb", "merge-fnb-2026-report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main();
