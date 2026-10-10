/**
 * Collapse lab-panel analytes into one unscoped dictionary.
 * Source: prisma/seed-data/diagnostic-lab-catalog.json
 * Output: prisma/seed-data/analyte-dictionary.json
 *
 * Same code keeps the first non-empty unit / range / label. A later row
 * fills a blank field and does not replace a value that is already set.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(dir, "..", "seed-data", "diagnostic-lab-catalog.json");
const outPath = path.join(dir, "..", "seed-data", "analyte-dictionary.json");

function blank(value) {
  return value == null || String(value).trim() === "";
}

function mergeLabel(prev, next) {
  return {
    en: blank(prev?.en) ? (next?.en ?? "") : prev.en,
    ru: blank(prev?.ru) ? (next?.ru ?? "") : prev.ru,
    az: blank(prev?.az) ? (next?.az ?? "") : prev.az,
  };
}

export function collectAnalyteDictionary(catalog) {
  const byCode = new Map();
  let copies = 0;
  for (const panel of catalog.labPanels ?? []) {
    for (const analyte of panel.analytes ?? []) {
      const code = String(analyte.code ?? "").trim();
      if (!code) continue;
      copies += 1;
      const incoming = {
        code,
        unit: blank(analyte.unit) ? null : String(analyte.unit).trim(),
        label: {
          en: analyte.label?.en ?? "",
          ru: analyte.label?.ru ?? "",
          az: analyte.label?.az ?? "",
        },
        refMin: blank(analyte.refMin) ? null : String(analyte.refMin).trim(),
        refMax: blank(analyte.refMax) ? null : String(analyte.refMax).trim(),
        section: blank(analyte.section) ? null : String(analyte.section).trim(),
        valueType: analyte.valueType === "QUALITATIVE" ? "QUALITATIVE" : "NUMERIC",
      };
      const prev = byCode.get(code);
      if (!prev) {
        byCode.set(code, incoming);
        continue;
      }
      prev.unit = blank(prev.unit) ? incoming.unit : prev.unit;
      prev.refMin = blank(prev.refMin) ? incoming.refMin : prev.refMin;
      prev.refMax = blank(prev.refMax) ? incoming.refMax : prev.refMax;
      prev.section = blank(prev.section) ? incoming.section : prev.section;
      prev.label = mergeLabel(prev.label, incoming.label);
      if (prev.valueType !== "QUALITATIVE" && incoming.valueType === "QUALITATIVE") {
        prev.valueType = "QUALITATIVE";
      }
    }
  }
  const items = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  return { items, copies };
}

function stripNulls(row) {
  const out = { code: row.code, label: row.label, valueType: row.valueType };
  if (row.unit) out.unit = row.unit;
  if (row.refMin) out.refMin = row.refMin;
  if (row.refMax) out.refMax = row.refMax;
  if (row.section) out.section = row.section;
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  const { items, copies } = collectAnalyteDictionary(catalog);
  const payload = {
    version: 1,
    source: "diagnostic-lab-catalog.json labPanels",
    items: items.map(stripNulls),
  };
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `[analyte-dictionary] copies=${copies} unique=${items.length} -> ${path.relative(process.cwd(), outPath)}`,
  );
}
