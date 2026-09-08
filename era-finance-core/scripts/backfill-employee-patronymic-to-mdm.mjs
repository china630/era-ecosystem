/**
 * Pre-migration ops: push legacy Employee.patronymic → MDM middleName (fill-not-clear).
 * Run BEFORE applying 20260901193000_fin_employee_name_canon if patronymic rows exist.
 *
 * Usage (from era-finance-core):
 *   DRY_RUN=1 node scripts/backfill-employee-patronymic-to-mdm.mjs
 *   node scripts/backfill-employee-patronymic-to-mdm.mjs
 *
 * Requires: DATABASE_URL, ORCHESTRATOR_INTERNAL_URL (or CONTROL_PLANE_URL),
 * ORCHESTRATOR_SERVICE_TOKEN (or SATELLITE_EVENT_SERVICE_TOKEN).
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, "../packages/database/package.json"));
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const baseUrl = (
  process.env.ORCHESTRATOR_INTERNAL_URL ||
  process.env.CONTROL_PLANE_URL ||
  "http://127.0.0.1:4000"
).replace(/\/$/, "");
const token =
  process.env.ORCHESTRATOR_SERVICE_TOKEN?.trim() ||
  process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim() ||
  "";
if (!token) {
  console.error("ORCHESTRATOR_SERVICE_TOKEN (or SATELLITE_EVENT_SERVICE_TOKEN) is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function columnExists(client, table, column) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return r.rowCount > 0;
}

async function workforceResolveMiddleName(organizationId, globalPersonId, middleName) {
  const res = await fetch(`${baseUrl}/internal/v1/mdm/persons/workforce-resolve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-service-token": token,
    },
    body: JSON.stringify({ organizationId, globalPersonId, middleName }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`workforce-resolve HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

try {
  const hasPatronymic = await columnExists(pool, "Employee", "patronymic");
  if (!hasPatronymic) {
    console.log("Employee.patronymic column absent — nothing to backfill.");
    process.exit(0);
  }

  const rows = await pool.query(
    `SELECT id, organization_id, global_person_id, patronymic
     FROM "Employee"
     WHERE patronymic IS NOT NULL AND btrim(patronymic) <> ''`,
  );

  console.log(`Found ${rows.rowCount} employee row(s) with patronymic. dryRun=${dryRun}`);

  let ok = 0;
  let fail = 0;
  for (const row of rows.rows) {
    const middleName = String(row.patronymic).trim();
    const label = `${row.id} org=${row.organization_id} person=${row.global_person_id}`;
    if (dryRun) {
      console.log(`[DRY_RUN] would resolve middleName="${middleName}" for ${label}`);
      ok++;
      continue;
    }
    try {
      await workforceResolveMiddleName(row.organization_id, row.global_person_id, middleName);
      console.log(`OK ${label} middleName="${middleName}"`);
      ok++;
    } catch (e) {
      console.error(`FAIL ${label}:`, e instanceof Error ? e.message : String(e));
      fail++;
    }
  }

  console.log(`Done. ok=${ok} fail=${fail}`);
  if (fail > 0) process.exit(1);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
