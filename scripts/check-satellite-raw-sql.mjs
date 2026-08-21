#!/usr/bin/env node
/**
 * Ban raw Prisma SQL in satellite runtime (app/src/lib) unless the call
 * goes through kit tenant-raw helpers. Prisma tenant extension cannot
 * inject organizationId into $queryRaw / $executeRaw.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SATELLITE_ROOTS = [
  "era-hotel-pms",
  "era-clinic",
  "era-fnb-pos",
  "era-retail-pos",
  "era-crm",
  "era-auto-service",
  "era-construction",
  "era-wholesale",
  "era-logistics",
  "era-bank",
  "era-bank-dbo",
  "era-bank-core/apps",
];

const SKIP_DIR = new Set([
  "node_modules",
  ".next",
  "dist",
  "generated",
  "coverage",
  "prisma",
  "scripts",
]);

const RAW_RE = /\$(?:queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe)\b/;

const hits = [];

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".")) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR.has(ent.name)) continue;
      walk(abs);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|cjs)$/.test(ent.name)) continue;
    if (ent.name.endsWith(".spec.ts") || ent.name.endsWith(".test.ts")) continue;
    const text = fs.readFileSync(abs, "utf8");
    if (!RAW_RE.test(text)) continue;
    const rel = path.relative(root, abs).replace(/\\/g, "/");
    if (rel.includes("/prisma/scripts/")) continue;
    hits.push(rel);
  }
}

for (const rel of SATELLITE_ROOTS) {
  walk(path.join(root, rel));
}

if (hits.length) {
  console.error("FAIL: satellite runtime uses Prisma raw SQL (tenant filter does not apply):");
  for (const h of hits) console.error("  ", h);
  console.error("Use Prisma queries or kit assertTenantRawOrganizationId + SQL that mentions organization_id.");
  process.exit(1);
}

console.log("PASS — no satellite runtime $queryRaw / $executeRaw");
