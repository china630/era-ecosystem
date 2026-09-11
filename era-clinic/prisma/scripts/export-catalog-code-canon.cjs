/**
 * Export platform diagnostic catalog + proposed FAMILY-ENGLISH_SLUG codes.
 * Run: node prisma/scripts/export-catalog-code-canon.cjs
 */
"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const root = path.join(__dirname, "..");
const catalog = JSON.parse(
  fs.readFileSync(path.join(root, "seed-data", "diagnostic-lab-catalog.json"), "utf8"),
);

/** @type {Record<string, string>} */
const VISIT_PROPOSED = {
  "GP-VISIT": "VISIT-GP",
  "CARDIO-VISIT": "VISIT-CARDIO",
  "GYN-VISIT": "VISIT-GYN",
  "PED-VISIT": "VISIT-PED",
  "ENT-VISIT": "VISIT-ENT",
  "NEURO-VISIT": "VISIT-NEURO",
  "ENDO-VISIT": "VISIT-ENDOCRINE",
  "URO-VISIT": "VISIT-URO",
  "DERM-VISIT": "VISIT-DERM",
  "PULM-VISIT": "VISIT-PULM",
  "ORTHO-VISIT": "VISIT-ORTHO",
  "CHECKUP-VISIT": "VISIT-CHECKUP",
  "SANATORIUM-INTAKE": "VISIT-SANATORIUM-INTAKE",
};

/** @type {Record<string, string>} */
const CARDIO_PROPOSED = {
  "ECG-12": "CARDIO-ECG",
  HOLTER: "CARDIO-HOLTER",
  ABPM: "CARDIO-ABPM",
  "ECHO-CG": "CARDIO-ECHO",
  "STRESS-ECG": "CARDIO-STRESS-ECG",
  "STRESS-ECHO": "CARDIO-STRESS-ECHO",
  TEE: "CARDIO-TEE",
  "CORO-REPORT": "CARDIO-CORO-REPORT",
};

/** @type {Record<string, string>} */
const FUNC_PROPOSED = {
  SPIRO: "FUNC-SPIRO",
  EEG: "FUNC-EEG",
  EMG: "FUNC-EMG",
  AUDIO: "FUNC-AUDIO",
  "OPHTH-DX": "FUNC-OPHTH",
  "DERM-DX": "FUNC-DERM",
  "SPIRO-BD": "FUNC-SPIRO-BD",
  PEF: "FUNC-PEF",
  TYMP: "FUNC-TYMP",
  VEST: "FUNC-VEST",
  "ENT-EXAM": "FUNC-ENT-EXAM",
  COLPO: "FUNC-COLPO",
  "UREA-BREATH": "FUNC-UREA-BREATH",
  EP: "FUNC-EP",
  PSG: "FUNC-PSG",
  STABILO: "FUNC-STABILO",
};

/** @type {Record<string, string>} */
const ENDO_PROPOSED = {
  EGD: "ENDO-EGD",
  COLONO: "ENDO-COLONO",
  BRONCHO: "ENDO-BRONCHO",
  RRS: "ENDO-RRS",
  CYSTO: "ENDO-CYSTO",
  "RHINO-ENDO": "ENDO-RHINO",
  LARYNGO: "ENDO-LARYNGO",
};

const EXTRA = {
  DXA: "DENSITOMETRY-DXA",
  "LAB-VITMIN": "LAB-VITAMIN",
};

function propose(family, code) {
  if (VISIT_PROPOSED[code]) return VISIT_PROPOSED[code];
  if (CARDIO_PROPOSED[code]) return CARDIO_PROPOSED[code];
  if (FUNC_PROPOSED[code]) return FUNC_PROPOSED[code];
  if (ENDO_PROPOSED[code]) return ENDO_PROPOSED[code];
  if (EXTRA[code]) return EXTRA[code];
  return code;
}

function action(oldCode, proposed) {
  if (oldCode === proposed) return "keep";
  if (oldCode === "LAB-VITMIN") return "fix-typo";
  if (oldCode.endsWith("-VISIT") || oldCode === "SANATORIUM-INTAKE") return "flip-prefix";
  if (proposed.startsWith(oldCode.split("-")[0] === proposed.split("-")[0] ? "x" : "")) {
    /* fallthrough */
  }
  const oldFam = oldCode.includes("-") ? oldCode.slice(0, oldCode.indexOf("-")) : "";
  const newFam = proposed.includes("-") ? proposed.slice(0, proposed.indexOf("-")) : "";
  if (oldFam && oldFam === newFam) return "keep";
  return "add-family-prefix";
}

function actionFor(oldCode, proposed, family) {
  if (oldCode === proposed) return "keep";
  if (oldCode === "LAB-VITMIN") return "fix-typo";
  if (VISIT_PROPOSED[oldCode]) return "flip-prefix";
  if (family === "CARDIO" || family === "FUNC" || family === "ENDO" || oldCode === "DXA") {
    return "add-family-prefix";
  }
  return "rename";
}

const serviceRows = [];

function pushRow(layer, family, kind, code, serviceCode, title, category) {
  const proposed = propose(family, code);
  const proposedService = propose(family, serviceCode || code);
  serviceRows.push({
    layer,
    family,
    kind,
    category: category || "",
    old_code: code,
    old_service_code: serviceCode || code,
    proposed_code: proposed,
    proposed_service_code: proposedService,
    action: actionFor(code, proposed, family),
    title_en: title?.en || "",
    title_ru: title?.ru || "",
    title_az: title?.az || "",
  });
}

