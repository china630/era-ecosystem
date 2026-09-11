/**
 * Restore az/ru/en/price/group wiped by the second annotate pass.
 * Sources: chat dump TSV + era-prices.json for remaining SVC.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const root = path.join(__dirname, "..", "seed-data", "nafta");
const tsvPath = path.join(root, "_restore-chingiz-from-chat.tsv");
const xlsxPath =
  process.argv[2] ||
  "C:/Users/ASUS G752VT/Downloads/Nafta services Chingiz.xlsx";
const repoOut = path.join(root, "nafta-tariff-era-codes.xlsx");

function parseTsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.length);
  const header = lines[0].split("\t");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const o = {};
    header.forEach((h, idx) => {
      o[h] = cols[idx] == null ? "" : cols[idx];
    });
    if (o.code) rows.push(o);
  }
  return rows;
}

const dumped = parseTsv(fs.readFileSync(tsvPath, "utf8"));
const byCode = new Map();
for (const r of dumped) byCode.set(r.code, r);

const prices = JSON.parse(fs.readFileSync(path.join(root, "era-prices.json"), "utf8"));
for (const p of prices) {
  const code = String(p.code || "").trim();
  if (!code || byCode.has(code)) continue;
  byCode.set(code, {
    code,
    az: p.descriptionAz || p.description || "",
    ru: p.descriptionRu || "",
    en: p.descriptionEn || "",
    price: p.amount == null ? "" : String(p.amount),
    group: p.department || "",
  });
}

const wb = XLSX.readFile(xlsxPath);
const cur = XLSX.utils.sheet_to_json(wb.Sheets.tariff, { defval: "", raw: false });

const out = cur.map((r) => {
  const code = String(r.code || "").trim();
  const src = byCode.get(code) || {};
  return {
    n: r.n,
    code,
    era_code: r.era_code,
    match: r.match,
    era_title_en: r.era_title_en,
    Имя: src.az || "",
    Рус: src.ru || "",
    Eng: src.en || "",
    Цена: src.price || r.price || "",
    "Код Вал.": r.currency || "AZN",
    "Имя группы": src.group != null && src.group !== "" ? src.group : r.group || "",
    "Наз-ние Дохода": r.income || "SPA MEDIKAL",
  };
});

const missing = out.filter((r) => !r.Имя);
const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, XLSX.utils.json_to_sheet(out), "tariff");
for (const name of wb.SheetNames) {
  if (name === "tariff") continue;
  XLSX.utils.book_append_sheet(outWb, wb.Sheets[name], name);
}
XLSX.writeFile(outWb, xlsxPath);
XLSX.writeFile(outWb, repoOut);
console.log("[restore] rows", out.length, "named", out.length - missing.length, "missing az", missing.length);
missing.forEach((r) => console.log("  missing", r.code));
