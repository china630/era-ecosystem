#!/usr/bin/env node
/**
 * Build Guest Id → sex/DOB overlay from local EW Excel + WebOnly FO dump.
 * PII stays under D:\ERA-BACKUP — do not commit the JSON.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require(path.join(__dirname, "..", "era-hotel-pms", "node_modules", "xlsx"));

const EW_PATHS = [
  path.join("D:", "ERA-BACKUP", "NAFTA-ERA-READY", "hotel", "10-Guest-Cards.xlsx"),
  path.join("D:", "ERA-BACKUP", "NAFTA-START", "hotel", "10-Guest-Cards.xlsx"),
];
const FO_PATH = path.join("D:", "ERA-BACKUP", "NAFTA-START", "hotel", "dump", "guest-cards.json");
const OUT_PATH = path.join("D:", "ERA-BACKUP", "NAFTA-START", "hotel", "dump", "guest-demographics-overlay.json");

function mapGender(g) {
  if (g === 0 || g === "0" || g === 2 || g === "2") return "M";
  if (g === 1 || g === "1") return "F";
  if (typeof g === "string") {
    const u = g.trim().toUpperCase();
    if (u === "M" || u === "MALE" || u.startsWith("0 ")) return "M";
    if (u === "F" || u === "FEMALE" || u.startsWith("1 ")) return "F";
  }
  return null;
}

function ymd(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    if (y < 1900 || y > 2026) return null;
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed || parsed.y < 1900) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return null;
}

function foldName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const byId = {};
const byName = {};

function put(id, name, sex, birthDate, source) {
  const rec = { externalRef: id || null, fullName: name || null, sex, birthDate, source };
  if (id) {
    const prev = byId[id];
    if (!prev) byId[id] = rec;
    else {
      if (!prev.sex && rec.sex) prev.sex = rec.sex;
      if (!prev.birthDate && rec.birthDate) prev.birthDate = rec.birthDate;
    }
  }
  const fold = foldName(name);
  if (fold && (sex || birthDate)) {
    if (!byName[fold]) byName[fold] = [];
    byName[fold].push(rec);
  }
}

const ewPath = EW_PATHS.find((p) => fs.existsSync(p));
if (!ewPath) {
  console.error("No guest-cards xlsx found");
  process.exit(1);
}
const wb = XLSX.read(fs.readFileSync(ewPath), { type: "buffer", cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
let excelWithDemo = 0;
for (const row of rows) {
  const id = String(row["Guest Id"] ?? row.Id ?? "").trim();
  const name = `${String(row.Name ?? "").trim()} ${String(row["Last Name"] ?? "").trim()}`.trim();
  const sex = mapGender(row.Gender ?? row.GENDER);
  const birthDate = ymd(row["Birth Date"] ?? row.BIRTHDATE);
  if (sex || birthDate) excelWithDemo += 1;
  if (id) put(id, name, sex, birthDate, "excel");
}

let foWithDemo = 0;
if (fs.existsSync(FO_PATH)) {
  const cards = JSON.parse(fs.readFileSync(FO_PATH, "utf8"));
  for (const card of cards) {
    const id = String(card.id ?? "").trim();
    const name = `${card.name ?? ""} ${card.surname ?? ""}`.trim();
    const sex = mapGender(card.gender);
    const birthDate = ymd(card.birthDate);
    if (sex || birthDate) foWithDemo += 1;
    put(`wo:fo:${id}`, name, sex, birthDate, "fo");
  }
}

const nameUnique = {};
for (const [fold, list] of Object.entries(byName)) {
  const sexes = [...new Set(list.map((x) => x.sex).filter(Boolean))];
  const dobs = [...new Set(list.map((x) => x.birthDate).filter(Boolean))];
  if (sexes.length <= 1 && dobs.length <= 1 && (sexes[0] || dobs[0])) {
    nameUnique[fold] = { sex: sexes[0] || null, birthDate: dobs[0] || null };
  }
}

fs.writeFileSync(
  OUT_PATH,
  JSON.stringify({
    builtAt: new Date().toISOString(),
    excelPath: ewPath,
    excelRows: rows.length,
    excelWithDemo,
    foWithDemo,
    byIdCount: Object.keys(byId).length,
    nameUniqueCount: Object.keys(nameUnique).length,
    byId,
    nameUnique,
  }),
);
console.log(
  JSON.stringify(
    { outPath: OUT_PATH, excelRows: rows.length, excelWithDemo, foWithDemo, byIdCount: Object.keys(byId).length, nameUniqueCount: Object.keys(nameUnique).length },
    null,
    2,
  ),
);
