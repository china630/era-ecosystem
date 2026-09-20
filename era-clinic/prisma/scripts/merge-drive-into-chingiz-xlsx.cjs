/**
 * Overlay Google Drive "Nafta services.xlsx" onto Chingiz (era_code columns).
 * Drive wins on price. Fill empty AZ/RU/EN from Drive. Keep Chingiz translations
 * and grouping when Drive is not filling a gap.
 *
 *   node prisma/scripts/merge-drive-into-chingiz-xlsx.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const drivePath = process.argv[2] || "C:/Users/ASUS G752VT/Downloads/Nafta services.xlsx";
const chingizPath =
  process.argv[3] || "C:/Users/ASUS G752VT/Downloads/Nafta services Chingiz.xlsx";
const seedCopy = path.join(
  __dirname,
  "..",
  "seed-data",
  "nafta",
  "nafta-tariff-era-codes.xlsx",
);

function rows(wb, name) {
  const sh = wb.Sheets[name];
  if (!sh) return [];
  return XLSX.utils.sheet_to_json(sh, { defval: "", raw: false });
}

function num(v) {
  const n = Number(String(v ?? "").replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function cell(r, keys) {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

const drive = XLSX.readFile(drivePath);
const ch = XLSX.readFile(chingizPath);
const dt = rows(drive, "tariff");
const ct = rows(ch, "tariff");
const dBy = new Map(dt.map((r) => [String(r.code || "").trim(), r]));

const priceFixes = [];
const filledTitles = [];
const merged = ct.map((c) => {
  const code = String(c.code || "").trim();
  const d = dBy.get(code);
  if (!d) return { ...c };
  const out = { ...c };
  const dPrice = num(d["Цена"]);
  const cPrice = num(c["Цена"]);
  if (dPrice !== cPrice) {
    priceFixes.push({ code, from: cPrice, to: dPrice });
    out["Цена"] = String(d["Цена"]).trim();
  }
  const dAz = cell(d, ["Имя"]);
  const dRu = cell(d, ["__EMPTY", "Рус"]);
  const dEn = cell(d, ["__EMPTY_1", "Eng"]);
  if (!cell(out, ["Имя"]) && dAz) {
    out["Имя"] = dAz;
    filledTitles.push({ code, field: "Имя" });
  }
  if (!cell(out, ["Рус"]) && dRu) {
    out["Рус"] = dRu;
    filledTitles.push({ code, field: "Рус" });
  }
  if (!cell(out, ["Eng"]) && dEn) {
    out["Eng"] = dEn;
    filledTitles.push({ code, field: "Eng" });
  }
  return out;
});

const onlyDrive = dt.filter((r) => {
  const code = String(r.code || "").trim();
  return code && !ct.some((c) => String(c.code || "").trim() === code);
});
if (onlyDrive.length) {
  for (const d of onlyDrive) {
    merged.push({
      n: d.n,
      code: d.code,
      era_code: "",
      match: "from-drive",
      era_title_en: cell(d, ["__EMPTY_1", "Eng"]),
      Имя: cell(d, ["Имя"]),
      Рус: cell(d, ["__EMPTY", "Рус"]),
      Eng: cell(d, ["__EMPTY_1", "Eng"]),
      Цена: d["Цена"],
      "Код Вал.": d["Код Вал."] || "AZN",
      "Имя группы": d["Имя группы"],
      "Наз-ние Дохода": d["Наз-ние Дохода"],
    });
  }
}

const wbOut = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbOut, XLSX.utils.json_to_sheet(merged), "tariff");
for (const extra of ["unmatched", "removed-zero", "summary"]) {
  if (ch.Sheets[extra]) {
    XLSX.utils.book_append_sheet(wbOut, ch.Sheets[extra], extra);
  }
}

XLSX.writeFile(wbOut, chingizPath);
fs.mkdirSync(path.dirname(seedCopy), { recursive: true });
fs.copyFileSync(chingizPath, seedCopy);

console.log("[merge] drive", drivePath);
console.log("[merge] wrote", chingizPath);
console.log("[merge] seed copy", seedCopy);
console.log("[merge] tariff rows", merged.length, "added from drive", onlyDrive.length);
console.log("[merge] price fixes", priceFixes.length, JSON.stringify(priceFixes));
console.log("[merge] filled empty titles", filledTitles.length);
