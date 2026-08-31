"use strict";

/**
 * Fill empty EW article columns with stable ERA-* codes until 1C SKUs exist.
 *   ERA-FNB-{ewId}  — product cards (#31)
 *   ERA-PG-{n}      — product groups (#30)
 *
 * Do not stamp EW Hizmet Tanımları — that dump is not a clinic Apply book.
 *
 *   node era-hotel-pms/scripts/stamp-fnb-skus.cjs
 */

const fs = require("fs");
const path = require("path");
const X = require(path.join(__dirname, "..", "node_modules", "xlsx"));
const { FILES, fileAt } = require(path.join(
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
const GROUPS_SRC =
  process.env.NAFTA_GROUPS_XLSX ||
  path.join(
    process.env.USERPROFILE || "",
    "Downloads",
    "Product Group List.2026-08-31.01-09-33.Nafta Sanatorium Hotel.xlsx",
  );

function readBook(filePath) {
  const wb = X.readFile(filePath, { cellDates: false });
  const sheetName = wb.SheetNames[0];
  const rows = X.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", raw: true });
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

function filled(value) {
  return String(value ?? "").trim() !== "";
}

function stampCards(filePath) {
  if (!fs.existsSync(filePath)) return { file: filePath, missing: true };
  const book = readBook(filePath);
  let stamped = 0;
  let kept = 0;
  for (const row of book.rows) {
    if (filled(row["Ürün Kodu"])) {
      kept += 1;
      continue;
    }
    const id = String(row.Id ?? "").trim();
    if (!id || id === "NaN") continue;
    row["Ürün Kodu"] = `ERA-FNB-${id}`;
    stamped += 1;
  }
  writeBook(filePath, book.rows, book.headers, book.sheetName);
  return { file: filePath, rows: book.rows.length, stamped, kept };
}

function stampGroups(srcPath, destPaths) {
  if (!fs.existsSync(srcPath)) return { src: srcPath, missing: true };
  const book = readBook(srcPath);
  let n = 0;
  let stamped = 0;
  let kept = 0;
  let skippedEmpty = 0;
  for (const row of book.rows) {
    if (!filled(row["Product Group Name"])) {
      skippedEmpty += 1;
      continue;
    }
    if (filled(row["Group Code"])) {
      kept += 1;
      continue;
    }
    n += 1;
    row["Group Code"] = `ERA-PG-${String(n).padStart(3, "0")}`;
    stamped += 1;
  }
  for (const dest of destPaths) {
    writeBook(dest, book.rows, book.headers, book.sheetName);
  }
  return { src: srcPath, dest: destPaths, rows: book.rows.length, stamped, kept, skippedEmpty };
}

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function main() {
  const readyCards = fileAt(READY, FILES.fnbCards);
  const startCards = fileAt(START, FILES.fnbCards);
  copyIfExists(readyCards, startCards);

  const groups = stampGroups(GROUPS_SRC, [
    fileAt(START, FILES.fnbGroups),
    fileAt(READY, FILES.fnbGroups),
  ]);
  const cardsReady = stampCards(readyCards);
  const cardsStart = stampCards(startCards);

  const report = { builtAt: new Date().toISOString(), groups, cardsReady, cardsStart };
  fs.mkdirSync(path.join(START, "fnb"), { recursive: true });
  fs.writeFileSync(path.join(START, "fnb", "stamp-fnb-skus-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
