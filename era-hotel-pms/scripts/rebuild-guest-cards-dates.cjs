/**
 * Rewrite Guest Cards merged xlsx so date columns are Excel dates, not serial numbers.
 *
 *   node era-hotel-pms/scripts/rebuild-guest-cards-dates.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const X = require("xlsx");

const DATE_COLS = [
  "Birth Date",
  "Birthday",
  "Last Checkin",
  "Creation Date",
  "Mobile First Login",
  "Mobile Last Login",
];

const PATHS = [
  "D:/ERA-BACKUP/NAFTA-ERA-READY/hotel/10-Guest-Cards.merged.xlsx",
  "D:/ERA-BACKUP/NAFTA-START/hotel/10-Guest-Cards.merged.xlsx",
];

function fromExcelSerial(raw) {
  if (raw == null) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  }
  const s = String(raw).trim();
  if (!s || /^nan$/i.test(s) || s === "0") return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
}

function rebuild(filePath) {
  const wb = X.read(fs.readFileSync(filePath), { type: "buffer", cellDates: false });
  const sn = wb.SheetNames[0];
  const rows = X.utils.sheet_to_json(wb.Sheets[sn], { defval: null, raw: true });
  const headers = Object.keys(rows[0] || {});
  for (const row of rows) {
    for (const col of DATE_COLS) {
      if (!(col in row)) continue;
      row[col] = fromExcelSerial(row[col]);
    }
    if ("Birthday_1" in row) {
      const d = fromExcelSerial(row.Birthday_1);
      row.Birthday_1 = d;
    }
  }
  const ws = X.utils.json_to_sheet(rows, { header: headers, cellDates: true });
  const range = X.utils.decode_range(ws["!ref"]);
  const dateIdx = DATE_COLS.concat(["Birthday_1"])
    .map((c) => headers.indexOf(c))
    .filter((i) => i >= 0);
  for (let R = range.s.r + 1; R <= range.e.r; R += 1) {
    for (const C of dateIdx) {
      const addr = X.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell || cell.v == null || cell.v === "") continue;
      cell.t = "d";
      cell.z = "YYYY-MM-DD";
      if (typeof cell.v === "number") {
        const d = fromExcelSerial(cell.v);
        if (d) cell.v = d;
        else {
          delete ws[addr];
        }
      }
    }
  }
  const outWb = X.utils.book_new();
  X.utils.book_append_sheet(outWb, ws, (sn || "Guest cards").slice(0, 31));
  const buf = X.write(outWb, { type: "buffer", bookType: "xlsx", cellDates: true });
  const tmp = filePath.replace(/\.xlsx$/i, ".dates.tmp.xlsx");
  fs.writeFileSync(tmp, buf);
  try {
    fs.copyFileSync(tmp, filePath);
    fs.unlinkSync(tmp);
  } catch (err) {
    console.warn("locked, left temp:", tmp, err.code || err.message);
  }
  return rows.length;
}

for (const p of PATHS) {
  if (!fs.existsSync(p)) {
    console.error("missing", p);
    continue;
  }
  const n = rebuild(p);
  console.log("rewrote", path.basename(path.dirname(p)) + "/" + path.basename(p), "rows", n);
}
