"use strict";
/**
 * Backfill ServiceCatalogCache i18n:
 * - PROCEDURE descriptionEn from seed-data/nafta/procedure-en-names.json (+ era-prices)
 * - LAB/DIAGNOSTIC/OTHER packages force-set from diagnostic-lab-catalog.json titles
 * - Nafta catalog.json nameAz/Ru/En by code + fuzzy by Russian description
 *
 * Usage: node prisma/backfill-catalog-i18n-v2.cjs
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

async function forceSet(code, fields) {
  const existing = await prisma.serviceCatalogCache.findUnique({ where: { code } });
  if (!existing) return false;
  const data = {};
  if (fields.descriptionAz) data.descriptionAz = fields.descriptionAz;
  if (fields.descriptionRu) data.descriptionRu = fields.descriptionRu;
  if (fields.descriptionEn) data.descriptionEn = fields.descriptionEn;
  if (fields.description) data.description = fields.description;
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
        description: tpl.title.en || null,
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
      description: panel.title.en || null,
      descriptionEn: panel.title.en || null,
      descriptionRu: panel.title.ru || null,
      descriptionAz: panel.title.az || null,
    });
  }
  for (const pkg of catalog.packages || []) {
    if (!pkg.code || !pkg.title) continue;
    map.set(pkg.code, {
      description: pkg.title.en || null,
      descriptionEn: pkg.title.en || null,
      descriptionRu: pkg.title.ru || null,
      descriptionAz: pkg.title.az || null,
    });
  }
  return map;
}

async function main() {
  const enByCode = loadJson("seed-data/nafta/procedure-en-names.json");
  let enUpdated = 0;
  for (const [code, descriptionEn] of Object.entries(enByCode)) {
    if (!descriptionEn) continue;
    if (await forceSet(code, { descriptionEn: String(descriptionEn) })) enUpdated++;
  }
  console.log("[i18n-v2] procedure EN updated=", enUpdated);

  // Prefer era-prices / catalog.json full triples for PROCEDURE
  const byCode = new Map();
  const byRu = new Map();
  for (const row of loadJson("seed-data/nafta/era-prices.json")) {
    const code = String(row.code || "").trim();
    if (!code) continue;
    const fields = {
      descriptionAz: row.descriptionAz ? String(row.descriptionAz).trim() : null,
      descriptionRu: row.descriptionRu
        ? String(row.descriptionRu).trim()
        : row.description
          ? String(row.description).trim()
          : null,
      descriptionEn:
        row.descriptionEn
          ? String(row.descriptionEn).trim()
          : enByCode[code] || null,
      description: row.description ? String(row.description).trim() : null,
    };
    byCode.set(code, fields);
    const ruKey = normName(fields.descriptionRu);
    if (ruKey) byRu.set(ruKey, fields);
  }
  for (const row of loadJson("seed-data/nafta/catalog.json")) {
    const code = String(row.code || "").trim();
    if (!code) continue;
    const prev = byCode.get(code) || {};
    const fields = {
      descriptionAz: row.nameAz ? String(row.nameAz).trim() : prev.descriptionAz || null,
      descriptionRu: row.nameRu ? String(row.nameRu).trim() : prev.descriptionRu || null,
      descriptionEn:
        row.nameEn
          ? String(row.nameEn).trim()
          : prev.descriptionEn || enByCode[code] || null,
      description: row.nameRu || row.nameAz || prev.description || null,
    };
    byCode.set(code, fields);
    const ruKey = normName(fields.descriptionRu);
    if (ruKey) byRu.set(ruKey, fields);
  }

  let procUpdated = 0;
  for (const [code, fields] of byCode) {
    if (await forceSet(code, fields)) procUpdated++;
  }
  console.log("[i18n-v2] procedure triples updated=", procUpdated);

  // Fuzzy fill remaining PROCEDURE missing EN/AZ by Russian description
  const missing = await prisma.serviceCatalogCache.findMany({
    where: {
      kind: "PROCEDURE",
      OR: [{ descriptionEn: null }, { descriptionAz: null }, { descriptionRu: null }],
    },
  });
  let fuzzy = 0;
  for (const row of missing) {
    const hit = byRu.get(normName(row.descriptionRu || row.description));
    if (!hit) continue;
    if (
      await forceSet(row.code, {
        descriptionAz: row.descriptionAz || hit.descriptionAz,
        descriptionRu: row.descriptionRu || hit.descriptionRu,
        descriptionEn: row.descriptionEn || hit.descriptionEn,
      })
    ) {
      fuzzy++;
    }
  }
  console.log("[i18n-v2] procedure fuzzy updated=", fuzzy);

  // LAB/DIAGNOSTIC/packages — overwrite from diagnostic catalog (distinct locales)
  const diagMap = collectDiagnosticI18n(loadJson("seed-data/diagnostic-lab-catalog.json"));
  let diagUpdated = 0;
  for (const [code, fields] of diagMap) {
    if (await forceSet(code, fields)) diagUpdated++;
  }
  console.log("[i18n-v2] diagnostic/lab force-set=", diagUpdated);

  // Remaining LAB rows from lab-tests.json: keep AZ name as az; use EN if ASCII medical term
  const labs = loadJson("seed-data/nafta/lab-tests.json");
  let labExtra = 0;
  for (const lab of labs) {
    const code = String(lab.code || "").trim();
    if (!code) continue;
    const name = String(lab.name || "").trim();
    if (!name) continue;
    const existing = await prisma.serviceCatalogCache.findUnique({ where: { code } });
    if (!existing) continue;
    // Only fill gaps; do not overwrite diagnostic-catalog triples with identical copies
    const data = {};
    if (!existing.descriptionAz) data.descriptionAz = name;
    if (!existing.descriptionRu) data.descriptionRu = name;
    if (!existing.descriptionEn && /^[\x20-\x7E]+$/.test(name)) data.descriptionEn = name;
    if (Object.keys(data).length === 0) continue;
    await prisma.serviceCatalogCache.update({ where: { code }, data });
    labExtra++;
  }
  console.log("[i18n-v2] lab-tests gap-fill=", labExtra);

  const all = await prisma.serviceCatalogCache.findMany({
    select: {
      kind: true,
      descriptionAz: true,
      descriptionRu: true,
      descriptionEn: true,
    },
  });
  const byKind = {};
  for (const row of all) {
    const k = row.kind || "OTHER";
    if (!byKind[k]) byKind[k] = { total: 0, az: 0, ru: 0, en: 0 };
    byKind[k].total++;
    if (row.descriptionAz) byKind[k].az++;
    if (row.descriptionRu) byKind[k].ru++;
    if (row.descriptionEn) byKind[k].en++;
  }
  console.log("[i18n-v2] stats", byKind);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
