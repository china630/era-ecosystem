"use strict";

const { PrismaClient } = require("@prisma/client");
const { randomBytes } = require("crypto");
const { generateIcd10Catalog, catalogStats, ICD10_VERSION } = require("../../packages/satellite-kit/icd10/generate-icd10.cjs");

function cuidLike() {
  return `icd_${randomBytes(12).toString("hex")}`;
}

/**
 * Load WHO ICD-10 into unscoped IcdCode.
 * If any rows exist, skip (never wipe diagnoses). Force only with ERA_ICD10_RELOAD=1
 * when diagnosis tables are empty (or NODE_ENV !== production).
 */
async function loadIcd10(prisma = new PrismaClient(), opts = {}) {
  const client = prisma;
  const { rows, version } = generateIcd10Catalog();
  const stats = catalogStats(rows);
  const existing = await client.icdCode.count();
  const force = Boolean(opts.force || process.env.ERA_ICD10_RELOAD === "1");

  if (existing > 0 && !force) {
    console.log("ICD-10 already loaded", JSON.stringify({ existing, version, skip: true }));
    return { skipped: true, existing, version, stats };
  }

  if (existing > 0 && force) {
    const [clinical, visit, admission] = await Promise.all([
      client.clinicalDiagnosis.count(),
      client.visitDiagnosis.count(),
      client.admissionDiagnosis.count(),
    ]);
    const dxTotal = clinical + visit + admission;
    const isProd = process.env.NODE_ENV === "production";
    if (dxTotal > 0 || isProd) {
      const err = new Error(
        `ERA_ICD10_RELOAD refused: diagnoses=${dxTotal} NODE_ENV=${process.env.NODE_ENV ?? ""} — clear diagnoses in non-prod first`,
      );
      console.error(err.message);
      throw err;
    }
    await client.icdCode.deleteMany();
  }

  const batchSize = 800;
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize).map((r) => ({ id: cuidLike(), ...r }));
    await client.icdCode.createMany({ data: slice });
  }

  try {
    await client.tenant.updateMany({
      data: { icd10Version: version, icd10SyncedAt: new Date() },
    });
  } catch {
    /* Tenant may be empty on satellite-only seed */
  }

  const loaded = await client.icdCode.count();
  console.log("ICD-10 loaded", JSON.stringify({ loaded, version, stats }));
  return { skipped: false, loaded, version, stats };
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
