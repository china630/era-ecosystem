/**
 * Hourly scrape progress + post-completion pipeline:
 *   merge → retry → export → etender-wave → rebuild expanded CSV
 *
 * Usage:
 *   node tools/pipeline-watch.mjs
 *
 * Env:
 *   PIPELINE_INTERVAL_MS — default 3600000 (1 hour)
 *   CURSOR_TERMINALS_DIR — optional, for enrich / etender-buyers log parsing
 */

import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const LOG_FILE = path.join(DATA, "legal-entities", ".pipeline-watch.log");
const STATE_FILE = path.join(DATA, "legal-entities", ".pipeline-watch-state.json");
const INTERVAL_MS = Number(process.env.PIPELINE_INTERVAL_MS ?? 60 * 60 * 1000);
const EST_BUYER_LIST_PAGES = 893;
const TERMINALS_DIR =
  process.env.CURSOR_TERMINALS_DIR ??
  path.join(process.env.USERPROFILE ?? "", ".cursor", "projects", "d-My-Projects-era-ecosystem", "terminals");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {
      mergeDone: false,
      retryDone: false,
      exportDone: false,
      etenderWaveDone: false,
      expandedRebuildDone: false,
    };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function isEnrichComplete() {
  return fs.existsSync(path.join(DATA, "legal-entities", ".enrich-complete.json"));
}

function isEnrichRunning() {
  return fs.existsSync(path.join(DATA, "legal-entities", ".enrich-running.lock"));
}

function isEtenderSuppliersComplete() {
  return fs.existsSync(path.join(DATA, "government-procurement", ".scrape-stats.json"));
}

function isEtenderWaveComplete() {
  return fs.existsSync(path.join(DATA, "legal-entities", ".etender-etaxes-wave-complete.json"));
}

function isEtenderWaveRunning() {
  const lockPath = path.join(DATA, "legal-entities", ".etender-etaxes-wave.lock");
  if (!fs.existsSync(lockPath)) return false;

  const checkpointPath = path.join(DATA, "legal-entities", ".etender-etaxes-wave-checkpoint.json");
  if (!fs.existsSync(checkpointPath)) return true;

  try {
    const cp = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
    const ageMs = Date.now() - new Date(cp.updated_at).getTime();
    if (ageMs > 30 * 60 * 1000) {
      log(`etender-wave: stalled (checkpoint idle ${Math.round(ageMs / 60000)}m) — clearing lock`);
      clearEtenderWaveStall();
      return false;
    }
  } catch {
    /* keep lock */
  }
  return true;
}

function clearEtenderWaveStall() {
  const lockPath = path.join(DATA, "legal-entities", ".etender-etaxes-wave.lock");
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (lock.pid) {
      try {
        if (process.platform === "win32") {
          execSync(`taskkill /PID ${lock.pid} /T /F`, { stdio: "ignore" });
        } else {
          process.kill(lock.pid, "SIGTERM");
        }
      } catch {
        /* already dead */
      }
    }
  } catch {
    /* ignore */
  }
  try {
    fs.unlinkSync(lockPath);
  } catch {
    /* ignore */
  }
}

function etenderWaveStatusLabel() {
  if (isEtenderWaveComplete()) return "complete";
  if (isEtenderWaveRunning()) return "running";
  return "pending";
}

function isEtenderBuyersCheckpoint() {
  return fs.existsSync(path.join(DATA, "government-procurement", ".etender-buyers-checkpoint.json"));
}

function isEtenderBuyersProcessRunning() {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        'wmic process where "name=\'node.exe\'" get commandline /format:list',
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
      );
      return out.includes("scrape_etender_buyers.mjs");
    }
    const out = execSync("ps aux", { encoding: "utf8" });
    return out.includes("scrape_etender_buyers.mjs");
  } catch {
    return false;
  }
}

function isEtenderBuyersTerminalActive() {
  if (!fs.existsSync(TERMINALS_DIR)) return false;
  for (const name of fs.readdirSync(TERMINALS_DIR)) {
    if (!name.endsWith(".txt")) continue;
    const text = fs.readFileSync(path.join(TERMINALS_DIR, name), "utf8");
    if (!text.includes("scrape_etender_buyers.mjs")) continue;
    if (!text.includes("exit_code:")) return true;
  }
  return false;
}

function isEtenderBuyersRunning() {
  return (
    isEtenderBuyersCheckpoint() ||
    isEtenderBuyersProcessRunning() ||
    isEtenderBuyersTerminalActive()
  );
}

