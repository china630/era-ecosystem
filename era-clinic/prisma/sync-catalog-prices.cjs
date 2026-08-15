"use strict";
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const root = __dirname;

function load(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

async function main() {
  const byCode = new Map();

  for (const row of load("seed-data/nafta/era-prices.json")) {
    const code = String(row.code || "").trim();
    if (!code) continue;
    const amount = Number(row.amount ?? 0);
    const packageIncluded = Boolean(row.packageIncluded);
    byCode.set(code, {
      amount: packageIncluded ? 0 : amount,
      packageIncluded,
      department: row.department || null,
    });
  }

  const catalog = load("seed-data/nafta/catalog.json");
  for (const row of catalog) {
    const code = String(row.code || "").trim();
    if (!code) continue;
    const price = row.price == null ? null : Number(row.price);
    const prev = byCode.get(code) || {
      amount: 0,
      packageIncluded: false,
      department: null,
    };
    if (price != null && price > 0) {
      byCode.set(code, {
        amount: price,
        packageIncluded: false,
        department: prev.department || row.sheet || null,
      });
    } else if (!byCode.has(code)) {
      byCode.set(code, prev);
    }
  }

  const prices = load("seed-data/nafta/era-prices.json");
  const catByAz = new Map();
  for (const c of catalog) {
    const k = String(c.nameAz || "").trim().toLowerCase();
    if (k && c.price != null && Number(c.price) > 0) catByAz.set(k, c);
  }
  for (const p of prices) {
    const k = String(p.descriptionAz || "").trim().toLowerCase();
    const hit = catByAz.get(k);
    if (!hit) continue;
    const price = Number(hit.price);
    if (!(price > 0)) continue;
    byCode.set(hit.code, {
      amount: price,
      packageIncluded: false,
      department: hit.sheet || null,
    });
  }

  let updated = 0;
  for (const [code, fields] of byCode) {
    const existing = await prisma.serviceCatalogCache.findUnique({ where: { code } });
    if (!existing) continue;
    await prisma.serviceCatalogCache.update({
      where: { code },
      data: {
        amount: fields.amount,
        packageIncluded: fields.packageIncluded,
        department: fields.department,
      },
    });
    updated++;
  }

  await prisma.serviceCatalogCache.upsert({
    where: { code: "SVC-VAKUMTERAPIYA" },
    create: {
      code: "SVC-VAKUMTERAPIYA",
      description: "Vakumterapiya",
      descriptionAz: "Vakumterapiya",
      descriptionRu: "Вакуумтерапия",
      descriptionEn: "Vacuum therapy",
      amount: 0,
      kind: "PROCEDURE",
    },
    update: {
      descriptionAz: "Vakumterapiya",
      descriptionRu: "Вакуумтерапия",
      descriptionEn: "Vacuum therapy",
    },
  });

  console.log("[sync-catalog-prices] updated", updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
