"use strict";

const { PrismaClient } = require("@prisma/client");
const { randomBytes } = require("crypto");
const { generateIcd10Catalog, catalogStats, ICD10_VERSION } = require("../../packages/satellite-kit/icd10/generate-icd10.cjs");

function cuidLike() {
  return `icd_${randomBytes(12).toString("hex")}`;
}

async function loadIcd10(prisma = new PrismaClient(), opts = {}) {
  const own = prisma === undefined;
  const client = prisma;
  const { rows, version } = generateIcd10Catalog();
  const stats = catalogStats(rows);
  const existing = await client.icdCode.count();
  const force = Boolean(opts.force || process.env.ERA_ICD10_RELOAD === "1");

  if (existing > 1000 && !force) {
    console.log("ICD-10 already loaded", JSON.stringify({ existing, version, skip: true }));
    return { skipped: true, existing, version, stats };
  }

  if (existing > 0) {
    await client.admissionDiagnosis.deleteMany();
    await client.visitDiagnosis.deleteMany();
    await client.clinicalDiagnosis.deleteMany();
    await client.icdCode.deleteMany();
  }

  const batchSize = 800;
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize).map((r) => ({ id: cuidLike(), ...r }));
    await client.icdCode.createMany({ data: slice });
  }

  await client.tenant.updateMany({
    data: { icd10Version: version, icd10SyncedAt: new Date() },
  });

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
