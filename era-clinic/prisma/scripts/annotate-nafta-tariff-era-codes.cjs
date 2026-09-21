/**
 * Add era_code / match / era_title_en to Nafta tariff xlsx (Downloads).
 * Run: node prisma/scripts/annotate-nafta-tariff-era-codes.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const SRC =
  process.argv[2] ||
  "C:/Users/ASUS G752VT/Downloads/Nafta services Chingiz.xlsx";
const OUT_DOWNLOADS = SRC;
const OUT_REPO = path.join(__dirname, "..", "seed-data", "nafta", "nafta-tariff-era-codes.xlsx");

const catalog = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "seed-data", "diagnostic-lab-catalog.json"), "utf8"),
);
const codeMap = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "seed-data", "catalog-code-canon.map.json"), "utf8"),
);

/** tariff.code → platform proposed_code */
const ALIAS = {
  "CARDIO-EKQ": "CARDIO-ECG",
  "CARDIO-EXO": "CARDIO-ECHO",
  "VISIT-TERAPEVT": "VISIT-GP",
  "VISIT-KARDIOLOQ": "VISIT-CARDIO",
  "VISIT-GINEKOLOQ": "VISIT-GYN",
  "VISIT-UROLOQ": "VISIT-URO",
  "VISIT-DERMATOLOQ": "VISIT-DERM",
  "VISIT-NEVROLOQ": "VISIT-NEURO",
  "VISIT-BAS-HEKIM": "VISIT-CHECKUP",
  "USG-TIROID": "USG-THYROID",
  "USG-SUD-VEZLERI": "USG-BREAST",
  "USG-PELVIK": "USG-PELVIC",
  "USG-GINEKOLOJI": "USG-PELVIC",
  "USG-BOYREKLER": "USG-KIDNEY",
  "USG-UMUMI-ABDOMINAL": "USG-ABD",
  "USG-UST-ABDOMINAL": "USG-ABD",
  "USG-HAMILELIK-KICIK": "USG-OBST-T1",
  "USG-HAMILELIK-BOYUK": "USG-OBST-T3",
  "USG-LIMFA-DUYUNLERI": "USG-NECK-LN",
  "USG-BUD-CANAQ": "USG-MSK",
  "USG-DOPLER-1-ETRAF": "USG-VEIN-LL",
  "USG-DOPLER-2-ETRAF": "USG-VEIN-LL",
  "USG-SKROTAL": "USG-PROSTATE",
  "USG-UROLOJI": "USG-PROSTATE",
  "USG-QARA-CIYER-OD-KISESI": "USG-ABD",
  "LAB-PANEL-QANIN-UMUMI-ANALIZI-18": "LAB-CBC",
  "LAB-PANEL-QARA-CIYER": "LAB-LIVER",
  "LAB-PANEL-BOYREK": "LAB-RENAL",
  "LAB-PANEL-ELEKTROLIT": "LAB-ELECTRO",
  "LAB-PANEL-KARDIAL": "LAB-CARDIAC",
  "LAB-PANEL-UMUMI-MUAYINE": "LAB-BIOCHEM",
  "LAB-KAQULOQRAMMA": "LAB-COAG",
  "LAB-SIDIYIN-UMUMI-ANALIZI": "LAB-URINE",
  "LAB-SPERMOGRAM": "LAB-SEMEN",
  "LAB-LEYKOFORMULA": "LAB-DIFF",
  "LAB-YAXMA-MIKROSKOPIYASI": "LAB-SMEAR",
  "LAB-URETRAL-VAGINAL-YAXMA": "LAB-GYN-SMEAR",
  "LAB-THYROID-STIMULATING-HORMONE": "LAB-TSH",
  "LAB-XOLESTEROL": "LAB-CHOL",
  "LAB-XOLESTEROL-HDL": "LAB-HDL",
  "LAB-XOLESTEROL-LDL": "LAB-LDL",
  "LAB-XOLESTEROL-VLDL": "LAB-VLDL",
  "LAB-TRIQLISERIDLER": "LAB-TRIG",
  "LAB-QAN-ZERDABINDA-SEKER": "LAB-GLUCOSE",
};

const LAB_ENGLISH = {
  "LAB-ESTRADIOL-DIAGNOSTIC-KIT": "LAB-ESTRADIOL",
  "LAB-FREE-PROSTATE-SPECIFIC-ANTIGEN": "LAB-FPSA",
  "LAB-FREE-THYROXINE": "LAB-FT4",
  "LAB-FREE-TRIIODOTHYRONINE": "LAB-FT3",
  "LAB-PROSTATE-SPECIFIC-ANTIGEN": "LAB-PSA",
  "LAB-THYROXINE": "LAB-T4",
  "LAB-TRIIODOTHYRONINE": "LAB-T3",
  "LAB-TOTAL-IMMUNOGLOBULIN-E": "LAB-IGE",
  "LAB-REVMATIK-FAKTOR": "LAB-RF",
  "LAB-C-REACTIVE-PROTEIN-CRP": "LAB-CRP",
  "LAB-HBA1C-GLYCOSYLATED-HEMOGLOBIN": "LAB-HBA1C",
  "LAB-MAU-URINARY-MICROALBUMIN": "LAB-MAU",
  "LAB-QAN-ZERDABINDA-SEKER": "LAB-GLUCOSE",
  "LAB-SIDIK-COVHERI": "LAB-UREA",
  "LAB-SIDIK-TURSUSU": "LAB-URIC-ACID",
  "LAB-CREATININ": "LAB-CREATININE",
  "LAB-KALSIUM": "LAB-CALCIUM",
  "LAB-PROTROMBIN": "LAB-PT",
  "LAB-ANTI-TPO": "LAB-ANTI-TPO",
  "LAB-AF-GENITAL": "LAB-AF-GENITAL",
};

