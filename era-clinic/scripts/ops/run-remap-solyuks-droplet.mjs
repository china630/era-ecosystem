/**
 * Pipe remap-solyuks-to-sollyuks.sql into droplet era_clinic.
 * Remap SQL no-ops rewrite/delete when SVC-SOLLYUKS is missing — use --restore first.
 * Never prints the SSH target. Requires ERA_DROPLET_SSH in repo .env.droplet-pull.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..", "..");
const sqlPath = path.join(here, "remap-solyuks-to-sollyuks.sql");

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

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

const target = process.env.ERA_DROPLET_SSH?.trim();
if (!target) {
  console.error("Set ERA_DROPLET_SSH in .env.droplet-pull");
  process.exit(1);
}
const port = process.env.ERA_DROPLET_SSH_PORT?.trim() || "22";
const key = expandHome(process.env.ERA_DROPLET_SSH_KEY?.trim());
const pg = process.env.ERA_DROPLET_PG_CONTAINER?.trim() || "era-postgres";
const sql = fs.readFileSync(sqlPath);
const sshArgs = ["-p", port, "-o", "StrictHostKeyChecking=accept-new", "-o", "BatchMode=yes"];
if (key) sshArgs.push("-i", key);

const inspect = `
SELECT count(*) AS bal_twin FROM "ProgramProcedureBalance" WHERE "procedureCode" = 'SVC-SOLYUKS';
SELECT count(*) AS tpl_twin FROM "ProgramTemplateProcedure" WHERE "procedureCode" = 'SVC-SOLYUKS';
SELECT count(*) AS member_twin FROM program_template_block_member WHERE procedure_code = 'SVC-SOLYUKS';
SELECT count(*) AS knot_twin FROM "ProgramTemplateQuotaKnot" WHERE "procedureCode" = 'SVC-SOLYUKS';
SELECT count(*) AS snap_twin FROM "ProgramInstance" WHERE entitlement_snapshot::text LIKE '%SVC-SOLYUKS%';
SELECT count(*) AS reqs FROM procedure_type_requirement r JOIN "ProcedureType" t ON t.id = r.procedure_type_id WHERE t.code = 'SVC-SOLLYUKS';
`;

const verify = `
SELECT
  (SELECT count(*) FROM "ProcedureType" WHERE code = 'SVC-SOLYUKS') AS twin_types,
  (SELECT count(*) FROM "ProcedureType" WHERE code = 'SVC-SOLLYUKS') AS keep_types,
  (SELECT count(*) FROM "ProcedureOrder" WHERE "procedureCode" = 'SVC-SOLYUKS') AS twin_orders,
  (SELECT count(*) FROM "ProcedureOrder" WHERE "procedureCode" = 'SVC-SOLLYUKS') AS keep_orders,
  (SELECT count(*) FROM "ServiceCatalogCache" WHERE code = 'SVC-SOLYUKS') AS twin_catalog,
  (SELECT count(*) FROM staff_duty_line l JOIN "ProcedureType" t ON t.id = l.procedure_type_id WHERE t.code = 'SVC-SOLLYUKS') AS duty_lines;
`;

if (process.argv.includes("--restore")) {
  const restorePath = path.join(here, "restore-sollyuks-type.sql");
  console.log("[solyuks] restore SVC-SOLLYUKS type on droplet");
  const apply = spawnSync(
    "ssh",
    [...sshArgs, target, `docker exec -i ${pg} psql -U era -d era_clinic -v ON_ERROR_STOP=1`],
    { input: fs.readFileSync(restorePath), encoding: "utf8" },
  );
  if (apply.status !== 0) {
    console.error(apply.stderr || apply.stdout || "psql restore failed");
    process.exit(apply.status ?? 1);
  }
  console.log(apply.stdout.trim());
  const check = spawnSync(
    "ssh",
    [...sshArgs, target, `docker exec -i ${pg} psql -U era -d era_clinic -v ON_ERROR_STOP=1`],
    { input: verify, encoding: "utf8" },
  );
  if (check.status !== 0) {
    console.error(check.stderr || check.stdout || "psql verify failed");
    process.exit(check.status ?? 1);
  }
  console.log(check.stdout.trim());
  process.exit(0);
}

if (process.argv.includes("--inspect")) {
  const check = spawnSync(
    "ssh",
    [...sshArgs, target, `docker exec -i ${pg} psql -U era -d era_clinic -v ON_ERROR_STOP=1`],
    { input: inspect, encoding: "utf8" },
  );
  if (check.status !== 0) {
    console.error(check.stderr || check.stdout || "psql inspect failed");
    process.exit(check.status ?? 1);
  }
  console.log(check.stdout.trim());
  process.exit(0);
}

console.log("[solyuks] apply remap on droplet clinic db");
const apply = spawnSync(
  "ssh",
  [...sshArgs, target, `docker exec -i ${pg} psql -U era -d era_clinic -v ON_ERROR_STOP=1`],
  { input: sql, encoding: "utf8" },
);
if (apply.status !== 0) {
  console.error(apply.stderr || apply.stdout || "psql apply failed");
  process.exit(apply.status ?? 1);
}
console.log(apply.stdout.trim());

const check = spawnSync(
  "ssh",
  [...sshArgs, target, `docker exec -i ${pg} psql -U era -d era_clinic -v ON_ERROR_STOP=1`],
  { input: verify, encoding: "utf8" },
);
if (check.status !== 0) {
  console.error(check.stderr || check.stdout || "psql verify failed");
  process.exit(check.status ?? 1);
}
console.log(check.stdout.trim());
console.log("[solyuks] done");
