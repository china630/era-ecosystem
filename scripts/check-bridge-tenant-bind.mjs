#!/usr/bin/env node
/**
 * Bridge and internal routes have no staff session. Prisma inside a request
 * throws unless enterRequestTenant (or a session read) runs first.
 * The process organization is not a fallback.
 *
 * Known leftovers live in scripts/bridge-tenant-bind-baseline.txt.
 * A new offender fails. A baseline path that is now clean fails too.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "scripts", "bridge-tenant-bind-baseline.txt");

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
];

const BIND_RE =
  /enterRequestTenant\s*\(|enterSatelliteTenant\s*\(|runWithSatelliteTenant\s*\(|runCronForEachTenant\s*\(|getSatelliteSession\s*\(|readSatelliteStaffSession\s*\(/;
const PRISMA_RE = /\bprisma\s*\./;

function walkRoutes(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".") || ent.name === "node_modules" || ent.name === ".next") continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkRoutes(abs, out);
      continue;
    }
    if (ent.name === "route.ts" || ent.name === "route.tsx") out.push(abs);
  }
}

function unbound(text) {
  const prismaAt = text.search(PRISMA_RE);
  if (prismaAt < 0) return false;
  const bindAt = text.search(BIND_RE);
  return bindAt < 0 || bindAt > prismaAt;
}

const files = [];
for (const rel of SATELLITE_ROOTS) {
  const app = path.join(root, rel, "app", "api");
  walkRoutes(path.join(app, "integration"), files);
  walkRoutes(path.join(app, "internal"), files);
}
walkRoutes(
  path.join(root, "era-clinic", "app", "api", "sanatorium", "episodes", "from-stay"),
  files,
);

const hits = files
  .filter((abs) => unbound(fs.readFileSync(abs, "utf8")))
  .map((abs) => path.relative(root, abs).replace(/\\/g, "/"))
  .sort();

const baseline = fs
  .readFileSync(baselinePath, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

const hitSet = new Set(hits);
const baseSet = new Set(baseline);
const fresh = hits.filter((h) => !baseSet.has(h));
const stale = baseline.filter((h) => !hitSet.has(h));

if (hits.length) {
  console.log("Bridge routes that touch Prisma before a tenant bind:");
  for (const h of hits) {
    console.log(`  ${baseSet.has(h) ? "known" : "NEW"}  ${h}`);
  }
}

if (fresh.length || stale.length) {
  if (fresh.length) {
    console.error("\nFAIL: new bridge route queries Prisma before enterRequestTenant:");
    for (const h of fresh) console.error("  ", h);
  }
  if (stale.length) {
    console.error("\nFAIL: baseline lists a route that is now bound — remove it:");
    for (const h of stale) console.error("  ", h);
  }
  process.exit(1);
}

console.log(
  hits.length
    ? `PASS — no new unbound bridge routes (${hits.length} still in the baseline)`
    : "PASS — bridge routes bind a tenant before Prisma",
);
