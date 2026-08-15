/**
 * Query DVX e-taxes with top token-seed hypotheses; merge new VÖEN into companies master.
 *
 * Strong seeds (hospitality / travel / logistics). Skips noisy short tokens (exp, eksp).
 *
 * Usage:
 *   node tools/enrich-etaxes-token-seeds.mjs
 *   node tools/enrich-etaxes-token-seeds.mjs --limit 5
 *   node tools/enrich-etaxes-token-seeds.mjs --tokens hotel,travel,cargo
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { flattenTaxpayer } from "./etaxes-flatten.mjs";
import { cacheFileSlug } from "./etaxes-search-utils.mjs";
import { loadMasterVoens } from "./etaxes-trigram-plan.mjs";
import {
  launchBrowser,
  refreshEtaxesPage,
  searchLegalEntities,
} from "./etaxes-playwright-search.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "legal-entities");
const CACHE_DIR = path.join(OUT_DIR, ".cache", "etaxes-search");
const STATS_FILE = path.join(OUT_DIR, ".token-seeds-stats.json");
const CHECKPOINT_FILE = path.join(OUT_DIR, ".token-seeds-checkpoint.json");
const LOCK_FILE = path.join(OUT_DIR, ".token-seeds.lock");

/** Ranked seeds from token-hypothesis analysis (skip exp/eksp noise). */
export const DEFAULT_TOKEN_SEEDS = [
  "travel",
  "turizm",
  "hotel",
  "transport",
  "cargo",
  "trans",
  "express",
  "hostel",
  "resort",
  "broker",
  "otel",
  "tour",
  "logistik",
  "logistic",
  "freight",
  "shipping",
  "transit",
  "forward",
  "palace",
  "sanatoriya",
  "avia",
  "marina",
  "spa",
  "airline",
];

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;
const tokensIdx = args.indexOf("--tokens");
const FORCE = args.includes("--force");
const HEADFUL = args.includes("--headful");
const REBUILD = args.includes("--rebuild") || !args.includes("--no-rebuild");
const MIN_DELAY_MS = Number(process.env.ETAXES_DELAY_MS ?? 2500);
const MAX_DELAY_MS = Number(process.env.ETAXES_MAX_DELAY_MS ?? 4500);
const REFRESH_EVERY = 40;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randDelay = () =>
  sleep(MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)));

function isAzVoen(v) {
  return /^\d{10}$/.test(String(v ?? "").trim());
}

