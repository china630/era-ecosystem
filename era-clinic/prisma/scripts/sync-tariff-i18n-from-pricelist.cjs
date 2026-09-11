/**
 * Fill missing Рус/Eng on Nafta tariff from 16.07.2025 3-language price list.
 * Does not overwrite non-empty names. Does not merge lipid SKUs.
 *
 *   node prisma/scripts/sync-tariff-i18n-from-pricelist.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const TARIFF =
  process.argv[2] ||
  "C:/Users/ASUS G752VT/Downloads/Nafta services Chingiz.xlsx";
const PRICELIST =
  process.argv[3] ||
  "C:/Users/ASUS G752VT/Downloads/Prosedurlar Price list Nafta 16.07.2025.xlsx";
const REPO = path.join(__dirname, "..", "seed-data", "nafta", "nafta-tariff-era-codes.xlsx");

function fold(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/xolesterol/g, "cholesterol")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(v) {
  const n = Number(String(v || "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function loadPricelist() {
  const wb = XLSX.readFile(PRICELIST);
  const raw = XLSX.utils.sheet_to_json(wb.Sheets["Price list Nafta"], {
    header: 1,
    defval: "",
    raw: false,
  });
  const items = [];
  for (const row of raw) {
    const az = String(row[1] || "").trim();
    const ru = String(row[2] || "").trim();
    const en = String(row[3] || "").trim();
    if (!az || /^№$/i.test(az)) continue;
    if (/\/Diagnostic procedures/i.test(ru) || /\/Diagnostic procedures/i.test(az)) continue;
    items.push({ az, ru, en, price: parsePrice(row[4]) });
  }
  return items;
}

function indexPricelist(items) {
  const byAz = new Map();
  const byRu = new Map();
  const byEn = new Map();
  const byAzPrice = new Map();
  for (const it of items) {
    const faz = fold(it.az);
    const fru = fold(it.ru);
    const fen = fold(it.en);
    if (faz && !byAz.has(faz)) byAz.set(faz, it);
    if (fru && !byRu.has(fru)) byRu.set(fru, it);
    if (fen && !byEn.has(fen)) byEn.set(fen, it);
    if (faz && it.price != null) byAzPrice.set(`${faz}|${it.price}`, it);
  }
  return { byAz, byRu, byEn, byAzPrice };
}

function lookup(row, idx) {
  const az = fold(row.Имя);
  const ru = fold(row.Рус);
  const en = fold(row.Eng);
  const price = parsePrice(row.Цена);
  if (az && price != null && idx.byAzPrice.has(`${az}|${price}`)) {
    return idx.byAzPrice.get(`${az}|${price}`);
  }
  if (az && idx.byAz.has(az)) return idx.byAz.get(az);
  if (ru && idx.byRu.has(ru)) return idx.byRu.get(ru);
  if (en && idx.byEn.has(en)) return idx.byEn.get(en);
  return null;
}

const wb = XLSX.readFile(TARIFF);
const rows = XLSX.utils.sheet_to_json(wb.Sheets.tariff, { defval: "", raw: false });
const idx = indexPricelist(loadPricelist());

let filledRu = 0;
let filledEn = 0;
let unmatched = 0;
const unmatchedNames = [];

for (const r of rows) {
  const hit = lookup(r, idx);
  if (!hit) {
    unmatched += 1;
    unmatchedNames.push(r.code + " | " + r.Имя);
    continue;
  }
  if (!String(r.Рус || "").trim() && hit.ru) {
    r.Рус = hit.ru;
    filledRu += 1;
  }
  if (!String(r.Eng || "").trim() && hit.en) {
    r.Eng = hit.en.trim();
    filledEn += 1;
  }
}

const missingName = rows.filter((r) => !r.Имя);
if (missingName.length) {
  throw new Error("abort: " + missingName.length + " rows missing Имя");
}

const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, XLSX.utils.json_to_sheet(rows), "tariff");
for (const name of wb.SheetNames) {
  if (name === "tariff") continue;
  XLSX.utils.book_append_sheet(outWb, wb.Sheets[name], name);
}
XLSX.writeFile(outWb, TARIFF);
fs.mkdirSync(path.dirname(REPO), { recursive: true });
XLSX.writeFile(outWb, REPO);

console.log("[sync-i18n] filled Рус", filledRu, "Eng", filledEn, "no pricelist hit", unmatched);
unmatchedNames.slice(0, 40).forEach((s) => console.log("  ", s));
if (unmatchedNames.length > 40) console.log("  …", unmatchedNames.length - 40, "more");
