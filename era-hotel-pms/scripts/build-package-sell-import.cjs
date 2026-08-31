"use strict";

/**
 * Bake READY #14 desk package prices from START PDF CSV (az room_rate + package_rate).
 *   node era-hotel-pms/scripts/build-package-sell-import.cjs
 */

const fs = require("fs");
const path = require("path");
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

const PKG = {
  "Standart paket": { code: "PKG-STANDART", name: "Nafta Standart" },
  "Premium paket": { code: "PKG-PREMIUM", name: "Nafta Premium" },
  "Dermo paket": { code: "PKG-DERMO", name: "Nafta Dermo" },
  "Detoks paket": { code: "PKG-DETOKS", name: "Nafta Detoks" },
};

const OCC = { single: 1, double: 2, triple: 3 };

const HEADERS = [
  "packageCode",
  "packageName",
  "occupancy",
  "sellPrice",
  "season",
  "roomType",
  "desk",
  "source",
  "extraBedAmount",
];

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

const EXTRA_BED_STANDART = 96;

function extraBedFor(code) {
  if (code === "PKG-STANDART") return EXTRA_BED_STANDART;
  return Math.round(EXTRA_BED_STANDART / 2);
}

function isDesk(section, roomType, season) {
  if (section === "package_rate") return true;
  const rt = String(roomType || "").toLowerCase();
  const high = /high/i.test(String(season || ""));
  if (/standart dbl|twin/i.test(rt) && high) return true;
  if (/triple/i.test(rt) && high) return true;
  return false;
}

function main() {
  const csvPath = fileAt(START, START_ARCHIVE.packageCsv);
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const table = parseCsv(text);
  const header = (table[0] || []).map((h) => String(h).replace(/^\uFEFF/, "").trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const out = [];
  for (const cells of table.slice(1)) {
    const lang = cells[idx.lang];
    const section = cells[idx.section];
    if (lang !== "az") continue;
    if (section !== "room_rate" && section !== "package_rate") continue;
    const pkg = PKG[cells[idx.package]];
    if (!pkg) continue;
    const occKey = String(cells[idx.occupancy] || "").toLowerCase();
    const occupancy = OCC[occKey];
    if (!occupancy) continue;
    const sellPrice = Number(cells[idx.amount_azn]);
    if (!Number.isFinite(sellPrice) || sellPrice <= 0) continue;
    const season = cells[idx.season] || "";
    const roomType = cells[idx.room_type] || "";
    out.push({
      packageCode: pkg.code,
      packageName: pkg.name,
      occupancy,
      sellPrice,
      season,
      roomType,
      desk: isDesk(section, roomType, season) ? "Y" : "N",
      source: "PDF NAFTA PRICE & PACKAGES LIST - 2026",
      extraBedAmount: extraBedFor(pkg.code),
    });
  }
  const aoa = [HEADERS, ...out.map((r) => HEADERS.map((h) => r[h]))];
  const ws = X.utils.aoa_to_sheet(aoa);
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, "import");
  const dest = fileAt(READY, FILES.hotelPackageSell);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  X.writeFile(wb, dest);
  if (!out.length) throw new Error(`No package sell rows from ${csvPath}`);
  console.log(
    JSON.stringify(
      {
        outFile: dest,
        rows: out.length,
        desk: out.filter((r) => r.desk === "Y").length,
        packages: [...new Set(out.map((r) => r.packageCode))],
      },
      null,
      2,
    ),
  );
}

main();