const titles = new Map();
function addTitle(code, title) {
  if (!code) return;
  titles.set(code, title?.en || title || "");
}
for (const m of catalog.modalities || []) {
  addTitle(m.code, m.title);
  for (const t of m.templates || []) {
    addTitle(t.code, t.title);
    addTitle(t.serviceCode, t.title);
  }
}
for (const p of catalog.labPanels || []) addTitle(p.code, p.title);
for (const v of catalog.visitTemplates || []) addTitle(v.code, v.title);
for (const [oldC, neu] of Object.entries(codeMap)) {
  if (!titles.has(neu) && titles.has(oldC)) titles.set(neu, titles.get(oldC));
}

const proposedSet = new Set([...titles.keys(), ...Object.values(codeMap)]);

function toProposed(code) {
  if (codeMap[code]) return codeMap[code];
  return code;
}

function resolve(tariffCode) {
  const c = String(tariffCode || "").trim();
  if (!c) return { era_code: "", match: "empty", era_title_en: "" };

  if (ALIAS[c]) {
    const era = ALIAS[c];
    const note =
      c === "USG-DOPLER-2-ETRAF" || c === "USG-UST-ABDOMINAL" || c === "USG-QARA-CIYER-OD-KISESI"
        ? "alias-coarse"
        : c === "VISIT-BAS-HEKIM"
          ? "alias-review"
          : "alias";
    return { era_code: era, match: note, era_title_en: titles.get(era) || "" };
  }

  const asProposed = toProposed(c);
  if (proposedSet.has(c) || proposedSet.has(asProposed)) {
    const era = proposedSet.has(asProposed) ? asProposed : c;
    const canon = codeMap[era] || era;
    return { era_code: canon, match: "platform", era_title_en: titles.get(canon) || titles.get(era) || "" };
  }

  if (LAB_ENGLISH[c]) {
    return {
      era_code: LAB_ENGLISH[c],
      match: "new-sku",
      era_title_en: titles.get(LAB_ENGLISH[c]) || "",
    };
  }

  if (/^(LAB|SVC|USG|VISIT|CARDIO)-[A-Za-z0-9-]+$/.test(c)) {
    return { era_code: c, match: "new-sku", era_title_en: "" };
  }

  return { era_code: "", match: "review", era_title_en: "" };
}

const wb = XLSX.readFile(SRC);
const tariff = XLSX.utils.sheet_to_json(wb.Sheets.tariff, { defval: "", raw: false });

function pick(r, keys) {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return "";
}

const outRows = tariff.map((r) => {
  const hit = resolve(r.code);
  return {
    n: r.n,
    code: r.code,
    era_code: hit.era_code,
    match: hit.match,
    era_title_en: hit.era_title_en,
    Имя: pick(r, ["Имя", "name_az"]),
    Рус: pick(r, ["Рус", "name_ru", "__EMPTY"]),
    Eng: pick(r, ["Eng", "name_en", "__EMPTY_1"]),
    Цена: pick(r, ["Цена", "price"]),
    "Код Вал.": pick(r, ["Код Вал.", "currency"]) || "AZN",
    "Имя группы": pick(r, ["Имя группы", "group"]),
    "Наз-ние Дохода": pick(r, ["Наз-ние Дохода", "income"]) || "SPA MEDIKAL",
  };
});

const counts = {};
for (const r of outRows) counts[r.match] = (counts[r.match] || 0) + 1;

const missingName = outRows.filter((r) => !r.Имя);
if (missingName.length) {
  throw new Error("Refusing to write: " + missingName.length + " rows missing Имя");
}

const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, XLSX.utils.json_to_sheet(outRows), "tariff");
for (const name of wb.SheetNames) {
  if (name === "tariff") continue;
  XLSX.utils.book_append_sheet(outWb, wb.Sheets[name], name);
}

XLSX.writeFile(outWb, OUT_DOWNLOADS);
fs.mkdirSync(path.dirname(OUT_REPO), { recursive: true });
XLSX.writeFile(outWb, OUT_REPO);

console.log("[annotate] rows", outRows.length, counts);
console.log("wrote", OUT_DOWNLOADS);
console.log("wrote", OUT_REPO);
const missing = outRows.filter((r) => !r.era_code);
console.log("without era_code", missing.length);
missing.slice(0, 40).forEach((r) => console.log(" ", r.code, r.Имя));
