#!/usr/bin/env node
/**
 * Staging/prod droplet: wipe hotel+clinic guest/patient ops + MDM persons
 * that are not workforce / HR / satellite staff / finance employees.
 *
 * Does NOT drop databases, catalogs, rooms, packages, legal entities, or staff.
 *
 *   node scripts/wipe-droplet-guest-ops.mjs --dry-run
 *   node scripts/wipe-droplet-guest-ops.mjs --execute --i-know-this-wipes-droplet
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

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run") || !args.includes("--execute");
const executeOk = args.includes("--i-know-this-wipes-droplet");

function die(msg) {
  console.error(`[wipe-guest] ${msg}`);
  process.exit(1);
}

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  if (p === "~") return os.homedir();
  return p;
}

function sshTarget() {
  const combined = process.env.ERA_DROPLET_SSH?.trim();
  if (combined) return combined;
  const host = process.env.ERA_DROPLET_HOST?.trim();
  const user = process.env.ERA_DROPLET_USER?.trim() || "root";
  if (!host) die("Set ERA_DROPLET_SSH=user@host in .env.droplet-pull");
  return `${user}@${host}`;
}

function sshBaseArgs() {
  const port = process.env.ERA_DROPLET_SSH_PORT?.trim() || "22";
  const key = expandHome(process.env.ERA_DROPLET_SSH_KEY?.trim());
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

function ssh(label, remoteCmd, { stdin, capture } = {}) {
  const target = sshTarget();
  const cmdArgs = [...sshBaseArgs(), target, remoteCmd];
  console.log(`[wipe-guest] ${label}`);
  const r = spawnSync("ssh", cmdArgs, {
    encoding: "utf8",
    input: stdin,
    stdio: capture ? ["pipe", "pipe", "pipe"] : stdin ? ["pipe", "inherit", "inherit"] : "inherit",
  });
  if (r.error) die(`${label}: ${r.error.message}`);
  if (r.status !== 0) {
    if (capture && r.stderr) process.stderr.write(r.stderr);
    die(`${label} failed (exit ${r.status ?? "?"})`);
  }
  return (r.stdout ?? "").trim();
}

const pgUser = process.env.POSTGRES_USER?.trim() || "era";
const remotePg = process.env.ERA_DROPLET_PG_CONTAINER?.trim() || "era-postgres";
const remoteRedis = process.env.ERA_DROPLET_REDIS_CONTAINER?.trim() || "era-redis";

function psql(db, sql, { capture = true } = {}) {
  const remote = `docker exec -i ${remotePg} psql -U ${pgUser} -d ${db} -v ON_ERROR_STOP=1 -A -t`;
  return ssh(`psql ${db}`, remote, { stdin: sql, capture });
}

function listTables(db) {
  const raw = psql(
    db,
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;`,
  );
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveTable(tables, ...candidates) {
  const lower = new Map(tables.map((t) => [t.toLowerCase(), t]));
  for (const c of candidates) {
    if (tables.includes(c)) return c;
    const hit = lower.get(c.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

const CLINIC_COUNT_CANDIDATES = [
  "PatientRef",
  "ClinicalEpisode",
  "ProgramInstance",
  "ProgramProcedureBalance",
  "ProcedureOrder",
  "Visit",
  "LabOrder",
  "Appointment",
  "ProcessedEvent",
  "cutover_import_key",
];

const HOTEL_COUNT_CANDIDATES = [
  "Guest",
  "Reservation",
  "Folio",
  "FolioCharge",
  "Stay",
  "ReservationGuest",
  "ElektrawebFolioOutbox",
];

function countSqlResolved(tables, candidates) {
  return candidates
    .map((c) => {
      const t = resolveTable(tables, c);
      if (!t) return `SELECT '${c}' AS tbl, 'MISSING' AS n;`;
      return `SELECT '${t}' AS tbl, (SELECT count(*)::text FROM ${quoteIdent(t)}) AS n;`;
    })
    .join("\n");
}

function mustTable(tables, label, ...candidates) {
  const t = resolveTable(tables, ...candidates);
  if (!t) die(`Required table not found in ${label}: ${candidates.join("/")}`);
  return t;
}

function clinicWipeSql(tables) {
  const names = [
    mustTable(tables, "clinic", "PatientRef"),
    mustTable(tables, "clinic", "ClinicalEpisode"),
    resolveTable(tables, "ProcessedEvent"),
    resolveTable(tables, "cutover_import_key"),
    resolveTable(tables, "physio_nahiye_queue"),
  ].filter(Boolean);
  return `
BEGIN;
TRUNCATE TABLE ${names.map(quoteIdent).join(", ")}
RESTART IDENTITY CASCADE;
COMMIT;
`;
}

function hotelWipeSql(tables) {
  const reservation = mustTable(tables, "hotel", "Reservation");
  const guest = mustTable(tables, "hotel", "Guest");
  const extras = [
    "HkNsrDay",
    "ElektrawebFolioOutbox",
    "OutboundEventLog",
    "SettlementPendingCharge",
    "ChannelSyncError",
    "MedicalAlert",
    "MedicalOrder",
    "LabResult",
    "MedicalProcedure",
  ]
    .map((c) => resolveTable(tables, c))
    .filter(Boolean);
  const extraDeletes = extras.map((t) => `DELETE FROM ${quoteIdent(t)};`).join("\n");
  const sales = resolveTable(tables, "SalesContract");
  const banquet = resolveTable(tables, "BanquetEvent");
  const protectSales = sales
    ? `AND NOT EXISTS (SELECT 1 FROM ${quoteIdent(sales)} sc WHERE sc."companyGuestId" = g.id)`
    : "";
  const protectBanquet = banquet
    ? `AND NOT EXISTS (SELECT 1 FROM ${quoteIdent(banquet)} be WHERE be."companyGuestId" = g.id)`
    : "";
  return `
BEGIN;
TRUNCATE TABLE ${quoteIdent(reservation)} RESTART IDENTITY CASCADE;
${extraDeletes}
DELETE FROM ${quoteIdent(guest)} g
WHERE TRUE
${protectSales}
${protectBanquet};
COMMIT;
`;
}

function mdmWipeSql(protectedIds) {
  const values =
    protectedIds.length > 0
      ? protectedIds.map((id) => `('${id}'::uuid)`).join(",\n")
      : `('00000000-0000-0000-0000-000000000000'::uuid)`;
  return `
BEGIN;
CREATE TEMP TABLE protected_persons (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO protected_persons (id) VALUES ${values}
ON CONFLICT DO NOTHING;

INSERT INTO protected_persons (id)
SELECT person_id FROM person_hr_profiles
ON CONFLICT DO NOTHING;

DELETE FROM person_access_logs
 WHERE person_id NOT IN (SELECT id FROM protected_persons);
DELETE FROM person_access_grants
 WHERE person_id NOT IN (SELECT id FROM protected_persons);
DELETE FROM person_access_requests
 WHERE person_id NOT IN (SELECT id FROM protected_persons);
DELETE FROM person_identifiers
 WHERE person_id NOT IN (SELECT id FROM protected_persons);
DELETE FROM person_addresses
 WHERE person_id NOT IN (SELECT id FROM protected_persons);
DELETE FROM global_natural_persons
 WHERE id NOT IN (SELECT id FROM protected_persons);

COMMIT;
`;
}

function collectUuids(raw) {
  const set = new Set();
  for (const line of String(raw).split(/\r?\n/)) {
    const t = line.trim();
    if (/^[0-9a-f-]{36}$/i.test(t)) set.add(t.toLowerCase());
  }
  return [...set];
}

function printCounts(label, raw) {
  console.log(`\n--- ${label} ---`);
  console.log(raw || "(empty)");
}

if (args.includes("--execute") && !executeOk) {
  die("Refusing. Re-run with --execute --i-know-this-wipes-droplet");
}

console.log(`[wipe-guest] SSH ${sshTarget()}`);
console.log(`[wipe-guest] mode ${dryRun ? "DRY-RUN" : "EXECUTE"}`);

const clinicTables = listTables("era_clinic");
const hotelTables = listTables("era_hotel_pms");
console.log(`[wipe-guest] clinic tables: ${clinicTables.length}, hotel tables: ${hotelTables.length}`);

printCounts(
  "clinic counts",
  psql("era_clinic", countSqlResolved(clinicTables, CLINIC_COUNT_CANDIDATES)),
);
printCounts(
  "hotel counts",
  psql("era_hotel_pms", countSqlResolved(hotelTables, HOTEL_COUNT_CANDIDATES)),
);
printCounts(
  "mdm person count",
  psql(
    "era_mdm",
    `SELECT count(*) FROM global_natural_persons;
     SELECT count(*) FROM person_hr_profiles;`,
  ),
);

const orchIds = collectUuids(
  psql(
    "era_orchestrator",
    `SELECT global_person_id::text FROM workforce_employments WHERE global_person_id IS NOT NULL;`,
  ),
);
const clinicPract = quoteIdent(mustTable(clinicTables, "clinic", "Practitioner"));
const clinicUser = quoteIdent(mustTable(clinicTables, "clinic", "User"));
const hotelUser = quoteIdent(mustTable(hotelTables, "hotel", "User"));
const clinicStaff = collectUuids(
  psql(
    "era_clinic",
    `SELECT global_person_id::text FROM ${clinicPract} WHERE global_person_id IS NOT NULL
     UNION
     SELECT global_person_id::text FROM ${clinicUser} WHERE global_person_id IS NOT NULL;`,
  ),
);
const hotelStaff = collectUuids(
  psql(
    "era_hotel_pms",
    `SELECT global_person_id::text FROM ${hotelUser} WHERE global_person_id IS NOT NULL;`,
  ),
);
const financeStaff = collectUuids(
  psql(
    "era_finance",
    `SELECT global_person_id::text FROM employees WHERE global_person_id IS NOT NULL;`,
  ),
);

const protectedIds = [
  ...new Set([...orchIds, ...clinicStaff, ...hotelStaff, ...financeStaff]),
];
console.log(
  `\n[wipe-guest] protected MDM persons: ${protectedIds.length} (orch ${orchIds.length}, clinic ${clinicStaff.length}, hotel ${hotelStaff.length}, finance ${financeStaff.length})`,
);

if (protectedIds.length < 3) {
  die(
    `Abort: only ${protectedIds.length} staff person ids — refusing MDM wipe so doctors are not deleted.`,
  );
}

const mdmWouldDelete = psql(
  "era_mdm",
  `
CREATE TEMP TABLE protected_persons (id uuid PRIMARY KEY);
INSERT INTO protected_persons (id) VALUES ${protectedIds.map((id) => `('${id}'::uuid)`).join(",")}
ON CONFLICT DO NOTHING;
INSERT INTO protected_persons (id)
SELECT person_id FROM person_hr_profiles
ON CONFLICT DO NOTHING;
SELECT count(*) FROM global_natural_persons
 WHERE id NOT IN (SELECT id FROM protected_persons);
`,
);
printCounts("mdm persons that would be deleted", mdmWouldDelete);

if (dryRun) {
  console.log("\n[wipe-guest] dry-run only. No rows deleted. Pass --execute --i-know-this-wipes-droplet to apply.");
  process.exit(0);
}

console.log("\n[wipe-guest] stopping clinic + hotel + orchestrator during wipe");
ssh(
  "stop apps",
  "docker stop era-clinic era-hotel-pms era-orchestrator || true",
);

printCounts("clinic wipe", psql("era_clinic", clinicWipeSql(clinicTables), { capture: true }));
printCounts("hotel wipe", psql("era_hotel_pms", hotelWipeSql(hotelTables), { capture: true }));
printCounts("mdm wipe", psql("era_mdm", mdmWipeSql(protectedIds), { capture: true }));

ssh(
  "redis satellite queues",
  `docker exec ${remoteRedis} sh -lc 'redis-cli KEYS "bull:era-satellite*" | xargs -r redis-cli DEL; redis-cli KEYS "bull:era-satellite-events*" | xargs -r redis-cli DEL; redis-cli KEYS "bull:era-satellite-fanout*" | xargs -r redis-cli DEL; echo redis-ok'`,
);

ssh(
  "start apps",
  "docker start era-orchestrator era-hotel-pms era-clinic",
);

printCounts(
  "clinic after",
  psql("era_clinic", countSqlResolved(clinicTables, CLINIC_COUNT_CANDIDATES)),
);
printCounts(
  "hotel after",
  psql("era_hotel_pms", countSqlResolved(hotelTables, HOTEL_COUNT_CANDIDATES)),
);
printCounts(
  "mdm after",
  psql("era_mdm", `SELECT count(*) FROM global_natural_persons;`),
);

console.log("\n[wipe-guest] done. Re-run Elektraweb bridge for in-house stays.");

