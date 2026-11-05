#!/usr/bin/env node
/**
 * Nafta clinic droplet: apply Word-blank norm sentences + numeric pairs,
 * then refresh LabResult snapshots (chosen min/max + sentence) and flags.
 *
 *   node scripts/nafta-apply-blank-norms.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORG = "6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b";
const normsPath = path.join(
  root,
  "era-clinic",
  "prisma",
  "seed-data",
  "nafta",
  "lab-blank-norms.json",
);

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

function q(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlList(codes) {
  return codes.map((c) => q(c)).join(", ");
}

const payload = JSON.parse(fs.readFileSync(normsPath, "utf8"));
const zonesCatalog = payload.vitaminDZones ?? [];
const statements = ["BEGIN;"];

for (const row of payload.rows ?? []) {
  const norm = row.normText ?? {};
  const zones =
    row.zonesFrom === "vitaminDZones" ? zonesCatalog : row.zones ?? null;
  const serviceFilter = row.services
    ? ` AND service_id IN (SELECT id FROM "DiagnosticService" WHERE "organizationId" = ${q(ORG)} AND code IN (${sqlList(row.services)}))`
    : "";
  const unitSql =
    row.unit !== undefined ? `, unit = ${q(row.unit)}` : "";
  const valueTypeSql = row.valueType
    ? `, value_type = ${q(row.valueType)}::"AnalyteValueType"`
    : "";
  statements.push(`
UPDATE "DiagnosticAnalyte"
SET label_az = ${q(row.labelAz)},
    norm_text_en = ${q(norm.en || null)},
    norm_text_ru = ${q(norm.ru || null)},
    norm_text_az = ${q(norm.az || null)},
    bound_kind = ${q(row.boundKind ?? "INTERVAL")}::"AnalyteBoundKind",
    ref_min = ${q(row.refMin ?? null)},
    ref_max = ${q(row.refMax ?? null)},
    ref_min_female = ${q(row.refMinFemale ?? null)},
    ref_max_female = ${q(row.refMaxFemale ?? null)},
    ref_min_male = ${q(row.refMinMale ?? null)},
    ref_max_male = ${q(row.refMaxMale ?? null)},
    zones_json = ${q(zones ? JSON.stringify(zones) : null)}${unitSql}${valueTypeSql}
WHERE "organizationId" = ${q(ORG)}
  AND code IN (${sqlList(row.codes)})${serviceFilter};
`);

  if (row.valueOptions?.length) {
    statements.push(`
DELETE FROM "AnalyteValueOption" o
USING "DiagnosticAnalyte" a
WHERE o.analyte_id = a.id
  AND a."organizationId" = ${q(ORG)}
  AND a.code IN (${sqlList(row.codes)})${serviceFilter.replaceAll("service_id", "a.service_id")};
`);
    let i = 0;
    for (const opt of row.valueOptions) {
      statements.push(`
INSERT INTO "AnalyteValueOption" (id, "organizationId", analyte_id, code, label_en, label_ru, label_az, sort_order)
SELECT replace(gen_random_uuid()::text, '-', ''), ${q(ORG)}, a.id, ${q(opt.code)}, ${q(opt.labelEn)}, ${q(opt.labelRu)}, ${q(opt.labelAz)}, ${i}
FROM "DiagnosticAnalyte" a
WHERE a."organizationId" = ${q(ORG)}
  AND a.code IN (${sqlList(row.codes)})${serviceFilter.replaceAll("service_id", "a.service_id")}
  AND NOT EXISTS (
    SELECT 1 FROM "AnalyteValueOption" x WHERE x.analyte_id = a.id AND x.code = ${q(opt.code)}
  );
`);
      i += 1;
    }
  }
}

/** Refresh result snapshots from catalog (sentence + chosen pair by patient sex). */
statements.push(`
UPDATE "LabResult" r
SET
  norm_text_en = a.norm_text_en,
  norm_text_ru = a.norm_text_ru,
  norm_text_az = a.norm_text_az,
  unit = COALESCE(a.unit, r.unit),
  ref_min = CASE
    WHEN p.sex = 'FEMALE' AND (a.ref_min_female IS NOT NULL OR a.ref_max_female IS NOT NULL)
      THEN a.ref_min_female
    WHEN p.sex = 'MALE' AND (a.ref_min_male IS NOT NULL OR a.ref_max_male IS NOT NULL)
      THEN a.ref_min_male
    WHEN a.ref_min_female IS NOT NULL OR a.ref_min_male IS NOT NULL
      THEN NULL
    ELSE a.ref_min
  END,
  ref_max = CASE
    WHEN p.sex = 'FEMALE' AND (a.ref_min_female IS NOT NULL OR a.ref_max_female IS NOT NULL)
      THEN a.ref_max_female
    WHEN p.sex = 'MALE' AND (a.ref_min_male IS NOT NULL OR a.ref_max_male IS NOT NULL)
      THEN a.ref_max_male
    WHEN a.ref_min_female IS NOT NULL OR a.ref_min_male IS NOT NULL
      THEN NULL
    ELSE a.ref_max
  END
FROM "LabOrderItem" i
JOIN "LabOrder" o ON o.id = i.lab_order_id
JOIN "PatientRef" p ON p.id = o."patientRefId"
JOIN "DiagnosticAnalyte" a ON a.service_id = i.diagnostic_service_id
WHERE r.lab_order_item_id = i.id
  AND a.code = r.code
  AND r."organizationId" = ${q(ORG)}
  AND a."organizationId" = ${q(ORG)};
`);

