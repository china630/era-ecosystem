/**
 * Slim + chunk the hotel folio book so Next.js FormData (≈1–10 MB) can parse it.
 *
 *   node era-hotel-pms/scripts/split-hotel-folio-upload.cjs
 */
const fs = require("fs");
const path = require("path");
const X = require("xlsx");
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
const READY_ROOT = process.argv[2] || process.env.NAFTA_READY || "D:/ERA-BACKUP/NAFTA-ERA-READY";
const SRC = fileAt(START, START_ARCHIVE.folioHotel);
const OUT_DIR = fileAt(READY_ROOT, FILES.hotelFolioDir);
const COLS = [
  "Id",
  "Res Id",
  "Revenue Code",
  "Income",
  "Local Amount",
  "Date",
  "Guest Name",
  "Doc Note",
  "Notes",
];
const ROWS_PER_PART = 6500;

/** EW Revenue Name values from 01-Revenue-Codes.xlsx (folio adapter matches code or name). */
const INCOME_IS_REVENUE_NAME = new Set(
  [
    "ROOM",
    "FOOD",
    "BEVERAGE",
    "ALCOLIC BEVERAGE",
    "TABACCO",
    "EKSKURSİYA",
    "PENSION",
    "LAUNDRY",
    "TRANSFER",
    "TAXI",
    "CAR RENTAL",
    "AMBULATOR",
    "SPA STORE",
    "TAX 18%",
    "CITY TAX",
    "SPA MEDIKAL",
    "OTHER",
    "PENSION BREAKFAST",
    "PENSION LUNCH",
    "PENSION DINNER",
    "NO SHOW",
    "ICARE",
  ].map((s) => s.toUpperCase()),
);

const DEPARTMENT_TO_NAME = {
  ACCOMMODATION: "ROOM",
  "EXTRA BED": "ROOM",
  BANQUETING: "OTHER",
};

function fold(value) {
  return String(value ?? "")
    .trim()
    .replace(/\t/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function cell(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  return s === "" || s === "null" ? "" : s;
}

/**
 * EW Folio Transactions often leave Revenue Code empty and put the catalog
 * name in Income (ROOM / SPA MEDIKAL). Cash/terminal rows have neither — skip
 * (those are payments, not FolioCharge).
 */
function resolveRevenueCode(row) {
  const fromCol = cell(row["Revenue Code"]);
  if (fromCol) return fromCol;
  const income = fold(row.Income);
  if (income && INCOME_IS_REVENUE_NAME.has(income)) return income;
  const dept = fold(row.Department);
  if (dept && INCOME_IS_REVENUE_NAME.has(dept)) return dept;
  if (DEPARTMENT_TO_NAME[dept]) return DEPARTMENT_TO_NAME[dept];
  return "";
}

function pick(row) {
  const revenueCode = resolveRevenueCode(row);
  if (!revenueCode) return null;
  return {
    Id: row.Id,
    "Res Id": row["Res Id"],
    "Revenue Code": revenueCode,
    Income: row.Income,
    "Local Amount": row["Local Amount"],
    Date: row.Date,
    "Guest Name": row["Guest Name"],
    "Doc Note": row["Doc Note"] ?? row[" Doc Note"],
    Notes: row.Notes,
  };
}

function writeXlsx(filePath, rows) {
  const ws = X.utils.json_to_sheet(rows, { header: COLS });
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, "Folios");
  X.writeFile(wb, filePath, { compression: true });
  return fs.statSync(filePath).size;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Missing", SRC);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^13-Folio-(slim|p\d+)\.xlsx$/i.test(f) || f.startsWith("_probe-")) {
      fs.unlinkSync(path.join(OUT_DIR, f));
    }
  }

  const wb = X.readFile(SRC, { cellDates: false });
  const rawRows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
  const slim = [];
  let skippedNoRevenue = 0;
  for (const row of rawRows) {
    const picked = pick(row);
    if (!picked) {
      skippedNoRevenue += 1;
      continue;
    }
    slim.push(picked);
  }
  console.log("source", rawRows.length, "charges", slim.length, "skipped cash/terminal", skippedNoRevenue);

  const slimPath = path.join(OUT_DIR, "13-Folio-slim.xlsx");
  const slimBytes = writeXlsx(slimPath, slim);
  console.log("slim", slim.length, "rows", (slimBytes / 1024 / 1024).toFixed(2), "MB", slimPath);

  const parts = [];
  for (let i = 0, n = 1; i < slim.length; i += ROWS_PER_PART, n += 1) {
    const chunk = slim.slice(i, i + ROWS_PER_PART);
    const name = `13-Folio-p${String(n).padStart(2, "0")}.xlsx`;
    const fp = path.join(OUT_DIR, name);
    const bytes = writeXlsx(fp, chunk);
    parts.push({ name, rows: chunk.length, mb: +(bytes / 1024 / 1024).toFixed(2) });
    console.log(name, chunk.length, "rows", (bytes / 1024 / 1024).toFixed(2), "MB");
  }

  const summary = {
    source: SRC,
    skippedNoRevenue,
    slimPath,
    slimMb: +(slimBytes / 1024 / 1024).toFixed(2),
    rowsPerPart: ROWS_PER_PART,
    parts,
  };
  fs.writeFileSync(path.join(OUT_DIR, "README.json"), JSON.stringify(summary, null, 2), "utf8");
}

main();
