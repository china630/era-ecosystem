"use strict";

/**
 * Original WHO ICD-10 2019 catalog with RU (Minzdrav RF 1.2.643.5.1.13.13.11.1005 v2.27) and
 * AZ (XBT-10, AR Səhiyyə Nazirliyi 2012) titles. Built by build-icd10-catalog.cjs.
 * titleRu / titleAz are null where the source has no translation (e.g. post-2012 WHO codes).
 */

const data = require("./data/icd10-catalog.json");

const ICD10_VERSION = data.version;

let cached = null;

function searchTextOf(r) {
  return [r.code, r.titleEn, r.titleRu || "", r.titleAz || ""].join(" ").toLowerCase();
}

function loadIcd10Catalog() {
  if (!cached) {
    const rows = data.rows.map((r) => ({ ...r, searchText: searchTextOf(r), active: true }));
    cached = { version: ICD10_VERSION, coverage: data.coverage, rows };
  }
  return cached;
}

function catalogStats(rows) {
  const byKind = {};
  let selectable = 0;
  for (const r of rows) {
    byKind[r.kind] = (byKind[r.kind] || 0) + 1;
    if (r.selectable) selectable += 1;
  }
  return {
    total: rows.length,
    selectable,
    byKind,
    chapterCount: byKind.CHAPTER || 0,
    coverage: data.coverage,
  };
}

module.exports = { ICD10_VERSION, loadIcd10Catalog, catalogStats, searchTextOf };
