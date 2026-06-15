#!/usr/bin/env node
/**
 * Static audit: MDM identity patterns per app.
 * Usage: node scripts/audit-mdm-identity.mjs
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
const issues = [];

for (const file of files) {
  const rel = file.replace(ROOT, "").replace(/\\/g, "/");
  if (!rel.match(/^era-(clinic|hotel-pms|finance-core|bank-core|fnb-pos)/)) continue;
  const text = readFileSync(file, "utf8");
  const isRoute =
    rel.includes("/app/api/") &&
    (text.includes("export async function POST") || text.includes("export async function PATCH"));
  if (!isRoute) continue;
  const usesLookup = text.includes("lookupGlobalPersonByFin");
  const usesLink = text.includes("linkPersonIdentity");
  const usesResolve = text.includes("resolvePersonIdentity");
  if (usesLookup && !usesLink && !usesResolve) {
    issues.push({ file: rel, issue: "lookup-only create/update route" });
  }
}

console.log(`MDM identity audit — ${issues.length} issue(s)\n`);
for (const i of issues) {
  console.log(`  ${i.issue}: ${i.file}`);
}
process.exitCode = issues.length > 0 ? 1 : 0;
