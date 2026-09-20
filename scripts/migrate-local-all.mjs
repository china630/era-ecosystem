#!/usr/bin/env node
/**
 * Apply Prisma migrate deploy to all local ERA databases (host-side).
 * Usage: node scripts/migrate-local-all.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

for (const f of [".env", ".env.local"]) {
  loadEnvFile(path.join(root, f));
}

const user = process.env.POSTGRES_USER || "era";
const pass = encodeURIComponent(
  process.env.POSTGRES_PASSWORD || "era_dev_password",
);
const host = process.env.POSTGRES_HOST || "127.0.0.1";
const port = process.env.POSTGRES_PUBLISH_PORT || "5432";

function dbUrl(db) {
  return `postgresql://${user}:${pass}@${host}:${port}/${db}?schema=public`;
}

function run(label, cwd, cmd, env) {
  process.stdout.write(`\n==> ${label}\n`);
  const r = spawnSync(cmd, {
    cwd,
    env: { ...process.env, ...env },
    shell: true,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    throw new Error(`${label} failed (exit ${r.status ?? "?"})`);
  }
}

const jobs = [
  {
    label: "orchestrator",
    cwd: "era-orchestrator",
    cmd: "npm run db:migrate:deploy -w @era365/database",
    env: { DATABASE_URL: dbUrl("era_orchestrator") },
  },
  {
    label: "mdm",
    cwd: "era-orchestrator",
    cmd: "npm run db:migrate:deploy -w @era365/mdm-database",
    env: {
      DATABASE_URL: dbUrl("era_mdm"),
      MDM_DATABASE_URL: dbUrl("era_mdm"),
    },
  },
  {
    label: "finance",
    cwd: "era-finance-core",
    cmd: "npm run db:migrate -w @erafinance/database",
    env: { DATABASE_URL: dbUrl("era_finance") },
  },
  {
    label: "hotel-pms",
    cwd: "era-hotel-pms",
    cmd: "npx prisma migrate deploy",
    env: { DATABASE_URL: dbUrl("era_hotel_pms") },
  },
  {
    label: "clinic",
    cwd: "era-clinic",
    cmd: "npx prisma migrate deploy",
    env: { DATABASE_URL: dbUrl("era_clinic") },
  },
  {
    label: "fnb-pos",
    cwd: "era-fnb-pos",
    cmd: "npx prisma migrate deploy",
    env: { DATABASE_URL: dbUrl("era_fnb_pos") },
  },
  // Peripheral / empty-baseline sats — optional for Nafta local work
  {
    label: "retail-pos",
    cwd: "era-retail-pos",
    cmd: "npx prisma migrate deploy",
    env: { DATABASE_URL: dbUrl("era_retail_pos") },
    optional: true,
  },
  {
    label: "logistics",
    cwd: "era-logistics",
    cmd: "npx prisma migrate deploy",
    env: { DATABASE_URL: dbUrl("era_logistics") },
    optional: true,
  },
  {
    label: "construction",
    cwd: "era-construction",
    cmd: "npx prisma migrate deploy",
    env: { DATABASE_URL: dbUrl("era_construction") },
    optional: true,
  },
  {
    label: "crm",
    cwd: "era-crm",
    cmd: "npx prisma migrate deploy",
    env: { DATABASE_URL: dbUrl("era_crm") },
    optional: true,
  },
  {
    label: "auto-service",
    cwd: "era-auto-service",
    cmd: "npx prisma migrate deploy",
    env: { DATABASE_URL: dbUrl("era_auto_service") },
    optional: true,
  },
  {
    label: "wholesale",
    cwd: "era-wholesale",
    cmd: "npx prisma migrate deploy",
    env: { DATABASE_URL: dbUrl("era_wholesale") },
    optional: true,
  },
];


let failed = 0;
for (const j of jobs) {
  const cwd = path.join(root, j.cwd);
  if (!fs.existsSync(cwd)) {
    console.log(`skip missing ${j.cwd}`);
    continue;
  }
  try {
    run(j.label, cwd, j.cmd, j.env);
  } catch (e) {
    console.error(String(e));
    if (!j.optional) failed += 1;
    else console.warn(`WARN optional ${j.label} skipped`);
  }
}

if (failed) {
  console.error(`\nFAILED count=${failed}`);
  process.exit(1);
}
console.log("\nALL MIGRATIONS OK");