function isEtenderBuyersComplete() {
  if (isEtenderBuyersRunning()) return false;
  const statsPath = path.join(DATA, "government-procurement", ".etender-buyers-stats.json");
  if (!fs.existsSync(statsPath)) return false;
  try {
    const s = JSON.parse(fs.readFileSync(statsPath, "utf8"));
    return (s.list_pages_done ?? 0) >= EST_BUYER_LIST_PAGES * 0.95;
  } catch {
    return false;
  }
}

function enrichStatusLabel() {
  if (isEnrichComplete()) return "complete";
  if (isEnrichRunning()) return "running";
  return "pending";
}

function etenderSuppliersStatusLabel() {
  return isEtenderSuppliersComplete() ? "complete" : "pending";
}

function etenderBuyersStatusLabel() {
  if (isEtenderBuyersComplete()) return "complete";
  if (isEtenderBuyersRunning()) return "running";
  return "pending";
}

function logJobStatuses() {
  log(
    [
      `enrich: ${enrichStatusLabel()}`,
      `etender-suppliers: ${etenderSuppliersStatusLabel()}`,
      `etender-buyers: ${etenderBuyersStatusLabel()}`,
      `etender-wave: ${etenderWaveStatusLabel()}`,
    ].join(" | "),
  );
}

function runNpm(script) {
  return new Promise((resolve, reject) => {
    log(`START npm run ${script}`);
    const child = spawn("npm", ["run", script], {
      cwd: ROOT,
      shell: true,
      stdio: "inherit",
    });
    child.on("close", (code) => {
      if (code === 0) {
        log(`DONE npm run ${script}`);
        resolve();
      } else {
        reject(new Error(`${script} exited with code ${code}`));
      }
    });
  });
}

async function printProgressReport() {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["tools/scrape-progress-report.mjs"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env, CURSOR_TERMINALS_DIR: TERMINALS_DIR },
    });
    let out = "";
    child.stdout.on("data", (d) => {
      out += d;
    });
    child.on("close", (code) => {
      if (code === 0) {
        log("\n" + out.trim());
        resolve();
      } else {
        reject(new Error("scrape-progress-report failed"));
      }
    });
  });
}

async function maybeRunPipeline(state) {
  logJobStatuses();

  if (!isEnrichComplete()) {
    return state;
  }
  if (!isEtenderSuppliersComplete()) {
    log("etender-suppliers: waiting before merge");
    return state;
  }

  if (!state.mergeDone) {
    try {
      await runNpm("merge:voen-donors");
      state.mergeDone = true;
      saveState(state);
    } catch (e) {
      log(`ERROR merge: ${e.message}`);
      return state;
    }
  }

  if (!state.retryDone) {
    try {
      await runNpm("retry:etaxes-no-match");
      state.retryDone = true;
      saveState(state);
    } catch (e) {
      log(`ERROR retry: ${e.message}`);
      return state;
    }
  }

  if (!state.exportDone) {
    try {
      await runNpm("export:no-tax-match-donors");
      state.exportDone = true;
      saveState(state);
      log("PIPELINE — merge + retry + export done");
    } catch (e) {
      log(`ERROR export: ${e.message}`);
      return state;
    }
  }

  if (!state.etenderWaveDone) {
    if (isEtenderWaveRunning()) {
      log("etender-wave: already running (lock present)");
      return state;
    }
    try {
      await runNpm("enrich:etaxes-etender-wave");
      state.etenderWaveDone = true;
      saveState(state);
      log("PIPELINE — etender e-taxes wave done");
    } catch (e) {
      log(`ERROR etender-wave: ${e.message}`);
      return state;
    }
  }

  if (!state.expandedRebuildDone) {
    try {
      await runNpm("rebuild:etaxes-expanded");
      state.expandedRebuildDone = true;
      saveState(state);
      log("PIPELINE COMPLETE — merge + retry + export + etender-wave + expanded CSV");
    } catch (e) {
      log(`ERROR expanded rebuild: ${e.message}`);
    }
  }

  return state;
}

async function main() {
  log("pipeline-watch started (hourly reports + auto pipeline)");
  let state = loadState();

  try {
    await printProgressReport();
  } catch (e) {
    log(`progress report error: ${e.message}`);
  }
  state = await maybeRunPipeline(state);

  while (true) {
    await sleep(INTERVAL_MS);
    try {
      await printProgressReport();
    } catch (e) {
      log(`progress report error: ${e.message}`);
    }
    state = await maybeRunPipeline(state);
    if (
      state.mergeDone &&
      state.retryDone &&
      state.exportDone &&
      state.etenderWaveDone &&
      state.expandedRebuildDone
    ) {
      log("Full pipeline done; watcher continues hourly reports");
    }
  }
}

main().catch((e) => {
  log(`FATAL: ${e.message}`);
  process.exit(1);
});
