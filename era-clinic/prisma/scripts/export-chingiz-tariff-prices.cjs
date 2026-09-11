/**
 * Build Nafta ServiceCatalogCache rows from annotated Chingiz tariff xlsx.
 *   node prisma/scripts/export-chingiz-tariff-prices.cjs [xlsx]
 * Writes seed-data/nafta/chingiz-tariff-prices.json and merges into era-prices.json
 * (Chingiz era_code wins on overlap; leftover SVC rows stay).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const seedDir = path.join(__dirname, "..", "seed-data", "nafta");
const src =
  process.argv[2] ||
  path.join(seedDir, "nafta-tariff-era-codes.xlsx");
const fallbackSrc = "C:/Users/ASUS G752VT/Downloads/Nafta services Chingiz.xlsx";
const xlsxPath = fs.existsSync(src) ? src : fallbackSrc;

if (!fs.existsSync(xlsxPath)) {
  console.error("[chingiz-prices] xlsx not found:", src, "or", fallbackSrc);
  process.exit(1);
}

function pick(r, keys) {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function numPrice(v) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const wb = XLSX.readFile(xlsxPath);
const sheet = wb.Sheets.tariff || wb.Sheets[wb.SheetNames[0]];
const tariff = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

const byCode = new Map();
const dupes = [];
for (const r of tariff) {
  const code = pick(r, ["era_code"]);
  if (!code) continue;
  const row = {
    code,
    descriptionAz: pick(r, ["Имя", "name_az"]),
    descriptionRu: pick(r, ["Рус", "name_ru"]),
    descriptionEn: pick(r, ["Eng", "name_en", "era_title_en"]),
    description: pick(r, ["Рус", "Имя", "Eng"]) || code,
    amount: numPrice(pick(r, ["Цена", "price"])),
    packageIncluded: false,
    department: pick(r, ["Имя группы", "group"]) || null,
  };
  if (byCode.has(code)) {
    const prev = byCode.get(code);
    dupes.push({ code, kept: prev.amount, skipped: row.amount });
    if (row.amount > prev.amount) {
      byCode.set(code, {
        ...row,
        descriptionAz: row.descriptionAz || prev.descriptionAz,
        descriptionRu: row.descriptionRu || prev.descriptionRu,
        descriptionEn: row.descriptionEn || prev.descriptionEn,
        description: row.description || prev.description,
      });
    }
    continue;
  }
  byCode.set(code, row);
}

const chingiz = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
const chingizPath = path.join(seedDir, "chingiz-tariff-prices.json");
fs.writeFileSync(chingizPath, JSON.stringify(chingiz, null, 2) + "\n", "utf8");

const eraPath = path.join(seedDir, "era-prices.json");
const existing = JSON.parse(fs.readFileSync(eraPath, "utf8"));
if (!Array.isArray(existing)) throw new Error("era-prices.json must be an array");
const merged = new Map();
for (const row of existing) {
  const code = String(row.code || "").trim();
  if (code) merged.set(code, row);
}
for (const row of chingiz) merged.set(row.code, row);
const out = [...merged.values()].sort((a, b) =>
  String(a.code).localeCompare(String(b.code)),
);
fs.writeFileSync(eraPath, JSON.stringify(out, null, 2) + "\n", "utf8");

console.log("[chingiz-prices] xlsx", xlsxPath);
console.log("[chingiz-prices] unique era_code", chingiz.length, "dupes skipped", dupes.length);
console.log("[chingiz-prices] wrote", chingizPath);
console.log("[chingiz-prices] era-prices merged", existing.length, "->", out.length);
if (dupes.length) console.log("[chingiz-prices] first dupes", dupes.slice(0, 8));
