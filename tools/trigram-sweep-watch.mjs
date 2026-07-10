/**
 * Watch trigram e-taxes sweep progress (checkpoint + stats + lock).
 *
 * Usage:
 *   node tools/trigram-sweep-watch.mjs
 *   node tools/trigram-sweep-watch.mjs --interval 60
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "legal-entities");
const PLAN_FILE = path.join(OUT_DIR, ".trigram-sweep-plan.json");
const CHECKPOINT_FILE = path.join(OUT_DIR, ".trigram-sweep-checkpoint.json");
const STATS_FILE = path.join(OUT_DIR, ".trigram-sweep-stats.json");
const LOCK_FILE = path.join(OUT_DIR, ".trigram-sweep.lock");
const LOG_FILE = path.join(OUT_DIR, ".trigram-sweep-watch.log");
const MASTER_STATS = path.join(OUT_DIR, ".companies-master-stats.json");

const args = process.argv.slice(2);
const intervalIdx = args.indexOf("--interval");
const INTERVAL_MS = (intervalIdx >= 0 ? Number(args[intervalIdx + 1]) : 60) * 1000;
const STALE_MS = 30 * 60 * 1000;

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function log(line) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const msg = `[${ts}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG_FILE, `${msg}\n`, "utf8");
}

function formatEta(done, total, startedAt) {
  if (!startedAt || done <= 0 || total <= done) return "—";
  const elapsed = Date.now() - new Date(startedAt).getTime();
  const perItem = elapsed / done;
  const remaining = (total - done) * perItem;
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return `~${h}h ${m}m`;
}

function sweepStatus() {
  const plan = readJson(PLAN_FILE);
  const cp = readJson(CHECKPOINT_FILE);
  const statsFile = readJson(STATS_FILE);
  const lock = readJson(LOCK_FILE);
  const master = readJson(MASTER_STATS);

  // Checkpoint stats are cumulative; stats file may lag one tick behind.
  const stats = cp?.stats ?? statsFile ?? {};

  const total = plan?.total_queries ?? 0;
  const index = cp?.index ?? stats?.processed ?? 0;
  const pct = total > 0 ? ((index / total) * 100).toFixed(2) : "0.00";

  const waveStart = stats.known_voen_wave_start ?? stats.known_voen_at_start;
  const knownNow =
    stats.known_voen_now ??
    (waveStart != null && stats.new_voen != null ? waveStart + stats.new_voen : null);

  let running = false;
  let stale = false;
  if (lock?.startedAt) {
    try {
      process.kill(lock.pid, 0);
      running = true;
    } catch {
      running = false;
    }
    const lastActivity = statsFile?.updated_at ?? lock.startedAt;
    const idle = Date.now() - new Date(lastActivity).getTime();
    if (running && idle > STALE_MS) stale = true;
  }

  return {
    total,
    index,
    pct,
    running,
    stale,
    complete: cp?.complete === true,
    stats,
    knownNow,
    lock,
    master,
    lastQuery: stats?.last_query ?? "—",
    waveStart,
  };
}

let rebuiltOnComplete = false;

function maybeRebuild() {
  log("Sweep complete — rebuilding master CSV...");
  const r = spawnSync(process.execPath, ["tools/build-azerbaijan-companies-master.mjs"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status === 0) log("Master rebuild OK.");
  else log(`Master rebuild failed (exit ${r.status ?? 1}).`);
}

function tick() {
  const s = sweepStatus();
  const st = s.stats ?? {};
  const line = [
    `progress ${s.index}/${s.total} (${s.pct}%)`,
    `running=${s.running ? (s.stale ? "STALE" : "yes") : "no"}`,
    `api=${st.api_calls ?? 0}`,
    `new_voen=${st.new_voen ?? 0}`,
    `known=${s.knownNow ?? "?"}`,
    `cap50=${st.saturated_queries ?? 0}`,
    `errors=${st.errors ?? 0}`,
    `last=${s.lastQuery}`,
    `eta=${formatEta(s.index, s.total, st.started_at)}`,
  ].join(" | ");
  log(line);

  const masterRows = readJson(MASTER_STATS);
  if (masterRows?.with_voen) {
    const lag =
      s.knownNow != null && masterRows.with_voen < s.knownNow - 100
        ? ` (master CSV lags; rebuild pending)`
        : "";
    log(
      `master CSV: ${masterRows.with_voen} VÖEN (${masterRows.with_donor_ids ?? "?"} with donors)${lag}`,
    );
  }

  if (s.stale) {
    log("WARNING: lock present but no activity 30m — sweep may be stuck. Check sweep CMD window.");
  }

  if (s.complete && !rebuiltOnComplete) {
    rebuiltOnComplete = true;
    maybeRebuild();
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
log(`Watcher started (interval ${INTERVAL_MS / 1000}s). Log: ${LOG_FILE}`);
tick();
setInterval(tick, INTERVAL_MS);
