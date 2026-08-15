"use strict";
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DEFAULT_PATH = path.join(__dirname, "seed-data", "nafta", "era-prices.json");

function resolveDescription(row) {
  return (
    (row.description && String(row.description).trim()) ||
    (row.descriptionAz && String(row.descriptionAz).trim()) ||
    (row.descriptionRu && String(row.descriptionRu).trim()) ||
    row.code
  );
}

async function main() {
  const target = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_PATH;
  if (!fs.existsSync(target)) {
    console.log("[load-nafta-prices] skip: file not found:", target);
    return;
  }

  const rows = JSON.parse(fs.readFileSync(target, "utf8"));
  if (!Array.isArray(rows)) {
    throw new Error("era-prices.json must be a JSON array");
  }

  const now = new Date();
  let catalogCount = 0;
  let typeCount = 0;

  const enNamesPath = path.join(__dirname, "seed-data", "nafta", "procedure-en-names.json");
  const enByCode = fs.existsSync(enNamesPath)
    ? JSON.parse(fs.readFileSync(enNamesPath, "utf8"))
    : {};

  for (const row of rows) {
    const code = row.code && String(row.code).trim();
    if (!code) continue;

    const description = resolveDescription(row);
    const descriptionAz = row.descriptionAz ? String(row.descriptionAz).trim() : null;
    const descriptionRu = row.descriptionRu ? String(row.descriptionRu).trim() : null;
    const descriptionEn = row.descriptionEn
      ? String(row.descriptionEn).trim()
      : enByCode[code]
        ? String(enByCode[code]).trim()
        : null;
    const packageIncluded = Boolean(row.packageIncluded);
    const amount = packageIncluded ? 0 : Number(row.amount ?? 0);
    const department = row.department ? String(row.department).trim() : null;

    await prisma.serviceCatalogCache.upsert({
      where: { code },
      create: {
        code,
        description,
        descriptionAz,
        descriptionRu,
        descriptionEn,
        amount,
        packageIncluded,
        department,
        kind: "PROCEDURE",
        syncedAt: now,
      },
      update: {
        description,
        descriptionAz,
        descriptionRu,
        descriptionEn,
        amount,
        packageIncluded,
        department,
        kind: "PROCEDURE",
        syncedAt: now,
      },
    });
    catalogCount++;

    const pt = await prisma.procedureType.upsert({
      where: { code },
      create: { code, name: description, durationMin: 15 },
      update: { name: description },
    });
    typeCount++;

    const existing = await prisma.procedureTypeRequirement.findMany({
      where: { procedureTypeId: pt.id },
    });
    const hasPhysical = existing.some(
      (r) => r.role === "LOCATION" || r.role === "EQUIPMENT",
    );
    const hasStaff = existing.some((r) => r.role === "STAFF");
    if (!hasPhysical) {
      await prisma.procedureTypeRequirement.create({
        data: {
          procedureTypeId: pt.id,
          role: "EQUIPMENT",
          resourceKind: "EQUIPMENT",
          resourceCode: null,
          staffMode: "HARD",
          required: true,
        },
      });
    }
    if (!hasStaff) {
      await prisma.procedureTypeRequirement.create({
        data: {
          procedureTypeId: pt.id,
          role: "STAFF",
          staffMode: "SOFT",
          required: true,
        },
      });
    }
  }

  console.log(
    "[load-nafta-prices] catalog=",
    catalogCount,
    "procedureTypes=",
    typeCount,
    "from",
    target,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
