#!/usr/bin/env node
/**
 * Pull PostgreSQL databases from the staging/prod droplet onto the local
 * `era-postgres` container (destructive replace of local DBs).
 *
 * Prerequisites:
 *   - ssh / scp available (Windows OpenSSH is fine)
 *   - local Docker with container era-postgres running
 *   - SSH access to the droplet (ERA_DROPLET_SSH or host/user/key env)
 *
 * Usage (repo root):
 *   node scripts/pull-dbs-from-droplet.mjs --i-know-this-wipes-local
 *   node scripts/pull-dbs-from-droplet.mjs --i-know-this-wipes-local --preset nafta
 *   node scripts/pull-dbs-from-droplet.mjs --i-know-this-wipes-local --only hotel,clinic,mdm
 *   node scripts/pull-dbs-from-droplet.mjs --list
 *
 * Env (optional):
 *   ERA_DROPLET_SSH=deploy@1.2.3.4          # preferred (user@host)
 *   ERA_DROPLET_HOST / ERA_DROPLET_USER     # alternative to ERA_DROPLET_SSH
 *   ERA_DROPLET_SSH_KEY=~/.ssh/id_ed25519
 *   ERA_DROPLET_SSH_PORT=22
 *   ERA_DROPLET_PG_CONTAINER=era-postgres
 *   ERA_LOCAL_PG_CONTAINER=era-postgres
 *   POSTGRES_USER=era
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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

for (const f of [".env", ".env.local", ".env.droplet-pull"]) {
  loadEnvFile(path.join(root, f));
}

/** @type {Record<string, { db: string, label: string }>} */
const CATALOG = {
  orch: { db: "era_orchestrator", label: "Orchestrator" },
  mdm: { db: "era_mdm", label: "MDM (person SoR)" },
  finance: { db: "era_finance", label: "Finance" },
  hotel: { db: "era_hotel_pms", label: "Hotel PMS" },
  clinic: { db: "era_clinic", label: "Clinic" },
  fnb: { db: "era_fnb_pos", label: "F&B POS" },
  retail: { db: "era_retail_pos", label: "Retail" },
  logistics: { db: "era_logistics", label: "Logistics" },
  construction: { db: "era_construction", label: "Construction" },
  crm: { db: "era_crm", label: "CRM" },
  auto: { db: "era_auto_service", label: "Auto service" },
  wholesale: { db: "era_wholesale", label: "Wholesale" },
  "data-hub": { db: "era_data_hub", label: "Data Hub" },
  "bank-core": { db: "era_bank_core", label: "Bank core" },
  bank: { db: "era_bank", label: "Bank satellite" },
  "bank-dbo": { db: "era_bank_dbo", label: "Bank DBO" },
};

const PRESETS = {
  /** Nafta day-to-day: ops satellites + MDM for guest/patient names */
  nafta: ["hotel", "clinic", "fnb", "mdm"],
  satellites: [
    "hotel",
    "clinic",
    "fnb",
    "retail",
    "logistics",
    "construction",
    "crm",
    "auto",
    "wholesale",
  ],
  core: ["orch", "mdm", "finance"],
  platform: ["orch", "mdm", "finance", "data-hub"],
  all: Object.keys(CATALOG),
};

const args = process.argv.slice(2);
const wipeOk = args.includes("--i-know-this-wipes-local");
const listOnly = args.includes("--list");
const keepDumps = args.includes("--keep-dumps");
const dryRun = args.includes("--dry-run");

function flagValue(name) {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return null;
  return args[i + 1];
}

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  if (p === "~") return os.homedir();
  return p;
}

function die(msg) {
  console.error(`[pull-dbs] ${msg}`);
  process.exit(1);
}

function run(label, cmd, cmdArgs, opts = {}) {
  process.stdout.write(`\n[pull-dbs] ${label}\n`);
  if (dryRun) {
    console.log(`  (dry-run) ${cmd} ${cmdArgs.join(" ")}`);
    return { status: 0, stdout: "", stderr: "" };
  }
  const r = spawnSync(cmd, cmdArgs, {
    encoding: "buffer",
    stdio: opts.stdio ?? "inherit",
    shell: false,
    env: process.env,
  });
  if (r.error) die(`${label}: ${r.error.message}`);
  if (r.status !== 0) {
    die(`${label} failed (exit ${r.status ?? "?"})`);
  }
  return r;
}

