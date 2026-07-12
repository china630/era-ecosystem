/**
 * Run prioritized trigram / substring sweep against DVX e-taxes (cached).
 *
 * Plan: npm run plan:etaxes-trigrams  (or auto-build on start)
 * API hard cap: 50 taxpayers per query — saturated queries flagged for 4-gram refine.
 *
 * Usage:
 *   node tools/enrich-etaxes-trigram-sweep.mjs
 *   node tools/enrich-etaxes-trigram-sweep.mjs --limit 50
 *   node tools/enrich-etaxes-trigram-sweep.mjs --plan-only
 *   node tools/enrich-etaxes-trigram-sweep.mjs --rebuild
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { flattenTaxpayer } from "./etaxes-flatten.mjs";
import { cacheFileSlug } from "./etaxes-search-utils.mjs";
import { buildTrigramPlan, loadMasterVoens } from "./etaxes-trigram-plan.mjs";
import {
  launchBrowser,
  refreshEtaxesPage,
  searchLegalEntities,
} from "./etaxes-playwright-search.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "legal-entities");
const CACHE_DIR = path.join(OUT_DIR, ".cache", "etaxes-search");
const PLAN_FILE = path.join(OUT_DIR, ".trigram-sweep-plan.json");
const CHECKPOINT_FILE = path.join(OUT_DIR, ".trigram-sweep-checkpoint.json");
const STATS_FILE = path.join(OUT_DIR, ".trigram-sweep-stats.json");
const LOCK_FILE = path.join(OUT_DIR, ".trigram-sweep.lock");
const MASTER_CSV = path.join(OUT_DIR, "azerbaijan-companies-with-voen.csv");

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;
const phaseIdx = args.indexOf("--phase");
const PHASE = phaseIdx >= 0 ? args[phaseIdx + 1] : "all";
const PLAN_ONLY = args.includes("--plan-only");
const REBUILD = args.includes("--rebuild");
const HEADFUL = args.includes("--headful");
const FORCE = args.includes("--force");
const MIN_DELAY_MS = Number(process.env.ETAXES_DELAY_MS ?? 2500);
const MAX_DELAY_MS = Number(process.env.ETAXES_MAX_DELAY_MS ?? 4500);
const CHECKPOINT_EVERY = 10;
const REFRESH_EVERY = 200;
const REBUILD_MASTER_EVERY = 500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randDelay = () =>
  sleep(MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)));

function isAzVoen(v) {
  return /^\d{10}$/.test(String(v ?? "").trim());
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
      const ageMs = Date.now() - new Date(lock.startedAt).getTime();
      if (isPidAlive(lock.pid)) {
        console.log(`Trigram sweep already running (pid ${lock.pid}). Exit.`);
        process.exit(0);
      }
      if (ageMs < 6 * 60 * 60 * 1000) {
        console.log(`Removing stale lock (pid ${lock.pid} not running).`);
      }
    } catch {
      /* stale lock file */
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

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), "utf8");
}

function saveStats(stats) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf8");
}

