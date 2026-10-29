/**
 * One-shot: IR «Vəzifələr» Rəhbər → workforce_positions.leadership
 *
 * Dry-run SQL (default):
 *   node era-orchestrator/scripts/ops/apply-nafta-leadership-from-excel.mjs --xlsx "C:/path/İR proqram məlumatları.xlsx"
 *
 * Writes SQL to --out (default tmp-wf-leadership-apply.sql at repo root).
 * Does not connect to DB — apply with psql / docker exec.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const xlsxPath =
  arg("--xlsx") ||
  path.join(
    process.env.USERPROFILE || "",
    "Downloads",
    "İR proqram məlumatları.xlsx",
  );
const outPath =
  arg("--out") ||
  path.resolve("tmp-wf-leadership-apply.sql");

if (!fs.existsSync(xlsxPath)) {
  console.error("Excel not found:", xlsxPath);
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath);
const sheet = wb.Sheets["Vəzifələr"];
if (!sheet) {
  console.error("Sheet Vəzifələr missing");
  process.exit(1);
}

const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
const lead = [];
const ordinary = [];

function isLead(flag) {
  const f = String(flag).trim().toLowerCase();
  return f === "bəli" || f === "beli" || f === "yes";
}

for (const r of rows) {
  const unit = String(r["Şöbə"] || "").trim();
  const name = String(r["Vəzifə"] || "").trim();
  const flag = r["Rəhbər vəzifə (Bəli və ya Xeyr)"];
  if (!unit || !name) continue;
  if (isLead(flag)) lead.push({ unit, name });
  else ordinary.push({ unit, name });
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const lines = [];
lines.push("-- Nafta IR Vəzifələr → workforce_positions.leadership");
lines.push(`-- Source: ${xlsxPath.replace(/\\/g, "/")}`);
lines.push(`-- Leadership rows: ${lead.length}; ordinary: ${ordinary.length}`);
lines.push("BEGIN;");
lines.push("UPDATE workforce_positions p SET leadership = false");
lines.push("FROM org_units u");
lines.push("WHERE p.org_unit_id = u.id AND p.status = 'ACTIVE';");
for (const r of lead) {
  lines.push("UPDATE workforce_positions p SET leadership = true");
  lines.push("FROM org_units u");
  lines.push("WHERE p.org_unit_id = u.id AND p.status = 'ACTIVE'");
  lines.push(`  AND u.name = '${esc(r.unit)}'`);
  lines.push(`  AND p.name = '${esc(r.name)}';`);
}
lines.push(
  "SELECT count(*) FILTER (WHERE leadership) AS leadership_true, count(*) AS active",
);
lines.push("FROM workforce_positions WHERE status = 'ACTIVE';");
lines.push("COMMIT;");

fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
console.log("wrote", outPath);
console.log("leadership targets:", lead.length);
for (const r of lead) console.log(`  ${r.unit} / ${r.name}`);
