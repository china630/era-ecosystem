/**
 * Build a hotel-wizard folio book: guest stays from #11 only.
 * Drops EW house ledgers (999 FB, Tibb Ambulator, CASH FOLIO, DEBITORLAR, test).
 *
 *   node era-hotel-pms/scripts/filter-hotel-folio-only.cjs
 *   node era-hotel-pms/scripts/filter-hotel-folio-only.cjs --ready "D:/ERA-BACKUP/NAFTA-ERA-READY"
 */
const fs = require("fs");
const path = require("path");
const X = require("xlsx");

function parseArgs(argv) {
  const args = argv.slice(2);
  let ready = "D:/ERA-BACKUP/NAFTA-ERA-READY";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--ready") ready = args[i + 1];
  }
  const hotelDir = path.join(ready, "hotel");
  return {
    reservations: path.join(hotelDir, "11-Reservations.merged.xlsx"),
    folioIn: path.join(hotelDir, "12-Folio-Transactions.merged.xlsx"),
    folioOut: path.join(hotelDir, "12-Folio-Transactions.hotel.xlsx"),
  };
}

function normResId(value) {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  if (!s || /^nan$/i.test(s) || s === "null") return "";
  const n = Number(s);
  if (Number.isFinite(n)) {
    if (n === 0) return "";
    return String(Math.trunc(n));
  }
  return s;
}

function foldGuest(name) {
  return String(name ?? "")
    .trim()
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/İ/g, "I");
}

/** EW system / house folios — not a guest stay in ERA hotel-pms. */
function isHouseLedger(guestName) {
  const g = foldGuest(guestName);
  if (!g) return false;
  if (g.includes("999") && g.includes("FB")) return true;
  if (g === "CASH FOLIO") return true;
  if (g.includes("DEBITOR")) return true;
  if (g.includes("AMBULATOR")) return true;
  if (g.includes("TIBB") && g.includes("FOLIO")) return true;
  if (g.includes("SANAL")) return true;
  if (g === "BALANCE") return true;
  if (g.includes("TEST QONAQ")) return true;
  return false;
}

function loadSheet(filePath) {
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

function main() {
  const paths = parseArgs(process.argv);
  for (const p of [paths.reservations, paths.folioIn]) {
    if (!fs.existsSync(p)) {
      console.error("Missing", p);
      process.exit(1);
    }
  }

  const resBook = loadSheet(paths.reservations);
  const resIds = new Set();
  for (const row of resBook.rows) {
    const id = normResId(row["Res Id"]);
    if (id) resIds.add(id);
  }

  const folio = loadSheet(paths.folioIn);
  const kept = [];
  const dropped = {
    houseLedger: 0,
    missingReservation: 0,
    emptyResId: 0,
  };
  const houseByGuest = {};

  for (const row of folio.rows) {
    const guest = String(row["Guest Name"] ?? "").trim();
    if (isHouseLedger(guest)) {
      dropped.houseLedger += 1;
      houseByGuest[guest] = (houseByGuest[guest] || 0) + 1;
      continue;
    }
    const resId = normResId(row["Res Id"]);
    if (!resId) {
      dropped.emptyResId += 1;
      continue;
    }
    if (!resIds.has(resId)) {
      dropped.missingReservation += 1;
      continue;
    }
    kept.push(row);
  }

  const outWs = X.utils.json_to_sheet(kept, { header: folio.headers });
  const outWb = X.utils.book_new();
  X.utils.book_append_sheet(outWb, outWs, (folio.sheetName || "Folio hotel").slice(0, 31));
  X.writeFile(outWb, paths.folioOut);

  const summary = {
    reservationsFile: paths.reservations,
    folioIn: paths.folioIn,
    folioOut: paths.folioOut,
    reservationIds: resIds.size,
    folioInRows: folio.rows.length,
    folioOutRows: kept.length,
    dropped,
    houseLedgerByGuest: houseByGuest,
  };
  const summaryPath = paths.folioOut.replace(/\.xlsx$/i, ".summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  console.log("Hotel-only folio:", kept.length, "->", paths.folioOut);
  console.log("Dropped house ledger:", dropped.houseLedger, houseByGuest);
  console.log("Dropped no Res Id:", dropped.emptyResId);
  console.log("Dropped Res Id not in #11:", dropped.missingReservation);
  console.log("Summary:", summaryPath);
}

main();
