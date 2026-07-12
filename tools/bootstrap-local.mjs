#!/usr/bin/env node
/**
 * Local dev bootstrap — Orchestrator-first super-admin + Finance seed + satellite migrations.
 * Does NOT rebuild Docker images.
 *
 * Usage:
 *   node tools/bootstrap-local.mjs [--reset-password] [--skip-finance] [--skip-orch]
 *                                  [--demo] [--migrate-satellites] [--skip-satellites]
 *                                  [--workforce-seed] [--skip-workforce]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadRootEnv() {
  for (const envPath of [path.join(root, ".env"), path.join(root, ".env.local")]) {
    if (!fs.existsSync(envPath)) continue;
    loadEnvFile(envPath);
  }
}

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

loadRootEnv();

const args = new Set(process.argv.slice(2));
const resetPassword = args.has("--reset-password");
const skipFinance = args.has("--skip-finance");
const skipOrch = args.has("--skip-orch");
const withDemo = args.has("--demo");
const migrateSatellites =
  args.has("--migrate-satellites") || !args.has("--skip-satellites");
const workforceSeed = args.has("--workforce-seed");
const skipWorkforce = args.has("--skip-workforce");

const pgUser = process.env.POSTGRES_USER ?? "era";
const pgPass = process.env.POSTGRES_PASSWORD ?? "era_dev_password";
const pgHost = process.env.POSTGRES_HOST ?? "localhost";
const pgPort = process.env.POSTGRES_PUBLISH_PORT ?? "5432";

function encodePgPassword(pass) {
  return encodeURIComponent(pass);
}

function dbUrl(dbName) {
  return `postgresql://${pgUser}:${encodePgPassword(pgPass)}@${pgHost}:${pgPort}/${dbName}?schema=public`;
}

function dockerContainerRunning(name) {
  const r = spawnSync(
    `docker ps --format "{{.Names}}" | findstr /x "${name}"`,
    { shell: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return (r.stdout ?? "").includes(name);
}

function runDockerExec(label, container, shCmd) {
  process.stdout.write(`\n[bootstrap] ${label} (docker:${container})\n`);
  const r = spawnSync(`docker exec ${container} sh -lc ${JSON.stringify(shCmd)}`, {
    shell: true,
    stdio: "inherit",
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`${label} failed (exit ${r.status ?? "unknown"})`);
  }
}

function run(label, cmd, cwd, extraEnv = {}) {
  process.stdout.write(`\n[bootstrap] ${label}\n`);
  const r = spawnSync(cmd, {
    cwd,
    env: { ...process.env, ...extraEnv },
    shell: true,
    stdio: "inherit",
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`${label} failed (exit ${r.status ?? "unknown"})`);
  }
}

function runOptional(label, cmd, cwd, extraEnv = {}) {
  try {
    run(label, cmd, cwd, extraEnv);
  } catch (e) {
    process.stderr.write(`[bootstrap] WARN: ${e.message}\n`);
  }
}

/** Prefer local prisma bin; otherwise pin Prisma 6 (npx latest is Prisma 7 and rejects schema `url`). */
const PRISMA_CLI_PIN = "prisma@6.9.0";
function prismaCli(satRoot, prismaArgs) {
  const localBin = path.join(
    satRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.cmd" : "prisma",
  );
  if (fs.existsSync(localBin)) {
    return `"${localBin}" ${prismaArgs}`;
  }
  return `npx --yes ${PRISMA_CLI_PIN} ${prismaArgs}`;
}

const allSatelliteDirs = [
  { dir: "era-hotel-pms", db: "era_hotel_pms", mode: "migrate", adminRole: "Hotel_Admin" },
  { dir: "era-fnb-pos", db: "era_fnb_pos", mode: "push", adminRole: "FB_MANAGER" },
  { dir: "era-retail-pos", db: "era_retail_pos", mode: "push", adminRole: "OUTLET_ADMIN" },
  { dir: "era-logistics", db: "era_logistics", mode: "push", adminRole: "LOGISTICS_ADMIN" },
  { dir: "era-construction", db: "era_construction", mode: "push", adminRole: "CONSTRUCTION_ADMIN" },
  { dir: "era-crm", db: "era_crm", mode: "push", adminRole: "CRM_ADMIN" },
  { dir: "era-auto-service", db: "era_auto_service", mode: "push", adminRole: "AUTO_ADMIN" },
  { dir: "era-wholesale", db: "era_wholesale", mode: "push", adminRole: "WHOLESALE_ADMIN" },
  { dir: "era-clinic", db: "era_clinic", mode: "push", adminRole: "CLINIC_ADMIN" },
  { dir: "era-bank-core", db: "era_bank_core", mode: "migrate-core", adminRole: null },
  { dir: "era-bank", db: "era_bank", mode: "push", adminRole: "TELLER" },
  { dir: "era-bank-dbo", db: "era_bank_dbo", mode: "push", adminRole: null },
];

/** Design / smoke: only hotel + clinic (see SKIP_HEAVY in design-regression.yml). */
const skipHeavy = process.env.SKIP_HEAVY === "1" || process.env.SKIP_HEAVY === "true";
const satelliteDirs = skipHeavy
  ? allSatelliteDirs.filter((s) => s.dir === "era-hotel-pms" || s.dir === "era-clinic")
  : allSatelliteDirs;