/** Recompute flags for INTERVAL / UPPER_ONLY / LOWER_ONLY when both value and bounds are numeric. */
statements.push(`
UPDATE "LabResult" r
SET flag = CASE
  WHEN a.bound_kind = 'UPPER_ONLY'
   AND r.value ~ '^-?[0-9]+([.][0-9]+)?$'
   AND r.ref_max ~ '^-?[0-9]+([.][0-9]+)?$'
   AND r.value::numeric > r.ref_max::numeric THEN 'HIGH'::"LabResultFlag"
  WHEN a.bound_kind = 'UPPER_ONLY'
   AND r.value ~ '^-?[0-9]+([.][0-9]+)?$'
   AND r.ref_max ~ '^-?[0-9]+([.][0-9]+)?$' THEN 'NORMAL'::"LabResultFlag"
  WHEN a.bound_kind = 'LOWER_ONLY'
   AND r.value ~ '^-?[0-9]+([.][0-9]+)?$'
   AND r.ref_min ~ '^-?[0-9]+([.][0-9]+)?$'
   AND r.value::numeric < r.ref_min::numeric THEN 'LOW'::"LabResultFlag"
  WHEN a.bound_kind = 'LOWER_ONLY'
   AND r.value ~ '^-?[0-9]+([.][0-9]+)?$'
   AND r.ref_min ~ '^-?[0-9]+([.][0-9]+)?$' THEN 'NORMAL'::"LabResultFlag"
  WHEN a.bound_kind = 'INTERVAL'
   AND r.ref_min IS NULL AND r.ref_max IS NULL
   AND (a.ref_min_female IS NOT NULL OR a.ref_min_male IS NOT NULL)
   AND r.value ~ '^-?[0-9]+([.][0-9]+)?$' THEN
     CASE
       WHEN a.ref_min_female ~ '^-?[0-9]+([.][0-9]+)?$'
        AND a.ref_min_male ~ '^-?[0-9]+([.][0-9]+)?$'
        AND r.value::numeric < LEAST(a.ref_min_female::numeric, a.ref_min_male::numeric) THEN
          CASE WHEN r.value::numeric < LEAST(a.ref_min_female::numeric, a.ref_min_male::numeric) * 0.5
            THEN 'CRITICAL'::"LabResultFlag" ELSE 'LOW'::"LabResultFlag" END
       WHEN a.ref_max_female ~ '^-?[0-9]+([.][0-9]+)?$'
        AND a.ref_max_male ~ '^-?[0-9]+([.][0-9]+)?$'
        AND r.value::numeric > GREATEST(a.ref_max_female::numeric, a.ref_max_male::numeric) THEN
          CASE WHEN r.value::numeric > GREATEST(a.ref_max_female::numeric, a.ref_max_male::numeric) * 1.5
            THEN 'CRITICAL'::"LabResultFlag" ELSE 'HIGH'::"LabResultFlag" END
       ELSE 'NORMAL'::"LabResultFlag"
     END
  WHEN a.bound_kind IN ('INTERVAL', 'ZONES')
   AND r.value ~ '^-?[0-9]+([.][0-9]+)?$'
   AND r.ref_min ~ '^-?[0-9]+([.][0-9]+)?$'
   AND r.value::numeric < r.ref_min::numeric THEN
     CASE WHEN r.value::numeric < r.ref_min::numeric * 0.5 THEN 'CRITICAL'::"LabResultFlag" ELSE 'LOW'::"LabResultFlag" END
  WHEN a.bound_kind IN ('INTERVAL', 'ZONES')
   AND r.value ~ '^-?[0-9]+([.][0-9]+)?$'
   AND r.ref_max ~ '^-?[0-9]+([.][0-9]+)?$'
   AND r.value::numeric > r.ref_max::numeric THEN
     CASE WHEN r.ref_max::numeric > 0 AND r.value::numeric > r.ref_max::numeric * 1.5 THEN 'CRITICAL'::"LabResultFlag" ELSE 'HIGH'::"LabResultFlag" END
  WHEN a.bound_kind IN ('INTERVAL', 'ZONES')
   AND r.value ~ '^-?[0-9]+([.][0-9]+)?$'
   AND (r.ref_min ~ '^-?[0-9]+([.][0-9]+)?$' OR r.ref_max ~ '^-?[0-9]+([.][0-9]+)?$') THEN 'NORMAL'::"LabResultFlag"
  ELSE r.flag
END
FROM "LabOrderItem" i
JOIN "DiagnosticAnalyte" a ON a.service_id = i.diagnostic_service_id
WHERE r.lab_order_item_id = i.id
  AND a.code = r.code
  AND r."organizationId" = ${q(ORG)}
  AND a."organizationId" = ${q(ORG)}
  AND a.bound_kind <> 'QUALITATIVE';
`);

