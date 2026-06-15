#!/usr/bin/env node
/**
 * CI guard: forbid NAS account code literals in finance API business logic.
 * Whitelist: resolver, seeds, scripts, validators, reports, local-mock-seed.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN = join(ROOT, "era-finance-core/apps/api/src");

const WHITELIST_PATHS = [
  "/accounting/posting/posting-account-resolver",
  "/accounting/posting/posting-roles",
  "/scripts/local-mock-seed",
  "/banking/banking-registry.helper",
  "/banking/banking.service",
  "/common/cash-account-code.util",
  "/reports/",
  "/reporting/",
  "/kassa/cash-order.service",
];

const LITERAL_RE = /accountCode:\s*["'`]\d{3}(?:\.\d+)?["'`]|["'`]\d{3}(?:\.\d+)?["'`]\s*,\s*(?:debit|credit)/g;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === "dist") continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts)$/.test(name)) acc.push(p);
  }
  return acc;
}

const issues = [];
for (const file of walk(SCAN)) {
  const rel = file.replace(ROOT, "").replace(/\\/g, "/");
  if (WHITELIST_PATHS.some((w) => rel.includes(w))) continue;
  const text = readFileSync(file, "utf8");
  const matches = text.match(LITERAL_RE);
  if (matches?.length) {
    issues.push({ file: rel, count: matches.length });
  }
}

console.log(`NAS literal lint — ${issues.length} file(s) with violations\n`);
for (const i of issues) {
  console.log(`  ${i.count} hit(s): ${i.file}`);
}
process.exitCode = issues.length > 0 ? 1 : 0;
