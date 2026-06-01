#!/usr/bin/env node
/**
 * Dev/staging: migrate subscription activeModules JSON slugs to canonical names.
 * Usage: node scripts/migrate-industry-module-slugs.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";

const SLUG_MAP = {
  industry_fnb_pos: "industry_fnb_pos",
  industry_retail: "industry_retail",
  industry_logistics: "industry_logistics",
  industry_crm: "industry_crm",
  industry_auto_service: "industry_auto_service",
};

const dryRun = process.argv.includes("--dry-run");
const inputPath = process.argv.find((a) => a.endsWith(".json"));
if (!inputPath) {
  console.error(
    "Pass a JSON export of activeModules arrays, e.g. [{\"orgId\":\"…\",\"activeModules\":[…]}]",
  );
  process.exit(1);
}

const rows = JSON.parse(readFileSync(inputPath, "utf8"));
let changed = 0;

for (const row of rows) {
  const mods = row.activeModules;
  if (!Array.isArray(mods)) continue;
  const next = mods.map((s) => SLUG_MAP[s] ?? s);
  if (JSON.stringify(next) !== JSON.stringify(mods)) {
    changed += 1;
    row.activeModules = next;
    if (!dryRun) {
      console.log(row.orgId ?? row.id ?? "(row)", mods, "->", next);
    }
  }
}

if (dryRun) {
  console.log(`Would update ${changed} row(s). Re-run without --dry-run to write.`);
} else {
  writeFileSync(inputPath, JSON.stringify(rows, null, 2));
  console.log(`Updated ${changed} row(s) in ${inputPath}`);
}