function resolveSeeds() {
  if (tokensIdx >= 0 && args[tokensIdx + 1]) {
    return args[tokensIdx + 1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [...DEFAULT_TOKEN_SEEDS];
}

function isPidAlive(pid) {
  if (!pid || pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
      if (isPidAlive(lock.pid)) {
        console.log(`Token-seed enrich already running (pid ${lock.pid}). Exit.`);
        process.exit(0);
      }
    } catch {
      /* stale */
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    LOCK_FILE,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    "utf8",
  );
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    /* ignore */
  }
}

function rebuildMaster() {
  console.log("Rebuilding master CSV (base + cache)...");
  const r = spawnSync(process.execPath, ["tools/build-azerbaijan-companies-master.mjs"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  return r.status === 0;
}

async function main() {
  let seeds = resolveSeeds();
  if (LIMIT > 0) seeds = seeds.slice(0, LIMIT);

  let startIndex = 0;
  if (fs.existsSync(CHECKPOINT_FILE) && !FORCE) {
    const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8"));
    if (Array.isArray(cp.seeds) && cp.seeds.join("|") === seeds.join("|") && !cp.complete) {
      startIndex = cp.index ?? 0;
      console.log(`Resume from index ${startIndex}`);
    }
  }

  const knownVoens = await loadMasterVoens();
  console.log(`Known VÖEN in master: ${knownVoens.size}`);
  console.log(`Seeds (${seeds.length}): ${seeds.join(", ")}`);

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  acquireLock();

  const stats = {
    started_at: new Date().toISOString(),
    seeds,
    known_voen_at_start: knownVoens.size,
    processed: startIndex,
    cache_skipped: 0,
    api_calls: 0,
    errors: 0,
    hits_total: 0,
    new_voen: 0,
    saturated_queries: 0,
    per_token: {},
  };

  const { browser, page } = await launchBrowser(HEADFUL);
  let apiSinceRefresh = 0;

  try {
    for (let i = startIndex; i < seeds.length; i++) {
      const q = seeds[i];
      const cacheFile = path.join(CACHE_DIR, `name_${cacheFileSlug(q)}.json`);

      if (fs.existsSync(cacheFile) && !FORCE) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
        const taxpayers = cached.taxpayers ?? [];
        let newInQuery = 0;
        for (const tp of taxpayers) {
          const flat = flattenTaxpayer(tp, q);
          const voen = String(flat.voen ?? "").trim();
          if (!isAzVoen(voen)) continue;
          if (!knownVoens.has(voen)) {
            knownVoens.add(voen);
            stats.new_voen++;
            newInQuery++;
          }
        }
        stats.cache_skipped++;
        stats.hits_total += taxpayers.length;
        if (taxpayers.length >= 50) stats.saturated_queries++;
        stats.per_token[q] = {
          source: "cache",
          hits: taxpayers.length,
          new_voen: newInQuery,
          error: cached.error ?? null,
        };
        stats.processed = i + 1;
        console.log(
          `[${i + 1}/${seeds.length}] ${q} (cache) → ${taxpayers.length} hit(s), +${newInQuery} new`,
        );
        fs.writeFileSync(
          CHECKPOINT_FILE,
          JSON.stringify({ index: i + 1, seeds, complete: false, stats }, null, 2),
          "utf8",
        );
        continue;
      }

      if (apiSinceRefresh >= REFRESH_EVERY) {
        console.log("Refreshing browser session...");
        await refreshEtaxesPage(page);
        apiSinceRefresh = 0;
      }

      let result;
      try {
        result = await searchLegalEntities(page, q, CACHE_DIR);
      } catch (err) {
        stats.errors++;
        stats.processed = i + 1;
        stats.per_token[q] = { source: "api", error: err.message };
        console.log(`[${i + 1}/${seeds.length}] ${q} ERROR ${err.message}`);
        await randDelay();
        continue;
      }

      apiSinceRefresh++;
      stats.api_calls++;
      stats.processed = i + 1;

      const taxpayers = result.taxpayers ?? [];
      if (result.error) stats.errors++;
      stats.hits_total += taxpayers.length;
      if (taxpayers.length >= 50) stats.saturated_queries++;

      let newInQuery = 0;
      for (const tp of taxpayers) {
        const flat = flattenTaxpayer(tp, q);
        const voen = String(flat.voen ?? "").trim();
        if (!isAzVoen(voen)) continue;
        if (!knownVoens.has(voen)) {
          knownVoens.add(voen);
          stats.new_voen++;
          newInQuery++;
        }
      }

      stats.per_token[q] = {
        source: "api",
        hits: taxpayers.length,
        new_voen: newInQuery,
        error: result.error ?? null,
        capped: taxpayers.length >= 50,
      };

      const errTag = result.error ? ` [${result.error}]` : "";
      const capTag = taxpayers.length >= 50 ? " [CAP50]" : "";
      console.log(
        `[${i + 1}/${seeds.length}] ${q} → ${taxpayers.length} hit(s), +${newInQuery} new VÖEN${errTag}${capTag}`,
      );

      fs.writeFileSync(
        CHECKPOINT_FILE,
        JSON.stringify({ index: i + 1, seeds, complete: false, stats }, null, 2),
        "utf8",
      );
      await randDelay();
    }
  } finally {
    await browser.close();
    releaseLock();
  }

  stats.finished_at = new Date().toISOString();
  stats.known_voen_now = knownVoens.size;
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf8");
  fs.writeFileSync(
    CHECKPOINT_FILE,
    JSON.stringify({ index: seeds.length, seeds, complete: true, stats }, null, 2),
    "utf8",
  );

  console.log("\nDone:", JSON.stringify({ ...stats, per_token: undefined }, null, 2));
  console.log("Per-token:", JSON.stringify(stats.per_token, null, 2));

  if (REBUILD && (stats.new_voen > 0 || stats.api_calls > 0 || stats.cache_skipped > 0)) {
    rebuildMaster();
  }
}

main().catch((e) => {
  console.error(e);
  releaseLock();
  process.exit(1);
});
