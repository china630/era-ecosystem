#!/usr/bin/env node
/**
 * Static audit: reference-data consumption boundaries.
 * Fails if industry satellites grep ERA_DATA_HUB or /registry/v1.
 * Usage: node scripts/audit-reference-data.mjs
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const ALLOWED_HUB_APPS = new Set([
  "era-data-hub",
  "era-finance-core",
  "era-bank-core",
  "packages",
  "scripts",
  "docs",
  ".github",
]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|mjs|env|yml|yaml|md)$/.test(name)) acc.push(p);
  }
  return acc;
}

const issues = [];
const files = walk(ROOT);

for (const file of files) {
  const rel = file.replace(ROOT, "").replace(/\\/g, "/").replace(/^\//, "");
  const top = rel.split("/")[0];
  if (!top.startsWith("era-") && !top.startsWith("packages")) continue;
  if (ALLOWED_HUB_APPS.has(top)) continue;
  if (top === "era-orchestrator") continue;

  const text = readFileSync(file, "utf8");
  if (text.includes("ERA_DATA_HUB_URL") || text.includes("ERA_DATA_HUB_ENABLED")) {
    issues.push({ file: rel, issue: "ERA_DATA_HUB_* env in industry satellite" });
  }
  if (/\/registry\/v1/.test(text) && !rel.includes("clone-spec") && !rel.includes("doc/")) {
    issues.push({ file: rel, issue: "direct /registry/v1 reference" });
  }
}

console.log(`Reference data audit — ${issues.length} issue(s)\n`);
for (const i of issues) {
  console.log(`  ${i.issue}: ${i.file}`);
}
process.exitCode = issues.length > 0 ? 1 : 0;