function runCapture(label, cmd, cmdArgs) {
  process.stdout.write(`\n[pull-dbs] ${label}\n`);
  if (dryRun) {
    console.log(`  (dry-run) ${cmd} ${cmdArgs.join(" ")}`);
    return "";
  }
  const r = spawnSync(cmd, cmdArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    env: process.env,
  });
  if (r.error) die(`${label}: ${r.error.message}`);
  if (r.status !== 0) {
    if (r.stderr) process.stderr.write(r.stderr);
    die(`${label} failed (exit ${r.status ?? "?"})`);
  }
  return (r.stdout ?? "").trim();
}

function resolveTargets() {
  const only = flagValue("--only");
  const presetName = flagValue("--preset") ?? (only ? null : "nafta");
  /** @type {string[]} */
  let keys = [];
  if (only) {
    keys = only.split(/[,+\s]+/).filter(Boolean);
  } else if (presetName) {
    if (!PRESETS[presetName]) {
      die(`Unknown preset "${presetName}". Use --list.`);
    }
    keys = [...PRESETS[presetName]];
  }
  const unknown = keys.filter((k) => !CATALOG[k]);
  if (unknown.length) die(`Unknown DB key(s): ${unknown.join(", ")}. Use --list.`);
  if (!keys.length) die("No databases selected.");
  return keys;
}

function sshTarget() {
  const combined = process.env.ERA_DROPLET_SSH?.trim();
  if (combined) return combined;
  const host = process.env.ERA_DROPLET_HOST?.trim();
  const user = process.env.ERA_DROPLET_USER?.trim() || "deploy";
  if (!host) {
    die(
      "Set ERA_DROPLET_SSH=user@host (or ERA_DROPLET_HOST) in .env / .env.droplet-pull",
    );
  }
  return `${user}@${host}`;
}

function sshBaseArgs() {
  const port = process.env.ERA_DROPLET_SSH_PORT?.trim() || "22";
  const key = expandHome(process.env.ERA_DROPLET_SSH_KEY?.trim());
  /** @type {string[]} */
  const a = [
    "-p",
    port,
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "BatchMode=yes",
  ];
  if (key) a.push("-i", key);
  return a;
}

