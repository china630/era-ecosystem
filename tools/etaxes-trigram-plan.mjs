/**
 * Build prioritized e-taxes substring search plan (3-gram + 4-gram + alphabet).
 *
 * DVX name search matches substring anywhere in company title (not prefix-only).
 * API returns at most 50 taxpayers per query — no pagination.
 *
 * Usage:
 *   node tools/etaxes-trigram-plan.mjs
 *   node tools/etaxes-trigram-plan.mjs --phase alphabet
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";
import { normToken, extractTradeName, LEGAL_SUFFIX_RE, cleanForSearch } from "./etaxes-search-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "legal-entities");
const CACHE_DIR = path.join(OUT_DIR, ".cache", "etaxes-search");
const MASTER_CSV = path.join(OUT_DIR, "azerbaijan-companies-with-voen.csv");
const PLAN_FILE = path.join(OUT_DIR, ".trigram-sweep-plan.json");

/** Official AZ Latin minus rare loan letters (30). */
export const AZ_ALPHABET = "abcçdeəğhxıikqlmnoöprsştuüvyz";

/** Deprioritize noisy suffix / legal-form trigrams. */
const LOW_PRIORITY = new Set(
  [
    "mmc", "mme", "ltd", "llc", "qsc", "muk", "iyy", "yye", "emi", "miy", "eti",
    "mue", "iyy", "eti", "iyyeti", "iyye", "yyet", "yet", "mem", "esm", "sul",
    "ulu", "lui", "iiy", "yeti", "iyet",
  ].map(normToken),
);

function cleanNameForNgrams(name) {
  let n = extractTradeName(name) || cleanForSearch(name);
  n = n.replace(LEGAL_SUFFIX_RE, " ");
  n = n.replace(/\b(qsc|mmc|ltd|llc|asc|q\s*k|s\s*h)\b/gi, " ");
  return n.replace(/\s+/g, " ").trim();
}

const API_RESULT_CAP = 50;

export function foldQuery(q) {
  return normToken(String(q ?? "").trim());
}

export function lettersOnly(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9əıöüçşğ]/gi, "");
}

export function extractNGrams(text, n = 3) {
  const s = lettersOnly(text);
  if (s.length < n) return [];
  const out = [];
  for (let i = 0; i <= s.length - n; i++) out.push(foldQuery(s.slice(i, i + n)));
  return out;
}

function parseHeaderLine(line) {
  let i = 0;
  const headers = [];
  const readField = () => {
    let field = "";
    if (line[i] === '"') {
      i++;
      while (i < line.length) {
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
    while (i < line.length && line[i] !== ",") field += line[i++];
    if (line[i] === ",") i++;
    return field;
  };
  while (i < line.length) headers.push(readField());
  return headers;
}

function parseDataRow(headers, line) {
  let i = 0;
  const readField = () => {
    let field = "";
    if (line[i] === '"') {
      i++;
      while (i < line.length) {
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
    while (i < line.length && line[i] !== ",") field += line[i++];
    if (line[i] === ",") i++;
    return field;
  };
  const row = {};
  for (const h of headers) row[h] = i < line.length ? readField() : "";
  return row;
}

export function loadCacheIndex() {
  const cached = new Set();
  const saturated = new Set();
  if (!fs.existsSync(CACHE_DIR)) return { cached, saturated };

  for (const file of fs.readdirSync(CACHE_DIR)) {
    if (!file.startsWith("name_") || !file.endsWith(".json")) continue;
    const key = file.slice(5, -5).replace(/_/g, "");
    cached.add(key);
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), "utf8"));
      const q = foldQuery(data.query ?? key);
      const hits = (data.taxpayers ?? []).length;
      if (hits >= API_RESULT_CAP && q.length === 3) saturated.add(q);
    } catch {
      /* ignore */
    }
  }
  return { cached, saturated };
}

export async function loadMasterVoens() {
  const voens = new Set();
  if (!fs.existsSync(MASTER_CSV)) return voens;
  const rl = readline.createInterface({
    input: fs.createReadStream(MASTER_CSV, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let headers = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseHeaderLine(line);
      continue;
    }
    const row = parseDataRow(headers, line);
    const v = String(row.voen ?? "").trim();
    if (/^\d{10}$/.test(v)) voens.add(v);
  }
  return voens;
}

async function streamMasterNames(onName) {
  if (!fs.existsSync(MASTER_CSV)) return 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(MASTER_CSV, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let headers = null;
  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseHeaderLine(line);
      continue;
    }
    const row = parseDataRow(headers, line);
    const name = row.tax_name?.trim();
    if (name) {
      onName(name);
      count++;
    }
  }
  return count;
}

