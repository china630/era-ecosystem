#!/usr/bin/env node
/**
 * Apply prisma migrate deploy for all industry satellites + bank stack.
 * Does not seed. Does not touch orchestrator/finance.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

const root = path.join(__dirname, "..");

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

loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".env.local"));

const pgUser = process.env.POSTGRES_USER ?? "era";
const pgPass = process.env.POSTGRES_PASSWORD ?? "era_dev_password";
const pgHost = process.env.POSTGRES_HOST ?? "localhost";
const pgPort = process.env.POSTGRES_PUBLISH_PORT ?? "5432";

function dbUrl(dbName) {
  return `postgresql://${pgUser}:${encodeURIComponent(pgPass)}@${pgHost}:${pgPort}/${dbName}?schema=public`;
}

const SATELLITES = [
  { dir: "era-hotel-pms", db: "era_hotel_pms", cwd: "era-hotel-pms", cmd: "npx prisma migrate deploy" },
  { dir: "era-fnb-pos", db: "era_fnb_pos", cwd: "era-fnb-pos", cmd: "npx prisma migrate deploy" },
  { dir: "era-clinic", db: "era_clinic", cwd: "era-clinic", cmd: "npx prisma migrate deploy" },
  { dir: "era-retail-pos", db: "era_retail_pos", cwd: "era-retail-pos", cmd: "npx prisma migrate deploy" },
  { dir: "era-crm", db: "era_crm", cwd: "era-crm", cmd: "npx prisma migrate deploy" },
  { dir: "era-auto-service", db: "era_auto_service", cwd: "era-auto-service", cmd: "npx prisma migrate deploy" },
  { dir: "era-construction", db: "era_construction", cwd: "era-construction", cmd: "npx prisma migrate deploy" },
  { dir: "era-wholesale", db: "era_wholesale", cwd: "era-wholesale", cmd: "npx prisma migrate deploy" },
  { dir: "era-logistics", db: "era_logistics", cwd: "era-logistics", cmd: "npx prisma migrate deploy" },
  { dir: "era-bank", db: "era_bank", cwd: "era-bank", cmd: "npx prisma migrate deploy" },
  { dir: "era-bank-dbo", db: "era_bank_dbo", cwd: "era-bank-dbo", cmd: "npx prisma migrate deploy" },
  {
    dir: "era-bank-core",
    db: "era_bank_core",
    cwd: "era-bank-core",
    cmd: "npm run db:migrate:deploy",
  },
];

function probeTcp(host, port) {
  return new Promise((resolve) => {
    const s = net.connect(Number(port), host, () => {
      s.end();
      resolve(true);
    });
    s.on("error", () => resolve(false));
    s.setTimeout(3000, () => {
      s.destroy();
      resolve(false);
    });
  });
}

function run(label, cmd, cwd, extraEnv) {
  process.stdout.write(`\n==> ${label}\n`);
  const r = spawnSync(cmd, {
    cwd,
    env: { ...process.env, ...extraEnv },
    shell: true,
    stdio: "inherit",
    encoding: "utf8",
  });
  return r.status === 0;
}

async function main() {
  const up = await probeTcp(pgHost, pgPort);
  if (!up) {
    console.error(
      `Postgres is not reachable at ${pgHost}:${pgPort}. Start Docker Desktop / era-postgres, then retry.`,
    );
    process.exit(2);
  }

  const results = [];
  for (const sat of SATELLITES) {
    const schema = path.join(root, sat.cwd, "prisma", "schema.prisma");
    const coreSchema = path.join(
      root,
      "era-bank-core",
      "packages",
      "database",
      "prisma",
      "schema.prisma",
    );
    if (sat.dir !== "era-bank-core" && !fs.existsSync(schema)) {
      results.push({ dir: sat.dir, ok: false, reason: "no schema" });
      continue;
    }
    if (sat.dir === "era-bank-core" && !fs.existsSync(coreSchema)) {
      results.push({ dir: sat.dir, ok: false, reason: "no schema" });
      continue;
    }
    const ok = run(
      `${sat.dir} → ${sat.db}`,
      sat.cmd,
      path.join(root, sat.cwd),
      { DATABASE_URL: dbUrl(sat.db) },
    );
    results.push({ dir: sat.dir, ok, reason: ok ? "ok" : "migrate failed" });
  }

  console.log("\n=== migrate-all-satellites ===");
  for (const r of results) {
    console.log(`${r.ok ? "OK" : "FAIL"}  ${r.dir}  ${r.reason}`);
  }
  if (results.some((r) => !r.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