function scpBaseArgs() {
  const port = process.env.ERA_DROPLET_SSH_PORT?.trim() || "22";
  const key = expandHome(process.env.ERA_DROPLET_SSH_KEY?.trim());
  /** @type {string[]} */
  const a = ["-P", port, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes"];
  if (key) a.push("-i", key);
  return a;
}

function dockerRunning(name) {
  const r = spawnSync(
    "docker",
    ["ps", "--format", "{{.Names}}"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (r.status !== 0) return false;
  return (r.stdout ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .includes(name);
}

function printList() {
  console.log("Presets:");
  for (const [name, keys] of Object.entries(PRESETS)) {
    console.log(`  ${name.padEnd(12)} ${keys.join(", ")}`);
  }
  console.log("\nDatabases:");
  for (const [key, meta] of Object.entries(CATALOG)) {
    console.log(`  ${key.padEnd(14)} ${meta.db.padEnd(22)} ${meta.label}`);
  }
}

if (listOnly) {
  printList();
  process.exit(0);
}

if (!wipeOk && !dryRun) {
  die(
    "Refusing to overwrite local DBs. Re-run with --i-know-this-wipes-local (or --dry-run).",
  );
}

const keys = resolveTargets();
const remote = sshTarget();
const pgUser = process.env.POSTGRES_USER?.trim() || "era";
const remotePg = process.env.ERA_DROPLET_PG_CONTAINER?.trim() || "era-postgres";
const localPg = process.env.ERA_LOCAL_PG_CONTAINER?.trim() || "era-postgres";
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const dumpDir = path.join(root, "tmp", "db-pull", stamp);

console.log(`[pull-dbs] target SSH: ${remote}`);
console.log(`[pull-dbs] remote PG:  ${remotePg}`);
console.log(`[pull-dbs] local PG:   ${localPg}`);
console.log(`[pull-dbs] databases:  ${keys.map((k) => CATALOG[k].db).join(", ")}`);
console.log(`[pull-dbs] dumps dir:  ${dumpDir}`);

if (!dryRun) {
  if (!dockerRunning(localPg)) {
    die(
      `Local container "${localPg}" is not running. Start with: docker compose up -d postgres`,
    );
  }
  fs.mkdirSync(dumpDir, { recursive: true });
}

// Probe remote docker + postgres
runCapture(
  "probe remote postgres",
  "ssh",
  [
    ...sshBaseArgs(),
    remote,
    `docker exec ${remotePg} pg_isready -U ${pgUser}`,
  ],
);

for (const key of keys) {
  const { db, label } = CATALOG[key];
  const remoteTmp = `/tmp/era-pull-${db}-${stamp}.dump`;
  const localDump = path.join(dumpDir, `${db}.dump`);

  run(
    `dump remote ${label} (${db})`,
    "ssh",
    [
      ...sshBaseArgs(),
      remote,
      [
        `docker exec ${remotePg} pg_dump -U ${pgUser} -Fc --no-owner --no-acl ${db} > ${remoteTmp}`,
        `ls -lh ${remoteTmp}`,
      ].join(" && "),
    ],
  );

  run(
    `scp ${db}.dump`,
    "scp",
    [...scpBaseArgs(), `${remote}:${remoteTmp}`, localDump],
  );

  run(
    `cleanup remote dump ${db}`,
    "ssh",
    [...sshBaseArgs(), remote, `rm -f ${remoteTmp}`],
  );

  // Terminate local sessions, recreate empty DB, restore.
  // DROP/CREATE must be separate -c calls — Postgres rejects them inside a txn block.
  run(
    `terminate local sessions ${db}`,
    "docker",
    [
      "exec",
      localPg,
      "psql",
      "-U",
      pgUser,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();`,
    ],
  );
  run(
    `drop local ${db}`,
    "docker",
    [
      "exec",
      localPg,
      "psql",
      "-U",
      pgUser,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `DROP DATABASE IF EXISTS ${db};`,
    ],
  );
  run(
    `create local ${db}`,
    "docker",
    [
      "exec",
      localPg,
      "psql",
      "-U",
      pgUser,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `CREATE DATABASE ${db} OWNER ${pgUser};`,
    ],
  );

  // Copy dump into the container, then pg_restore from a path (Windows-safe).
  const containerDump = `/tmp/era-restore-${db}.dump`;
  if (dryRun) {
    console.log(`  (dry-run) docker cp ${localDump} ${localPg}:${containerDump}`);
    console.log(`  (dry-run) docker exec ${localPg} pg_restore … ${containerDump}`);
  } else {
    process.stdout.write(`\n[pull-dbs] restore local ${label} (${db})\n`);
    run(`docker cp ${db}.dump`, "docker", ["cp", localDump, `${localPg}:${containerDump}`]);
    const r = spawnSync(
      "docker",
      [
        "exec",
        localPg,
        "pg_restore",
        "-U",
        pgUser,
        "-d",
        db,
        "--no-owner",
        "--no-acl",
        "--verbose",
        containerDump,
      ],
      {
        stdio: "inherit",
        shell: false,
        env: process.env,
      },
    );
    spawnSync("docker", ["exec", localPg, "rm", "-f", containerDump], {
      stdio: "ignore",
      shell: false,
    });
    // pg_restore returns 1 when some objects warn; treat only >=2 / null as hard fail
    // after a full recreate the DB is empty, so non-zero usually means real errors.
    if (r.error) die(`restore ${db}: ${r.error.message}`);
    if (r.status !== 0 && r.status !== 1) {
      die(`restore ${db} failed (exit ${r.status ?? "?"})`);
    }
    if (r.status === 1) {
      console.warn(
        `[pull-dbs] pg_restore exited 1 for ${db} (warnings). Verify with a quick SELECT.`,
      );
    }
  }
}

if (!keepDumps && !dryRun) {
  fs.rmSync(dumpDir, { recursive: true, force: true });
  console.log(`\n[pull-dbs] removed dumps under ${dumpDir}`);
} else if (!dryRun) {
  console.log(`\n[pull-dbs] dumps kept under ${dumpDir}`);
}

console.log("\n[pull-dbs] done.");
console.log(
  "Tip: local apps may need a restart. MDM names resolve from era_mdm — include --preset nafta when working hotel/clinic.",
);