function addQuery(map, q, source, priority) {
  const key = foldQuery(q);
  if (key.length < 3 || !/[a-z]/.test(key)) return;
  const existing = map.get(key);
  if (!existing || priority < existing.priority) {
    map.set(key, { q: key, source, priority, freq: existing?.freq ?? 0 });
  }
}

function bumpFreq(map, q, n = 1) {
  const key = foldQuery(q);
  const row = map.get(key);
  if (row) row.freq += n;
}

function buildAlphabetQueries(cached) {
  const map = new Map();
  const letters = [...AZ_ALPHABET];
  for (const a of letters) {
    for (const b of letters) {
      for (const c of letters) {
        const q = foldQuery(a + b + c);
        if (q.length !== 3 || cached.has(q)) continue;
        addQuery(map, q, "alphabet", 3);
      }
    }
  }
  return map;
}

/**
 * @param {{ phase?: 'names'|'alphabet'|'all', includeCached?: boolean }} opts
 */
export async function buildTrigramPlan(opts = {}) {
  const phase = opts.phase ?? "all";
  const includeCached = opts.includeCached ?? false;
  const { cached, saturated } = loadCacheIndex();

  const queryMap = new Map();
  let masterRows = 0;

  if (phase === "names" || phase === "all") {
    const trigramFreq = new Map();
    const namesByTrigram = new Map();

    masterRows = await streamMasterNames((name) => {
      const cleaned = cleanNameForNgrams(name);
      if (cleaned.length < 3) return;
      const foldedName = lettersOnly(cleaned);
      for (const tri of extractNGrams(cleaned, 3)) {
        if (LOW_PRIORITY.has(tri)) continue;
        trigramFreq.set(tri, (trigramFreq.get(tri) ?? 0) + 1);
        if (!namesByTrigram.has(tri)) namesByTrigram.set(tri, []);
        if (namesByTrigram.get(tri).length < 20) namesByTrigram.get(tri).push(foldedName);
      }
    });

    for (const [tri, freq] of trigramFreq) {
      if (!includeCached && cached.has(tri)) continue;
      addQuery(queryMap, tri, "name_trigram", 1);
      bumpFreq(queryMap, tri, freq);
    }

    for (const tri of saturated) {
      const names = namesByTrigram.get(tri) ?? [];
      for (const name of names) {
        const idx = name.indexOf(tri);
        if (idx < 0) continue;
        for (let start = Math.max(0, idx - 1); start <= idx + 1; start++) {
          if (start + 4 > name.length) continue;
          const quad = foldQuery(name.slice(start, start + 4));
          if (quad.length !== 4 || (!includeCached && cached.has(quad))) continue;
          addQuery(queryMap, quad, "saturated_refine", 2);
        }
      }
    }
  }

  if (phase === "alphabet" || phase === "all") {
    for (const [, row] of buildAlphabetQueries(cached)) {
      if (!includeCached && cached.has(row.q)) continue;
      addQuery(queryMap, row.q, row.source, row.priority);
    }
  }

  const queries = [...queryMap.values()].sort((a, b) => {
    const pa = LOW_PRIORITY.has(a.q) ? 9 : a.priority;
    const pb = LOW_PRIORITY.has(b.q) ? 9 : b.priority;
    if (pa !== pb) return pa - pb;
    if (b.freq !== a.freq) return b.freq - a.freq;
    return a.q.localeCompare(b.q);
  });

  const plan = {
    generated_at: new Date().toISOString(),
    phase,
    api_result_cap: API_RESULT_CAP,
    master_rows_scanned: masterRows,
    known_cached_queries: cached.size,
    saturated_3char_queries: saturated.size,
    total_queries: queries.length,
    by_source: Object.fromEntries(
      ["name_trigram", "saturated_refine", "alphabet"].map((s) => [
        s,
        queries.filter((q) => q.source === s).length,
      ]),
    ),
    not_in_cache: queries.filter((q) => !cached.has(q.q)).length,
    queries,
  };

  return plan;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  const phaseIdx = args.indexOf("--phase");
  const phase = phaseIdx >= 0 ? args[phaseIdx + 1] : "all";
  const includeCached = args.includes("--include-cached");

  const plan = await buildTrigramPlan({ phase, includeCached });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), "utf8");
  console.log(JSON.stringify({ ...plan, queries: `[${plan.queries.length} items]` }, null, 2));
  console.log("Wrote", PLAN_FILE);
}
