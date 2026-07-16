/**
 * Purge and re-fetch e-taxes cache entries with transient errors (timeout / 5xx / 429).
 *
 * Usage:
 *   node tools/retry-etaxes-transient-errors.mjs              # dry-run report
 *   node tools/retry-etaxes-transient-errors.mjs --run        # purge + re-fetch
 *   node tools/retry-etaxes-transient-errors.mjs --run --limit 20
 */

import fs from "node:fs";
import path from "node:path";
import { flattenTaxpayer } from "./etaxes-flatten.mjs";
import { cacheFileSlug } from "./etaxes-search-utils.mjs";
import {
  launchBrowser,
  refreshEtaxesPage,
  searchLegalEntities,
} from "./etaxes-playwright-search.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "legal-entities");
const CACHE_DIR = path.join(OUT_DIR, ".cache", "etaxes-search");
const MASTER_CSV = path.join(OUT_DIR, "azerbaijan-companies-with-voen.csv");

const args = process.argv.slice(2);
const RUN = args.includes("--run");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;

const MIN_DELAY_MS = 800;
const MAX_DELAY_MS = 1800;
const REFRESH_EVERY = 40;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randDelay = () =>
  sleep(MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)));

function isAzVoen(v) {
  return /^\d{10}$/.test(String(v ?? "").trim());
}

function isRetryableError(error) {
  const e = String(error ?? "");
  if (/ETAXES_TIMEOUT/i.test(e)) return "timeout";
  if (/HTTP 5\d\d/.test(e)) return "http_5xx";
  if (/HTTP 429/.test(e)) return "http_429";
  return null;
}

function loadMasterVoens() {
  const set = new Set();
  if (!fs.existsSync(MASTER_CSV)) return set;
  const text = fs.readFileSync(MASTER_CSV, "utf8");
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return set;
  const headers = lines[0].split(",");
  const voenIdx = headers.indexOf("voen");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // Fast path: voen is early column; handle quotes lightly
    const cols = [];
    let cur = "";
    let inQ = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        if (inQ && line[j + 1] === '"') {
          cur += '"';
          j++;
        } else inQ = !inQ;
      } else if (c === "," && !inQ) {
        cols.push(cur);
        cur = "";
      } else cur += c;
    }
    cols.push(cur);
    const voen = String(cols[voenIdx] ?? "").replace(/\D/g, "").slice(0, 10);
    if (isAzVoen(voen)) set.add(voen);
  }
  return set;
}

function collectRetryable() {
  const out = [];
  for (const file of fs.readdirSync(CACHE_DIR)) {
    if (!file.startsWith("name_") || !file.endsWith(".json")) continue;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), "utf8"));
    } catch {
      continue;
    }
    const kind = isRetryableError(data.error);
    if (!kind) continue;
    const query = data.query || file.slice(5, -5).replace(/_/g, " ");
    out.push({ file, query, kind, error: data.error });
  }
  out.sort((a, b) => a.query.localeCompare(b.query, "az"));
  return out;
}

async function main() {
  let items = collectRetryable();
  console.log(`Retryable transient errors: ${items.length}`);
  const byKind = {};
  for (const it of items) byKind[it.kind] = (byKind[it.kind] || 0) + 1;
  console.log("By kind:", byKind);

  if (!RUN) {
    console.log("\nDry-run only. Re-run with --run to purge + re-fetch.");
    for (const it of items.slice(0, 10)) {
      console.log(`  [${it.kind}] ${it.query} → ${it.error}`);
    }
    if (items.length > 10) console.log(`  … +${items.length - 10} more`);
    return;
  }

  if (LIMIT > 0) items = items.slice(0, LIMIT);

  const known = loadMasterVoens();
  console.log(`Master VÖEN before: ${known.size}`);
  console.log(`Re-fetching ${items.length} queries…\n`);

  for (const it of items) {
    const full = path.join(CACHE_DIR, it.file);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }

  const { browser, page } = await launchBrowser(false);
  let apiSinceRefresh = 0;
  const stats = {
    attempted: 0,
    ok: 0,
    still_error: 0,
    hits_total: 0,
    new_voen: 0,
    new_voens: [],
    errors_again: [],
  };

  try {
    for (let i = 0; i < items.length; i++) {
      const { query, kind } = items[i];
      if (apiSinceRefresh >= REFRESH_EVERY) {
        console.log("Refreshing browser session…");
        await refreshEtaxesPage(page);
        apiSinceRefresh = 0;
      }

      stats.attempted++;
      let result;
      try {
        result = await searchLegalEntities(page, query, CACHE_DIR);
      } catch (err) {
        stats.still_error++;
        stats.errors_again.push({ query, error: err.message });
        console.log(`[${i + 1}/${items.length}] ${query} (${kind}) → EXCEPTION ${err.message}`);
        await randDelay();
        continue;
      }

      apiSinceRefresh++;
      const taxpayers = result.taxpayers ?? [];
      if (result.error) {
        stats.still_error++;
        stats.errors_again.push({ query, error: result.error });
        console.log(`[${i + 1}/${items.length}] ${query} (${kind}) → still ${result.error}`);
      } else {
        stats.ok++;
        stats.hits_total += taxpayers.length;
        let newInQuery = 0;
        for (const tp of taxpayers) {
          const flat = flattenTaxpayer(tp, query);
          const voen = String(flat.voen ?? "").trim();
          if (!isAzVoen(voen)) continue;
          if (!known.has(voen)) {
            known.add(voen);
            stats.new_voen++;
            newInQuery++;
            if (stats.new_voens.length < 30) {
              stats.new_voens.push({ voen, name: flat.tax_name || flat.name || "" });
            }
          }
        }
        console.log(
          `[${i + 1}/${items.length}] ${query} (${kind}) → ${taxpayers.length} hit(s), +${newInQuery} new VÖEN`,
        );
      }
      await randDelay();
    }
  } finally {
    await browser.close();
  }

  console.log("\n=== Done ===");
  console.log(
    JSON.stringify(
      {
        attempted: stats.attempted,
        ok: stats.ok,
        still_error: stats.still_error,
        hits_total: stats.hits_total,
        new_voen: stats.new_voen,
        sample_new: stats.new_voens,
        still_error_sample: stats.errors_again.slice(0, 10),
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(OUT_DIR, ".transient-retry-stats.json"),
    JSON.stringify({ ...stats, finished_at: new Date().toISOString() }, null, 2),
    "utf8",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
