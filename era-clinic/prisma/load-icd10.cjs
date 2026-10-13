"use strict";

const { PrismaClient } = require("@prisma/client");
const { randomBytes } = require("crypto");
const { loadIcd10Catalog, ICD10_VERSION } = require("../../packages/satellite-kit/icd10/catalog.cjs");

const BATCH = 500;
const COLS = 11;

function cuidLike() {
  return `icd_${randomBytes(12).toString("hex")}`;
}

async function upsertBatch(tx, slice) {
  const values = [];
  const params = [];
  slice.forEach((r, i) => {
    const b = i * COLS;
    values.push(
      `($${b + 1}, $${b + 2}, $${b + 3}::"IcdCodeKind", $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, true)`,
    );
    params.push(
      cuidLike(), r.code, r.kind, r.chapterCode, r.blockCode, r.parentCode,
      r.titleAz, r.titleRu, r.titleEn, r.searchText, r.selectable,
    );
  });
  await tx.$executeRawUnsafe(
    `INSERT INTO "IcdCode" (id, code, kind, chapter_code, block_code, parent_code, title_az, title_ru, title_en, search_text, selectable, active)
     VALUES ${values.join(",\n")}
     ON CONFLICT (code) DO UPDATE SET
       kind = EXCLUDED.kind,
       chapter_code = EXCLUDED.chapter_code,
       block_code = EXCLUDED.block_code,
       parent_code = EXCLUDED.parent_code,
       title_az = EXCLUDED.title_az,
       title_ru = EXCLUDED.title_ru,
       title_en = EXCLUDED.title_en,
       search_text = EXCLUDED.search_text,
       selectable = EXCLUDED.selectable`,
    ...params,
  );
}

/**
 * Upsert the original WHO ICD-10 2019 catalog (RU/AZ titles) into unscoped IcdCode by code.
 * Diagnoses are never touched. Codes absent from the catalog are deleted when unreferenced,
 * otherwise retired (active=false) and listed in orphanDiagnoses; admin-retired catalog codes
 * stay retired. Skips when the stored version matches,
 * unless opts.force / ERA_ICD10_RELOAD=1. opts.catalog = { version, rows } (e.g. from the
 * orchestrator gateway) replaces the bundled catalog.
 */
async function loadIcd10(prisma = new PrismaClient(), opts = {}) {
  const client = prisma;
  const { rows, version, coverage } = opts.catalog ?? loadIcd10Catalog();
  const force = Boolean(opts.force || process.env.ERA_ICD10_RELOAD === "1");
  const existing = await client.icdCode.count();
  const tenant = await client.tenant.findFirst({ select: { icd10Version: true } }).catch(() => null);

  if (existing > 0 && !force && tenant?.icd10Version === version) {
    console.log("ICD-10 up to date", JSON.stringify({ existing, version, skip: true }));
    return { skipped: true, existing, version };
  }

  const codes = rows.map((r) => r.code);
  const result = await client.$transaction(
    async (tx) => {
      for (let i = 0; i < rows.length; i += BATCH) {
        await upsertBatch(tx, rows.slice(i, i + BATCH));
      }
      const removed = await tx.$executeRawUnsafe(
        `DELETE FROM "IcdCode" i
         WHERE NOT (i.code = ANY($1::text[]))
           AND NOT EXISTS (SELECT 1 FROM "ClinicalDiagnosis" d WHERE d.icd_code_id = i.id)
           AND NOT EXISTS (SELECT 1 FROM "VisitDiagnosis" d WHERE d.icd_code_id = i.id)
           AND NOT EXISTS (SELECT 1 FROM "AdmissionDiagnosis" d WHERE d.icd_code_id = i.id)`,
        codes,
      );
      const retired = await tx.$executeRawUnsafe(
        `UPDATE "IcdCode" SET active = false, retired_at = COALESCE(retired_at, now())
         WHERE active = true AND NOT (code = ANY($1::text[]))`,
        codes,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "Tenant" SET icd_favorite_codes =
           ARRAY(SELECT c FROM unnest(icd_favorite_codes) AS c WHERE c = ANY($1::text[]))
         WHERE NOT (icd_favorite_codes <@ $1::text[])`,
        codes,
      );
      const orphanDiagnoses = await tx.$queryRawUnsafe(
        `SELECT i.code, count(*)::int AS n FROM (
           SELECT icd_code_id FROM "ClinicalDiagnosis"
           UNION ALL SELECT icd_code_id FROM "VisitDiagnosis"
           UNION ALL SELECT icd_code_id FROM "AdmissionDiagnosis"
         ) d JOIN "IcdCode" i ON i.id = d.icd_code_id
         WHERE NOT (i.code = ANY($1::text[]))
         GROUP BY i.code ORDER BY i.code`,
        codes,
      );
      return { removed, retired, orphanDiagnoses };
    },
    { timeout: 300_000, maxWait: 30_000 },
  );

  try {
    await client.tenant.updateMany({
      data: { icd10Version: version, icd10SyncedAt: new Date() },
    });
  } catch {
    /* Tenant may be empty on satellite-only seed */
  }

  const loaded = await client.icdCode.count({ where: { active: true } });
  const summary = {
    skipped: false,
    loaded,
    upserted: rows.length,
    removed: Number(result.removed),
    retired: Number(result.retired),
    orphanDiagnoses: result.orphanDiagnoses,
    version,
    coverage,
  };
  console.log("ICD-10 loaded", JSON.stringify(summary));
  return summary;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await loadIcd10(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { loadIcd10, ICD10_VERSION };