function rebuildMaster() {
  console.log("Rebuilding master CSV from cache...");
  const r = spawnSync(process.execPath, ["tools/build-azerbaijan-companies-master.mjs"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  return r.status === 0;
}

async function loadKnownVoensSynced(checkpointStats) {
  let knownVoens = await loadMasterVoens();
  const target = checkpointStats?.known_voen_now ?? 0;
  if (target > knownVoens.size + 50) {
    console.log(
      `Master CSV has ${knownVoens.size} VÖEN; checkpoint expects ~${target} — rebuilding master...`,
    );
    if (rebuildMaster()) {
      knownVoens = await loadMasterVoens();
      console.log(`Master synced: ${knownVoens.size} VÖEN`);
    }
  }
  return knownVoens;
}

function syncKnownDisplay(stats) {
  const base = stats.known_voen_wave_start ?? stats.known_voen_at_start ?? 0;
  stats.known_voen_now = base + (stats.new_voen ?? 0);
}

async function main() {
  console.log("Building trigram plan...");
  const plan = await buildTrigramPlan({ phase: PHASE });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(PLAN_FILE, JSON.stringify(plan, null, 2), "utf8");
  console.log(
    `Plan: ${plan.total_queries} queries (${plan.not_in_cache} not in cache), saturated 3-char in cache: ${plan.saturated_3char_queries}`,
  );

  if (PLAN_ONLY) {
    console.log("Plan-only mode. Wrote", PLAN_FILE);
    return;
  }

  let checkpoint = null;
  if (fs.existsSync(CHECKPOINT_FILE) && !FORCE) {
    checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8"));
  }

  const knownVoens = await loadKnownVoensSynced(checkpoint?.stats);
  console.log(`Known VÖEN in master: ${knownVoens.size}`);

  let startIndex = 0;
  const stats = {
    started_at: new Date().toISOString(),
    api_result_cap: 50,
    known_voen_wave_start: knownVoens.size,
    known_voen_at_start: knownVoens.size,
    processed: 0,
    cache_skipped: 0,
    api_calls: 0,
    errors: 0,
    hits_total: 0,
    new_voen: 0,
    saturated_queries: 0,
    last_query: null,
  };

  if (checkpoint && !checkpoint.complete && checkpoint.stats) {
    Object.assign(stats, checkpoint.stats);
    stats.known_voen_wave_start =
      checkpoint.stats.known_voen_wave_start ??
      (checkpoint.stats.known_voen_at_start < 110000
        ? checkpoint.stats.known_voen_at_start
        : knownVoens.size);
    stats.new_voen = Math.max(0, knownVoens.size - stats.known_voen_wave_start);
    syncKnownDisplay(stats);

    const samePlan = checkpoint.plan_generated_at === plan.generated_at;
    const cpIndex = checkpoint.index ?? 0;
    if (samePlan && cpIndex < plan.total_queries) {
      startIndex = cpIndex;
    } else {
      // Plan rebuilt (cache changed): re-run remaining uncached queries from start.
      startIndex = 0;
      console.log(
        `Plan changed or checkpoint past end (${cpIndex}/${plan.total_queries}) — scanning remaining uncached queries`,
      );
    }
    stats.processed = startIndex;
    console.log(
      `Resume from index ${startIndex} | cumulative new_voen=${stats.new_voen} | known~${stats.known_voen_now}`,
    );
  }

  const queue = plan.queries.slice(startIndex);
  const toRun = LIMIT > 0 ? queue.slice(0, LIMIT) : queue;
  if (!toRun.length) {
    console.log("Nothing to run — marking complete and rebuilding master.");
    stats.finished_at = new Date().toISOString();
    syncKnownDisplay(stats);
    saveStats({ ...stats, updated_at: stats.finished_at });
    saveCheckpoint({
      index: plan.total_queries,
      plan_generated_at: plan.generated_at,
      complete: true,
      stats,
    });
    rebuildMaster();
    return;
  }

  acquireLock();
  const { browser, page } = await launchBrowser(HEADFUL);
  let apiSinceRefresh = 0;
  let newVoenSinceRebuild = 0;

  try {
    for (let i = 0; i < toRun.length; i++) {
      const globalIndex = startIndex + i;
      const { q, source, freq } = toRun[i];
      const cacheFile = path.join(CACHE_DIR, `name_${cacheFileSlug(q)}.json`);

      if (fs.existsSync(cacheFile) && !FORCE) {
        stats.cache_skipped++;
        stats.processed = globalIndex + 1;
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
        stats.processed = globalIndex + 1;
        console.log(`[${globalIndex + 1}/${plan.total_queries}] ${q} ERROR ${err.message}`);
        await randDelay();
        continue;
      }

      apiSinceRefresh++;
      stats.api_calls++;
      stats.processed = globalIndex + 1;
      stats.last_query = q;

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
          newVoenSinceRebuild++;
        }
      }

      syncKnownDisplay(stats);

      console.log(
        `[${globalIndex + 1}/${plan.total_queries}] ${q} (${source}${freq ? ` f=${freq}` : ""}) → ${taxpayers.length} hit(s), +${newInQuery} new VÖEN${result.error ? ` [${result.error}]` : ""}${taxpayers.length >= 50 ? " [CAP50]" : ""}`,
      );

      if ((globalIndex + 1) % CHECKPOINT_EVERY === 0) {
        saveCheckpoint({
          index: globalIndex + 1,
          plan_generated_at: plan.generated_at,
          stats: { ...stats },
        });
        saveStats({ ...stats, updated_at: new Date().toISOString() });
      }

      if (newVoenSinceRebuild >= REBUILD_MASTER_EVERY) {
        rebuildMaster();
        const refreshed = await loadMasterVoens();
        for (const v of refreshed) knownVoens.add(v);
        newVoenSinceRebuild = 0;
        syncKnownDisplay(stats);
      }

      await randDelay();
    }
  } finally {
    await browser.close();
    releaseLock();
  }

  stats.finished_at = new Date().toISOString();
  syncKnownDisplay(stats);
  saveStats({ ...stats, updated_at: stats.finished_at });
  saveCheckpoint({
    index: startIndex + toRun.length,
    plan_generated_at: plan.generated_at,
    complete: startIndex + toRun.length >= plan.total_queries,
    stats,
  });

  console.log("\nDone:", JSON.stringify(stats, null, 2));

  if (REBUILD || stats.new_voen > 0) {
    rebuildMaster();
  }
}

main().catch((e) => {
  console.error(e);
  releaseLock();
  process.exit(1);
});
