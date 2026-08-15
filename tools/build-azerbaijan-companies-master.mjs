/**
 * Build master company files from existing master + e-taxes cache merge.
 *
 * Default (safe): append-only — scan cache for new VÖEN and append CSV rows.
 * Never loads the full ~400MB master into memory.
 *
 *   node tools/build-azerbaijan-companies-master.mjs
 *   node tools/build-azerbaijan-companies-master.mjs --full   # memory-heavy; avoid
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
const FULL_REWRITE = process.argv.includes("--full");

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
    while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
      field += text[i++];
    }
    if (text[i] === ",") i++;
    return field;
  };
  while (i < len) {
    if (text[i] === "\r") i++;
    if (text[i] === "\n") {
      i++;
      continue;
    }
    const row = {};
    for (const h of HEADER) {
      if (i >= len || text[i] === "\n" || text[i] === "\r") {
        row[h] = "";
        continue;
      }
      row[h] = readField();
    }
    rows.push(row);
    while (i < len && text[i] !== "\n") i++;
    if (text[i] === "\n") i++;
  }
  return rows;
}

function parseHeaderLine(line) {
  return line.split(",").map((h) => h.trim());
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

function emptyDonorFields() {
  return {
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
  };
}

function rowFromTaxpayer(tp, q) {
  const flat = flattenTaxpayer(tp, q);
  const voen = String(flat.voen ?? "").trim();
  if (!isAzVoen(voen)) return null;
  return {
    match_status: "tax_registry",
    source_queries: q,
    search_query: q,
    ...flat,
    ...emptyDonorFields(),
  };
}

function rowToCsvLine(r) {
  return HEADER.map((h) => {
    if (h === "search_query" && !r.search_query) return csvEscape(r.source_queries ?? "");
    return csvEscape(r[h]);
  }).join(",");
}

async function loadKnownVoensOnly() {
  const voens = new Set();
  if (!fs.existsSync(WITH_VOEN_CSV)) return voens;
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
    const v = String(raw.voen ?? "").trim();
    if (isAzVoen(v)) voens.add(v);
  }
  return voens;
}

function collectNewFromCache(knownVoens, stats) {
  const newByVoen = new Map();
  if (!fs.existsSync(CACHE_DIR)) {
    console.log("  cache dir missing — nothing to append");
    return newByVoen;
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
      const row = rowFromTaxpayer(tp, q);
      if (!row) continue;
      stats.taxpayer_hits++;
      if (knownVoens.has(row.voen) || newByVoen.has(row.voen)) {
        const ex = newByVoen.get(row.voen);
        if (ex && q && ex.source_queries && !String(ex.source_queries).includes(q)) {
          ex.source_queries = `${ex.source_queries} | ${q}`;
          ex.search_query = ex.source_queries;
        }
        continue;
      }
      newByVoen.set(row.voen, row);
    }
  }
  return newByVoen;
}

function ensureTrailingNewline(filePath) {
  const fd = fs.openSync(filePath, "r+");
  try {
    const st = fs.fstatSync(fd);
    if (st.size === 0) return;
    const buf = Buffer.alloc(1);
    fs.readSync(fd, buf, 0, 1, st.size - 1);
    if (buf[0] !== 0x0a) fs.writeSync(fd, "\n", st.size);
  } finally {
    fs.closeSync(fd);
  }
}

async function countCsvDataRows(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let n = 0;
  let header = false;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!header) {
      header = true;
      continue;
    }
    n++;
  }
  return n;
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

async function fullRewrite(stats) {
  console.warn("WARNING: --full loads entire master into memory (may OOM on ~400MB files).");
  const byVoen = new Map();
  if (fs.existsSync(WITH_VOEN_CSV)) {
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
      const voen = String(raw.voen ?? "").trim();
      if (!isAzVoen(voen)) continue;
      byVoen.set(voen, {
        ...raw,
        source_queries: raw.source_queries || raw.search_query || "",
        search_query: raw.search_query || raw.source_queries || "",
      });
    }
  }
  stats.base_voen = byVoen.size;
  const known = new Set(byVoen.keys());
  const neu = collectNewFromCache(known, stats);
  for (const [voen, row] of neu) byVoen.set(voen, row);

  const withVoen = [...byVoen.values()].sort((a, b) =>
    (a.tax_name || a.donor_names || a.voen).localeCompare(b.tax_name || b.donor_names || b.voen, "az"),
  );
  const csvLines = [HEADER.join(","), ...withVoen.map(rowToCsvLine)];
  fs.writeFileSync(WITH_VOEN_CSV, `${csvLines.join("\n")}\n`, "utf8");
  return withVoen.length;
}

async function main() {
  const stats = {
    cache_files: 0,
    cache_errors: 0,
    cache_parse_errors: 0,
    taxpayer_hits: 0,
    base_voen: 0,
    appended: 0,
    mode: FULL_REWRITE ? "full" : "append",
  };

  let withVoenCount = 0;

  if (FULL_REWRITE) {
    withVoenCount = await fullRewrite(stats);
  } else {
    console.log("Append-only merge (existing master + new cache VÖEN)...");
    const known = await loadKnownVoensOnly();
    stats.base_voen = known.size;
    console.log(`  existing VÖEN: ${known.size}`);

    const neu = collectNewFromCache(known, stats);
    console.log(`  new VÖEN from cache: ${neu.size}`);

    if (!fs.existsSync(WITH_VOEN_CSV)) {
      const lines = [HEADER.join(","), ...[...neu.values()].map(rowToCsvLine)];
      fs.writeFileSync(WITH_VOEN_CSV, `${lines.join("\n")}\n`, "utf8");
      stats.appended = neu.size;
    } else if (neu.size > 0) {
      ensureTrailingNewline(WITH_VOEN_CSV);
      const chunk = [...neu.values()].map(rowToCsvLine).join("\n") + "\n";
      fs.appendFileSync(WITH_VOEN_CSV, chunk, "utf8");
      stats.appended = neu.size;
    } else {
      console.log("  nothing to append");
    }
    withVoenCount = known.size + stats.appended;
  }

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
    withoutVoenCount = await countCsvDataRows(WITHOUT_VOEN_CSV);
    console.log("Kept existing without-voen file");
  }

  const outStats = {
    ...stats,
    with_voen: withVoenCount,
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
