/**
 * E-taxes name-search wave for etender suppliers + buyers (cache only).
 * Populates .cache/etaxes-search/ for rebuild-etaxes-expanded-from-cache.mjs.
 *
 * Usage:
 *   node tools/enrich-etaxes-etender-wave.mjs
 *   node tools/enrich-etaxes-etender-wave.mjs --limit 50
 */

import fs from "node:fs";
import path from "node:path";
import { deriveSearchQueries } from "./etaxes-search-utils.mjs";
import { launchBrowser, refreshEtaxesPage, searchLegalEntities, searchByVoen } from "./etaxes-playwright-search.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");
const CACHE_DIR = path.join(DATA, "legal-entities", ".cache", "etaxes-search");
const COMPLETE = path.join(DATA, "legal-entities", ".etender-etaxes-wave-complete.json");
const LOCK = path.join(DATA, "legal-entities", ".etender-etaxes-wave.lock");
const CHECKPOINT = path.join(DATA, "legal-entities", ".etender-etaxes-wave-checkpoint.json");

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 0;
const HEADFUL = args.includes("--headful");
const MIN_DELAY_MS = Number(process.env.ETAXES_DELAY_MS ?? 2500);
const MAX_DELAY_MS = Number(process.env.ETAXES_MAX_DELAY_MS ?? 4500);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randDelay = () =>
  sleep(MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)));

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

function loadWaveQueries() {
  const nameQueries = new Set();
  const voenQueries = new Set();

  const suppliers = path.join(DATA, "government-procurement", "azerbaijan-etender-suppliers.csv");
  if (fs.existsSync(suppliers)) {
    for (const row of parseCsv(fs.readFileSync(suppliers, "utf8"))) {
      const name = row.supplier_name?.trim();
      if (name) for (const q of deriveSearchQueries(name, name)) nameQueries.add(q);
      const v = String(row.voen ?? "").trim();
      if (isAzVoen(v)) voenQueries.add(v);
    }
  }

  const buyers = path.join(DATA, "government-procurement", "azerbaijan-etender-buyers.csv");
  if (fs.existsSync(buyers)) {
    for (const row of parseCsv(fs.readFileSync(buyers, "utf8"))) {
      const name = row.buyer_name?.trim();
      if (name) for (const q of deriveSearchQueries(name, name)) nameQueries.add(q);
      const v = String(row.voen ?? "").trim();
      if (isAzVoen(v)) voenQueries.add(v);
    }
  }

  return {
    nameQueries: [...nameQueries].sort(),
    voenQueries: [...voenQueries].sort(),
  };
}

function acquireLock() {
  if (fs.existsSync(LOCK)) {
    try {
      const lock = JSON.parse(fs.readFileSync(LOCK, "utf8"));
      const ageMs = Date.now() - new Date(lock.startedAt).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        console.log(`Another etender wave active (pid ${lock.pid}). Exit.`);
        process.exit(0);
      }
    } catch {
      /* stale */
    }
  }
  fs.writeFileSync(
    LOCK,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    "utf8",
  );
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK);
  } catch {
    /* ignore */
  }
}

async function runBatch(page, label, queries, startIdx, stats) {
  for (let i = startIdx; i < queries.length; i++) {
    const q = queries[i];
    const cacheKey = label === "voen" ? `voen_${q}.json` : null;
    if (cacheKey && fs.existsSync(path.join(CACHE_DIR, cacheKey))) {
      stats.cache_skipped++;
    } else if (label === "voen") {
      try {
        const { taxpayers, error } = await searchByVoen(page, q, CACHE_DIR);
        console.log(`[${label} ${i + 1}/${queries.length}] ${q} ... ${taxpayers.length} hit(s)${error ? ` [${error}]` : ""}`);
      } catch (e) {
        const cacheFile = path.join(CACHE_DIR, `voen_${q}.json`);
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(cacheFile, JSON.stringify({ query: q, taxpayers: [], error: e.message }, null, 2), "utf8");
        console.log(`[${label} ${i + 1}/${queries.length}] ${q} ... error [${e.message}]`);
        try {
          await refreshEtaxesPage(page);
        } catch {
          /* browser may be dead; next iteration will surface it */
        }
      }
    } else {
      const cacheFile = path.join(
        CACHE_DIR,
        `name_${q.toLowerCase().replace(/[^a-z0-9ƏəİıÖöÜüÇçŞşĞğ_-]/gi, "_")}.json`,
      );
      if (fs.existsSync(cacheFile)) {
        stats.cache_skipped++;
        console.log(`[${label} ${i + 1}/${queries.length}] ${q} ... cached`);
      } else {
        try {
          const { taxpayers, error } = await searchLegalEntities(page, q, CACHE_DIR);
          console.log(`[${label} ${i + 1}/${queries.length}] ${q} ... ${taxpayers.length} hit(s)${error ? ` [${error}]` : ""}`);
        } catch (e) {
          fs.mkdirSync(CACHE_DIR, { recursive: true });
          fs.writeFileSync(cacheFile, JSON.stringify({ query: q, taxpayers: [], error: e.message }, null, 2), "utf8");
          console.log(`[${label} ${i + 1}/${queries.length}] ${q} ... error [${e.message}]`);
          try {
            await refreshEtaxesPage(page);
          } catch {
            /* ignore */
          }
        }
      }
    }

    stats.done = i + 1;
    if ((i + 1) % 5 === 0 || i + 1 === queries.length) {
      fs.writeFileSync(
        CHECKPOINT,
        JSON.stringify(
          {
            phase: label,
            index: i + 1,
            total: queries.length,
            stats,
            updated_at: new Date().toISOString(),
          },
          null,
          2,
        ),
        "utf8",
      );
    }
    if (i < queries.length - 1) await randDelay();
  }
}

async function main() {
  if (fs.existsSync(COMPLETE) && !args.includes("--force")) {
    console.log("Etender e-taxes wave already complete. Use --force to re-run.");
    return;
  }
  if (args.includes("--force") && fs.existsSync(COMPLETE)) fs.unlinkSync(COMPLETE);

  acquireLock();
  try {
    const { nameQueries, voenQueries } = loadWaveQueries();
    let names = nameQueries;
    let voens = voenQueries;
    if (LIMIT > 0) {
      names = names.slice(0, LIMIT);
      voens = voens.slice(0, Math.min(LIMIT, voens.length));
    }

    console.log(`Name queries: ${names.length}, VÖEN queries: ${voens.length}`);

    const { browser, page } = await launchBrowser(HEADFUL);
    const stats = { cache_skipped: 0, done: 0 };

    let nameStart = 0;
    let voenStart = 0;
    let phase = "name";
    if (fs.existsSync(CHECKPOINT)) {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8"));
      if (cp.phase === "name") nameStart = cp.index ?? 0;
      if (cp.phase === "voen") {
        phase = "voen";
        voenStart = cp.index ?? 0;
      }
      console.log(`Resume ${cp.phase} at ${cp.index}/${cp.total}`);
    }

    if (phase === "name") {
      await runBatch(page, "name", names, nameStart, stats);
    }
    await runBatch(page, "voen", voens, voenStart, stats);

    await browser.close();
    if (fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT);
    fs.writeFileSync(
      COMPLETE,
      JSON.stringify(
        {
          name_queries: names.length,
          voen_queries: voens.length,
          finished_at: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log("Etender e-taxes wave complete.");
  } finally {
    releaseLock();
  }
}

main().catch((e) => {
  console.error(e);
  releaseLock();
  process.exit(1);
});
