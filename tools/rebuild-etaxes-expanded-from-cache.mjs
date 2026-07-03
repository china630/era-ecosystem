/**
 * Rebuild expanded tax registry CSV from .cache/etaxes-search/ (no API calls).
 * Merges donor rows from azerbaijan-legal-entities.csv when present.
 *
 * Output: data/legal-entities/azerbaijan-tax-registry-expanded.csv
 *
 * Usage:
 *   node tools/rebuild-etaxes-expanded-from-cache.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { flattenTaxpayer, csvEscape } from "./etaxes-flatten.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "legal-entities");
const CACHE_DIR = path.join(OUT_DIR, ".cache", "etaxes-search");
const DONOR_CSV = path.join(OUT_DIR, "azerbaijan-legal-entities.csv");
const OUT_CSV = path.join(OUT_DIR, "azerbaijan-tax-registry-expanded.csv");
const STATS = path.join(OUT_DIR, ".expanded-rebuild-stats.json");

function isAzVoen(v) {
  return /^\d{10}$/.test(String(v ?? "").trim());
}

function parseCsvLine(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  const readField = () => {
    let field = "";
    if (text[i] === '"') {
      i++;
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else field += text[i++];
      }
      if (text[i] === ",") i++;
      return field;
    }
    while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") field += text[i++];
    if (text[i] === ",") i++;
    return field;
  };
  const headers = [];
  while (i < len && text[i] !== "\n" && text[i] !== "\r") headers.push(readField());
  while (text[i] === "\n" || text[i] === "\r") i++;
  while (i < len) {
    const row = {};
    for (const h of headers) row[h] = i < len ? readField() : "";
    rows.push(row);
    while (i < len && (text[i] === "\n" || text[i] === "\r")) i++;
  }
  return rows;
}

function loadDonorRowsByVoen() {
  if (!fs.existsSync(DONOR_CSV)) return new Map();
  const rows = parseCsvLine(fs.readFileSync(DONOR_CSV, "utf8"));
  const byVoen = new Map();
  for (const row of rows) {
    const voen = String(row.voen ?? "").trim();
    if (!isAzVoen(voen)) continue;
    byVoen.set(voen, row);
  }
  return byVoen;
}

function ingestFromCache(byVoen, stats) {
  if (!fs.existsSync(CACHE_DIR)) {
    console.log("No cache directory:", CACHE_DIR);
    return;
  }
  for (const file of fs.readdirSync(CACHE_DIR)) {
    if (!file.endsWith(".json")) continue;
    stats.cache_files++;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), "utf8"));
    } catch {
      stats.cache_parse_errors++;
      continue;
    }
    if (data.error) {
      stats.cache_errors++;
      continue;
    }
    const q = data.query ?? "";
    for (const tp of data.taxpayers ?? []) {
      const flat = flattenTaxpayer(tp, q);
      const voen = String(flat.voen ?? "").trim();
      if (!isAzVoen(voen)) continue;
      stats.taxpayer_hits++;
      if (!byVoen.has(voen)) {
        byVoen.set(voen, {
          match_status: "tax_registry",
          source_queries: q,
          ...flat,
          donor_sectors: "",
          donor_ids: "",
          donor_search_names: "",
          donor_names: "",
          donor_cities: "",
          donor_addresses: "",
          donor_phones: "",
          donor_emails: "",
          donor_websites: "",
          donor_voens: "",
          donor_categories: "",
          donor_extra_json: "",
        });
      } else {
        const ex = byVoen.get(voen);
        if (!ex.tax_name && flat.tax_name) Object.assign(ex, flat);
        if (ex.source_queries && q && !ex.source_queries.includes(q)) {
          ex.source_queries = `${ex.source_queries} | ${q}`;
        } else if (!ex.source_queries) ex.source_queries = q;
        if (!ex.match_status || ex.match_status === "tax_registry") {
          /* keep donor match_status from merge */
        }
      }
    }
  }
}

function mergeDonorOverlay(byVoen, donorByVoen) {
  for (const [voen, donor] of donorByVoen) {
    if (!byVoen.has(voen)) {
      byVoen.set(voen, { ...donor, source_queries: donor.search_query ?? "" });
      continue;
    }
    const row = byVoen.get(voen);
    for (const [k, v] of Object.entries(donor)) {
      if (v && (!row[k] || k.startsWith("donor_") || k === "match_status")) row[k] = v;
    }
  }
}

const header = [
  "match_status",
  "source_queries",
  "search_query",
  "voen",
  "tax_name",
  "tax_legal_address",
  "tax_legitimate",
  "tax_legal_form",
  "tax_charter_capital",
  "tax_voen_registered_at",
  "tax_state_registered_at",
  "tax_status",
  "tax_active",
  "tax_vat_payer",
  "tax_risky_payer",
  "tax_debt",
  "tax_authority",
  "tax_organization_type",
  "donor_sectors",
  "donor_ids",
  "donor_search_names",
  "donor_names",
  "donor_cities",
  "donor_addresses",
  "donor_phones",
  "donor_emails",
  "donor_websites",
  "donor_voens",
  "donor_categories",
  "donor_extra_json",
  "tax_extract_date",
  "tax_financial_year_start",
  "tax_financial_year_end",
  "tax_sanctions",
  "tax_raw_json",
];

function main() {
  const stats = {
    cache_files: 0,
    cache_errors: 0,
    cache_parse_errors: 0,
    taxpayer_hits: 0,
  };
  const byVoen = new Map();
  const donorByVoen = loadDonorRowsByVoen();
  ingestFromCache(byVoen, stats);
  mergeDonorOverlay(byVoen, donorByVoen);

  const rows = [...byVoen.values()].sort((a, b) =>
    (a.tax_name || a.donor_names || a.voen || "").localeCompare(
      b.tax_name || b.donor_names || b.voen || "",
      "az",
    ),
  );

  const csv = [
    header.join(","),
    ...rows.map((r) =>
      header
        .map((h) => {
          if (h === "search_query" && !r.search_query) return csvEscape(r.source_queries ?? "");
          return csvEscape(r[h]);
        })
        .join(","),
    ),
  ].join("\n");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_CSV, csv, "utf8");
  const outStats = {
    ...stats,
    unique_voen: rows.length,
    tax_registry: rows.filter((r) => r.match_status === "tax_registry").length,
    with_donor_ids: rows.filter((r) => r.donor_ids).length,
    finished_at: new Date().toISOString(),
  };
  fs.writeFileSync(STATS, JSON.stringify(outStats, null, 2), "utf8");
  console.log("Done:", outStats);
  console.log("Output:", OUT_CSV);
}

main();
