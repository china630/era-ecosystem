/**
 * Build master company files from e-taxes cache (+ donor overlay from existing master).
 *
 * Outputs:
 *   azerbaijan-companies-with-voen.csv      — dedup by VÖEN
 *   azerbaijan-companies-without-voen.csv  — unchanged unless legal-entities.csv present
 *
 * Usage:
 *   node tools/build-azerbaijan-companies-master.mjs
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { flattenTaxpayer, csvEscape } from "./etaxes-flatten.mjs";
import { normalizeNameKey } from "./etaxes-search-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "legal-entities");
const CACHE_DIR = path.join(OUT_DIR, ".cache", "etaxes-search");
const LEGAL_CSV = path.join(OUT_DIR, "azerbaijan-legal-entities.csv");
const WITH_VOEN_CSV = path.join(OUT_DIR, "azerbaijan-companies-with-voen.csv");
const WITHOUT_VOEN_CSV = path.join(OUT_DIR, "azerbaijan-companies-without-voen.csv");
const STATS_FILE = path.join(OUT_DIR, ".companies-master-stats.json");

const HEADER = [
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

const DONOR_KEYS = HEADER.filter((h) => h.startsWith("donor_"));

function isAzVoen(v) {
  return /^\d{10}$/.test(String(v ?? "").trim());
}

function parseCsv(text) {
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

function parseHeaderLine(line) {
  let i = 0;
  const len = line.length;
  const headers = [];
  const readField = () => {
    let field = "";
    if (line[i] === '"') {
      i++;
      while (i < len) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else field += line[i++];
      }
      if (line[i] === ",") i++;
      return field;
    }
    while (i < len && line[i] !== ",") field += line[i++];
    if (line[i] === ",") i++;
    return field;
  };
  while (i < len) headers.push(readField());
  return headers;
}

function parseDataRow(headers, recordLine) {
  let i = 0;
  const len = recordLine.length;
  const readField = () => {
    let field = "";
    if (recordLine[i] === '"') {
      i++;
      while (i < len) {
        if (recordLine[i] === '"') {
          if (recordLine[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else field += recordLine[i++];
      }
      if (recordLine[i] === ",") i++;
      return field;
    }
    while (i < len && recordLine[i] !== ",") field += recordLine[i++];
    if (recordLine[i] === ",") i++;
    return field;
  };
  const row = {};
  for (const h of headers) row[h] = i < len ? readField() : "";
  return row;
}

function ingestFromCache(byVoen, stats) {
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
          search_query: q,
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
          ex.search_query = ex.source_queries;
        } else if (!ex.source_queries) {
          ex.source_queries = q;
          ex.search_query = q;
        }
      }
    }
  }
}

async function loadDonorOverlayFromMaster() {
  const overlay = new Map();
  if (!fs.existsSync(WITH_VOEN_CSV)) return overlay;

  const rl = readline.createInterface({
    input: fs.createReadStream(WITH_VOEN_CSV, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let headers = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseHeaderLine(line);
      continue;
    }
    const raw = parseDataRow(headers, line);
    if (!raw.donor_ids?.trim()) continue;
    const voen = String(raw.voen ?? "").trim();
    if (!isAzVoen(voen)) continue;
    overlay.set(voen, raw);
  }
  return overlay;
}

function mergeDonorOverlay(byVoen, donorByVoen) {
  for (const [voen, donor] of donorByVoen) {
    if (!byVoen.has(voen)) {
      byVoen.set(voen, {
        ...donor,
        source_queries: donor.source_queries || donor.search_query || "",
        search_query: donor.search_query || donor.source_queries || "",
      });
      continue;
    }
    const row = byVoen.get(voen);
    for (const [k, v] of Object.entries(donor)) {
      if (v && (!row[k] || k.startsWith("donor_") || k === "match_status")) row[k] = v;
    }
  }
}

function buildWithoutVoenFromLegal() {
  if (!fs.existsSync(LEGAL_CSV)) return null;
  const withoutKey = new Map();
  for (const raw of parseCsv(fs.readFileSync(LEGAL_CSV, "utf8"))) {
    const voen = String(raw.voen ?? "").replace(/\D/g, "");
    if (voen.length === 10) continue;
    const key =
      String(raw.donor_ids ?? "").trim() ||
      normalizeNameKey(raw.donor_search_names || raw.donor_names || raw.search_query);
    if (!key) continue;
    const row = { ...raw, voen: "" };
    if (withoutKey.has(key)) {
      for (const k of DONOR_KEYS) {
        if (row[k]) withoutKey.get(key)[k] = row[k];
      }
    } else {
      withoutKey.set(key, row);
    }
  }
  return [...withoutKey.values()].sort((a, b) =>
    (a.donor_names || a.donor_search_names || "").localeCompare(
      b.donor_names || b.donor_search_names || "",
      "az",
    ),
  );
}

async function main() {
  const stats = {
    cache_files: 0,
    cache_errors: 0,
    cache_parse_errors: 0,
    taxpayer_hits: 0,
  };

  console.log("Loading donor overlay from existing master...");
  const donorOverlay = await loadDonorOverlayFromMaster();
  console.log(`  donor overlay rows: ${donorOverlay.size}`);

  const byVoen = new Map();
  console.log("Ingesting e-taxes cache...");
  ingestFromCache(byVoen, stats);
  mergeDonorOverlay(byVoen, donorOverlay);

  const withVoen = [...byVoen.values()].sort((a, b) =>
    (a.tax_name || a.donor_names || a.voen).localeCompare(b.tax_name || b.donor_names || b.voen, "az"),
  );

  const csvLines = [
    HEADER.join(","),
    ...withVoen.map((r) =>
      HEADER.map((h) => {
        if (h === "search_query" && !r.search_query) return csvEscape(r.source_queries ?? "");
        return csvEscape(r[h]);
      }).join(","),
    ),
  ];
  fs.writeFileSync(WITH_VOEN_CSV, `${csvLines.join("\n")}\n`, "utf8");

  let withoutVoenCount = 0;
  const withoutFromLegal = buildWithoutVoenFromLegal();
  if (withoutFromLegal) {
    const lines = [
      HEADER.join(","),
      ...withoutFromLegal.map((r) => HEADER.map((h) => csvEscape(r[h])).join(",")),
    ];
    fs.writeFileSync(WITHOUT_VOEN_CSV, `${lines.join("\n")}\n`, "utf8");
    withoutVoenCount = withoutFromLegal.length;
    console.log("Rebuilt without-voen from legal-entities.csv");
  } else if (fs.existsSync(WITHOUT_VOEN_CSV)) {
    withoutVoenCount = Math.max(0, fs.readFileSync(WITHOUT_VOEN_CSV, "utf8").split("\n").length - 2);
    console.log("Kept existing without-voen file");
  }

  const outStats = {
    ...stats,
    with_voen: withVoen.length,
    with_donor_ids: withVoen.filter((r) => r.donor_ids).length,
    without_voen: withoutVoenCount,
    finished_at: new Date().toISOString(),
  };
  fs.writeFileSync(STATS_FILE, JSON.stringify(outStats, null, 2), "utf8");
  console.log("Wrote", WITH_VOEN_CSV);
  console.log(JSON.stringify(outStats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
