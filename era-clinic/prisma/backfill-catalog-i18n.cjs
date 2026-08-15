"use strict";
/**
 * Backfill ServiceCatalogCache.descriptionAz/Ru/En from:
 * 1) diagnostic-lab-catalog.json (LAB / DIAGNOSTIC / package OTHER)
 * 2) nafta/catalog.json + nafta/era-prices.json (PROCEDURE) by exact code
 * 3) fuzzy match remaining PROCEDURE rows by Russian/legacy description
 *
 * Usage: node prisma/backfill-catalog-i18n.cjs
 * Requires DATABASE_URL.
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const root = __dirname;

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/\s+/g, " ")
    .replace(/[«»"']/g, "")
    .trim();
}

async function forceSetI18n(code, fields) {
  const existing = await prisma.serviceCatalogCache.findUnique({ where: { code } });
  if (!existing) return false;
  const data = {};
  if (fields.descriptionAz) data.descriptionAz = fields.descriptionAz;
  if (fields.descriptionRu) data.descriptionRu = fields.descriptionRu;
  if (fields.descriptionEn) data.descriptionEn = fields.descriptionEn;
  if (Object.keys(data).length === 0) return false;
  await prisma.serviceCatalogCache.update({ where: { code }, data });
  return true;
}

function collectDiagnosticI18n(catalog) {
  const map = new Map();
  for (const modality of catalog.modalities || []) {
    for (const tpl of modality.templates || []) {
      const code = tpl.serviceCode || tpl.code;
      if (!code || !tpl.title) continue;
      map.set(code, {
        descriptionEn: tpl.title.en || null,
        descriptionRu: tpl.title.ru || null,
        descriptionAz: tpl.title.az || null,
      });
    }
  }
  for (const panel of catalog.labPanels || []) {
    const code = panel.serviceCode || panel.code;
    if (!code || !panel.title) continue;
    map.set(code, {
      descriptionEn: panel.title.en || null,
      descriptionRu: panel.title.ru || null,
      descriptionAz: panel.title.az || null,
    });
  }
  for (const pkg of catalog.packages || []) {
    if (!pkg.code || !pkg.title) continue;
    map.set(pkg.code, {
      descriptionEn: pkg.title.en || null,
      descriptionRu: pkg.title.ru || null,
      descriptionAz: pkg.title.az || null,
    });
  }
  return map;
}

function collectNaftaI18n() {
  const byCode = new Map();
  const byRu = new Map();

  const prices = loadJson("seed-data/nafta/era-prices.json");
  for (const row of prices) {
    const code = row.code && String(row.code).trim();
    if (!code) continue;
    const fields = {
      descriptionAz: row.descriptionAz ? String(row.descriptionAz).trim() : null,
      descriptionRu: row.descriptionRu
        ? String(row.descriptionRu).trim()
        : row.description
          ? String(row.description).trim()
          : null,
      descriptionEn: row.descriptionEn ? String(row.descriptionEn).trim() : null,
    };
    byCode.set(code, fields);
    const ruKey = normName(fields.descriptionRu);
    if (ruKey) byRu.set(ruKey, fields);
  }

  const catalog = loadJson("seed-data/nafta/catalog.json");
  for (const row of catalog) {
    const code = row.code && String(row.code).trim();
    if (!code) continue;
    const fields = {
      descriptionAz: row.nameAz ? String(row.nameAz).trim() : null,
      descriptionRu: row.nameRu ? String(row.nameRu).trim() : null,
      descriptionEn: null,
    };
    const prev = byCode.get(code) || {};
    byCode.set(code, {
      descriptionAz: fields.descriptionAz || prev.descriptionAz || null,
      descriptionRu: fields.descriptionRu || prev.descriptionRu || null,
      descriptionEn: prev.descriptionEn || null,
    });
    const ruKey = normName(fields.descriptionRu);
    if (ruKey) {
      const prevRu = byRu.get(ruKey) || {};
      byRu.set(ruKey, {
        descriptionAz: fields.descriptionAz || prevRu.descriptionAz || null,
        descriptionRu: fields.descriptionRu || prevRu.descriptionRu || null,
        descriptionEn: prevRu.descriptionEn || null,
      });
    }
  }

  return { byCode, byRu };
}

async function main() {
  const diag = loadJson("seed-data/diagnostic-lab-catalog.json");
  const diagMap = collectDiagnosticI18n(diag);
  let diagUpdated = 0;
  for (const [code, fields] of diagMap) {
    if (await forceSetI18n(code, fields)) diagUpdated++;
  }
  console.log("[backfill-catalog-i18n] diagnostic/lab updated=", diagUpdated);

  const { byCode, byRu } = collectNaftaI18n();
  let naftaExact = 0;
  for (const [code, fields] of byCode) {
    if (await forceSetI18n(code, fields)) naftaExact++;
  }
  console.log("[backfill-catalog-i18n] nafta exact-code updated=", naftaExact);

  const missing = await prisma.serviceCatalogCache.findMany({
    where: {
      OR: [{ descriptionAz: null }, { descriptionRu: null }],
    },
  });

  let fuzzy = 0;
  for (const row of missing) {
    const key = normName(row.descriptionRu || row.description);
    const hit = key ? byRu.get(key) : null;
    if (!hit) continue;
    const fields = {
      descriptionAz: row.descriptionAz || hit.descriptionAz || null,
      descriptionRu: row.descriptionRu || hit.descriptionRu || null,
      descriptionEn: row.descriptionEn || hit.descriptionEn || null,
    };
    if (await forceSetI18n(row.code, fields)) fuzzy++;
  }
  console.log("[backfill-catalog-i18n] fuzzy-by-ru updated=", fuzzy);

  const still = await prisma.serviceCatalogCache.findMany({
    where: { descriptionEn: null },
  });
  let enCopied = 0;
  for (const row of still) {
    const d = (row.description || "").trim();
    if (!d) continue;
    if (/^[\x20-\x7E]+$/.test(d) && /[A-Za-z]/.test(d)) {
      await prisma.serviceCatalogCache.update({
        where: { code: row.code },
        data: { descriptionEn: d },
      });
      enCopied++;
    }
  }
  console.log("[backfill-catalog-i18n] descriptionEn from ASCII description=", enCopied);

  const [stats] = await prisma.$queryRaw`
    SELECT count(*)::int AS total,
           count("description_az")::int AS az,
           count("description_ru")::int AS ru,
           count("description_en")::int AS en
    FROM "ServiceCatalogCache"
  `;
  console.log("[backfill-catalog-i18n] final", stats);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