statements.push("COMMIT;");
statements.push(`
SELECT a.bound_kind, count(*)
FROM "DiagnosticAnalyte" a
WHERE a."organizationId" = ${q(ORG)}
  AND a.norm_text_az IS NOT NULL AND a.norm_text_az <> ''
GROUP BY a.bound_kind
ORDER BY 1;
`);

const sql = statements.join("\n");
const target = process.env.ERA_DROPLET_SSH?.trim();
if (!target) {
  console.error("Set ERA_DROPLET_SSH in .env.droplet-pull");
  process.exit(1);
}
const port = process.env.ERA_DROPLET_SSH_PORT?.trim() || "22";
let key = process.env.ERA_DROPLET_SSH_KEY?.trim() || "";
if (key.startsWith("~/")) key = path.join(os.homedir(), key.slice(2));
const sshArgs = [
  "-p",
  port,
  "-o",
  "StrictHostKeyChecking=accept-new",
  "-o",
  "BatchMode=yes",
];
if (key) sshArgs.push("-i", key);

const migrateSql = fs.readFileSync(
  path.join(
    root,
    "era-clinic",
    "prisma",
    "migrations",
    "20261104140000_analyte_norm_sentence",
    "migration.sql",
  ),
  "utf8",
);

const idempotentMig = fs.readFileSync(
  path.join(root, "tmp", "migrate-analyte-norms.sql"),
  "utf8",
);
console.log("[nafta-norms] ensure migration on droplet…");
const mig = spawnSync(
  "ssh",
  [
    ...sshArgs,
    target,
    "docker exec -i era-postgres psql -U era -d era_clinic -v ON_ERROR_STOP=1",
  ],
  {
    encoding: "utf8",
    input: idempotentMig,
    maxBuffer: 20 * 1024 * 1024,
  },
);
process.stdout.write(mig.stdout || "");
process.stderr.write(mig.stderr || "");
if (mig.status !== 0) {
  console.error("[nafta-norms] migration failed");
  process.exit(mig.status ?? 1);
}
// keep migrateSql referenced for repo alignment
void migrateSql;

console.log("[nafta-norms] apply blank norms…");
const remote = spawnSync(
  "ssh",
  [
    ...sshArgs,
    target,
    "docker exec -i era-postgres psql -U era -d era_clinic -v ON_ERROR_STOP=1",
  ],
  { encoding: "utf8", input: sql, maxBuffer: 20 * 1024 * 1024 },
);
process.stdout.write(remote.stdout || "");
process.stderr.write(remote.stderr || "");
process.exit(remote.status ?? 1);