for (const m of catalog.modalities || []) {
  serviceRows.push({
    layer: "modality",
    family: m.code,
    kind: m.kind,
    category: "",
    old_code: m.code,
    old_service_code: m.code,
    proposed_code: m.code,
    proposed_service_code: m.code,
    action: "keep",
    title_en: m.title?.en || "",
    title_ru: m.title?.ru || "",
    title_az: m.title?.az || "",
  });
  for (const t of m.templates || []) {
    pushRow("service", m.code, m.kind, t.code, t.serviceCode, t.title, t.category);
  }
}
for (const p of catalog.labPanels || []) {
  pushRow(
    "lab_panel",
    "LAB",
    "lab_panel",
    p.code,
    p.serviceCode,
    p.title,
    p.category,
  );
}
for (const v of catalog.visitTemplates || []) {
  pushRow("visit", "VISIT", "visit", v.code, v.serviceCode || v.code, v.title, v.specialty);
}
for (const pkg of catalog.packages || []) {
  const oldIncludes = pkg.includes || [];
  const newIncludes = oldIncludes.map((c) => propose("", c) === c ? (VISIT_PROPOSED[c] || CARDIO_PROPOSED[c] || FUNC_PROPOSED[c] || ENDO_PROPOSED[c] || EXTRA[c] || c) : propose("", c));
  const mapped = oldIncludes.map((c) => VISIT_PROPOSED[c] || CARDIO_PROPOSED[c] || FUNC_PROPOSED[c] || ENDO_PROPOSED[c] || EXTRA[c] || c);
  serviceRows.push({
    layer: "package",
    family: "PACKAGE",
    kind: "package",
    category: "",
    old_code: pkg.code,
    old_service_code: pkg.code,
    proposed_code: pkg.code,
    proposed_service_code: pkg.code,
    action: mapped.join(",") === oldIncludes.join(",") ? "keep" : "rewrite-includes",
    title_en: pkg.title?.en || "",
    title_ru: pkg.title?.ru || "",
    title_az: pkg.title?.az || "",
    old_includes: oldIncludes.join(","),
    proposed_includes: mapped.join(","),
  });
}

const map = {};
for (const r of serviceRows) {
  if (r.layer === "modality") continue;
  if (r.old_code !== r.proposed_code) map[r.old_code] = r.proposed_code;
  if (r.old_service_code !== r.proposed_service_code) {
    map[r.old_service_code] = r.proposed_service_code;
  }
}

const notes = [
  {
    rule: "canon",
    text: "{FAMILY}-{ENGLISH_SLUG}. Codes are English; az/ru/en stay in titles.",
  },
  {
    rule: "visit",
    text: "VISIT-GYN not GYN-VISIT. Endocrinology = VISIT-ENDOCRINE (not VISIT-ENDO: endoscopy modality).",
  },
  {
    rule: "cardio",
    text: "CARDIO- prefix = heart studies only. Visit = VISIT-CARDIO. ECG-12 → CARDIO-ECG, ECHO-CG → CARDIO-ECHO.",
  },
  {
    rule: "usg-xr-ct-mri-lab",
    text: "Already FAMILY-slug English — keep (except LAB-VITMIN typo → LAB-VITAMIN).",
  },
  {
    rule: "func-endo",
    text: "Bare SPIRO/EGD get FUNC-/ENDO- prefix to match USG-THYROID pattern.",
  },
  {
    rule: "scope",
    text: "This file is platform base (diagnostic-lab-catalog.json), not Nafta tariff/era-prices. Nafta Excel maps onto proposed_code later.",
  },
];

const outDir = path.join(root, "seed-data");
const csvPath = path.join(outDir, "catalog-code-canon.csv");
const jsonPath = path.join(outDir, "catalog-code-canon.map.json");
const xlsxPath = path.join(outDir, "catalog-code-canon.xlsx");

const csvHeader = [
  "layer",
  "family",
  "kind",
  "category",
  "old_code",
  "old_service_code",
  "proposed_code",
  "proposed_service_code",
  "action",
  "title_en",
  "title_ru",
  "title_az",
  "old_includes",
  "proposed_includes",
];

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const csvBody = [csvHeader.join(",")]
  .concat(
    serviceRows.map((r) =>
      csvHeader.map((h) => csvEscape(r[h])).join(","),
    ),
  )
  .join("\n");

fs.writeFileSync(csvPath, csvBody + "\n", "utf8");
/** Historical old→new aliases. After seed apply, catalog codes already match proposed — do not wipe. */
let persistedMap = map;
if (Object.keys(map).length === 0 && fs.existsSync(jsonPath)) {
  persistedMap = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
} else if (fs.existsSync(jsonPath)) {
  const existing = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  persistedMap = { ...existing, ...map };
}
fs.writeFileSync(jsonPath, JSON.stringify(persistedMap, null, 2) + "\n", "utf8");

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(serviceRows);
XLSX.utils.book_append_sheet(wb, ws, "platform-catalog");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notes), "canon-rules");
const changed = serviceRows.filter((r) => r.action !== "keep");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(changed), "renames-only");
XLSX.writeFile(wb, xlsxPath);

const counts = {};
for (const r of serviceRows) counts[r.action] = (counts[r.action] || 0) + 1;
console.log("[catalog-code-canon] rows", serviceRows.length, counts);
console.log("wrote", csvPath);
console.log("wrote", xlsxPath);
console.log("wrote", jsonPath, "renames", Object.keys(map).length);