async function main() {
  if (!skipOrch) {
    if (dockerContainerRunning("era-orchestrator")) {
      runDockerExec(
        "orchestrator migrate deploy",
        "era-orchestrator",
        "cd /app/packages/database && npx prisma migrate deploy",
      );
    } else {
      run(
        "orchestrator migrate deploy",
        "npm run db:migrate:deploy -w @era365/database",
        path.join(root, "era-orchestrator"),
        { DATABASE_URL: dbUrl("era_orchestrator") },
      );
    }
    runOptional(
      "ensure era_mdm database",
      `docker exec era-postgres psql -U ${pgUser} -d postgres -c "CREATE DATABASE era_mdm"`,
      root,
    );
    runOptional(
      "orchestrator mdm migrate deploy",
      "npm run db:migrate:deploy -w @era365/mdm-database",
      path.join(root, "era-orchestrator"),
      { MDM_DATABASE_URL: dbUrl("era_mdm") },
    );
    const resetFlag = resetPassword ? " --reset-password" : "";
    run(
      "orchestrator platform super-admins",
      `npx tsx packages/database/prisma/scripts/bootstrap-platform-admins.ts${resetFlag}`,
      path.join(root, "era-orchestrator"),
      { DATABASE_URL: dbUrl("era_orchestrator") },
    );
  }

  if (!skipFinance) {
    run(
      "finance migrate",
      "npm run db:migrate -w @erafinance/database",
      path.join(root, "era-finance-core"),
      { DATABASE_URL: dbUrl("era_finance") },
    );
    if (withDemo) {
      run(
        "finance demo seed",
        "npm run db:seed:demo",
        path.join(root, "era-finance-core"),
        { DATABASE_URL: dbUrl("era_finance"), SEED_DEMO_ORG: "1" },
      );
    } else {
      run(
        "finance core seed",
        "npm run db:seed:core -w @erafinance/database",
        path.join(root, "era-finance-core"),
        { DATABASE_URL: dbUrl("era_finance") },
      );
    }
    if (resetPassword) {
      run(
        "finance platform super-admins reset",
        "npx tsx packages/database/prisma/scripts/bootstrap-platform-admins.ts --reset-password",
        path.join(root, "era-finance-core"),
        { DATABASE_URL: dbUrl("era_finance") },
      );
    }
  }

  if (migrateSatellites) {
    if (skipHeavy) {
      process.stdout.write(
        "\n[bootstrap] SKIP_HEAVY=1 — migrating only era-hotel-pms + era-clinic\n",
      );
    }
    const demoPassword =
      process.env.PLATFORM_SUPER_ADMIN_BOOTSTRAP_PASSWORD ?? "12345678";
    const demoUserScript = "prisma/scripts/upsert-ecosystem-demo-user.ts";
    for (const { dir, db, mode, adminRole } of satelliteDirs) {
      const satRoot = path.join(root, dir);
      if (!fs.existsSync(path.join(satRoot, "prisma/schema.prisma"))) continue;
      const env = { DATABASE_URL: dbUrl(db) };
      if (mode === "migrate") {
        run(
          `${dir} migrate deploy`,
          prismaCli(satRoot, "migrate deploy"),
          satRoot,
          env,
        );
      } else if (mode === "migrate-core") {
        run(
          `${dir} migrate deploy`,
          "npm run db:migrate:deploy",
          satRoot,
          env,
        );
        runOptional(`${dir} seed`, "npm run db:seed", satRoot, {
          ...env,
          ERA_BANK_ORGANIZATION_ID: process.env.ERA_BANK_ORGANIZATION_ID ?? "demo-bank-org-001",
        });
      } else {
        runOptional(`${dir} db push`, prismaCli(satRoot, "db push"), satRoot, env);
      }
      if (adminRole) {
        runOptional(
          `${dir} ecosystem demo user`,
          `npx tsx ${demoUserScript}`,
          satRoot,
          {
            ...env,
            ECOSYSTEM_DEMO_LOGIN: "chingiz@era.com",
            ECOSYSTEM_DEMO_PASSWORD: demoPassword,
            ECOSYSTEM_DEMO_ADMIN_ROLE: adminRole,
          },
        );
      }
      if (dir === "era-clinic") {
        runOptional(`${dir} db seed`, "npm run db:seed", satRoot, env);
      }
      if (dir === "era-bank" || dir === "era-bank-dbo") {
        runOptional(`${dir} db seed`, "npm run db:seed", satRoot, env);
      }
    }
    runOptional(
      "era-fnb-pos seed",
      "npm run db:seed",
      path.join(root, "era-fnb-pos"),
      { DATABASE_URL: dbUrl("era_fnb_pos") },
    );
    runOptional(
      "era-fnb-pos chingiz demo user",
      `npx tsx "${demoUserScript}"`,
      path.join(root, "era-fnb-pos"),
      {
        DATABASE_URL: dbUrl("era_fnb_pos"),
        ECOSYSTEM_DEMO_LOGIN: "chingiz@era.com",
        ECOSYSTEM_DEMO_PASSWORD:
          process.env.PLATFORM_SUPER_ADMIN_BOOTSTRAP_PASSWORD ?? "12345678",
        ECOSYSTEM_DEMO_ADMIN_ROLE: "FB_MANAGER",
      },
    );
  }

  run(
    "write credentials file",
    "node tools/write-local-credentials.mjs",
    root,
  );

  if (workforceSeed && !skipWorkforce) {
    runOptional(
      "v3 workforce Nafta seed (org tree + role matrix)",
      "node scripts/nafta-onboard-departments.mjs",
      root,
    );
    runOptional(
      "v3 workforce smoke",
      "node scripts/v3-workforce-smoke.mjs",
      root,
    );
  }

  process.stdout.write("\n[bootstrap] Done.\n");
}

main().catch((e) => {
  process.stderr.write(`[bootstrap] FATAL: ${e.message}\n`);
  process.exit(1);
});
