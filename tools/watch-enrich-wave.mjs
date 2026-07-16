/**
 * Progress snapshot for running donor-wave enrich (read-only).
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeNameKey } from "./etaxes-search-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const LE = path.join(ROOT, "data", "legal-entities");
const CACHE = path.join(LE, ".cache", "etaxes-search");
const LOCK = path.join(LE, ".enrich-running.lock");

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  // simple: first column company_name for our tenant CSVs
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (c === "," && !q) {
        cols.push(cur);
        cur = "";
      } else cur += c;
    }
    cols.push(cur);
    const o = {};
    headers.forEach((h, idx) => {
      o[h] = cols[idx] ?? "";
    });
    return o;
  });
}

function readCsv(rel) {
  const p = path.join(ROOT, "data", rel);
  if (!fs.existsSync(p)) return [];
  return parseCsv(fs.readFileSync(p, "utf8"));
}

const names = new Set();
for (const row of readCsv("top-taxpayers/azerbaijan-top100-taxpayers-2025-merged.csv")) {
  const n = row.company_name || row.name || row.taxpayer_name || "";
  if (n) names.add(normalizeNameKey(n));
}
for (const row of readCsv("trade-participants/azerbaijan-green-corridor-unique.csv")) {
  const n = row.company_name || row.name || "";
  if (n) names.add(normalizeNameKey(n));
}
for (const row of readCsv("business-plazas/baku-plaza-tenants-2gis.csv")) {
  const n = row.company_name || "";
  if (n) names.add(normalizeNameKey(n));
}
for (const row of readCsv("business-plazas/baku-plaza-tenants-official.csv")) {
  const n = row.company_name || "";
  if (n) names.add(normalizeNameKey(n));
}

let lock = null;
if (fs.existsSync(LOCK)) {
  try {
    lock = JSON.parse(fs.readFileSync(LOCK, "utf8"));
  } catch {
    lock = { raw: fs.readFileSync(LOCK, "utf8") };
  }
}

const startedAt = lock?.startedAt ? new Date(lock.startedAt) : null;
let sinceStart = 0;
let last5 = 0;
let latest = null;
const now = Date.now();
if (fs.existsSync(CACHE)) {
  for (const f of fs.readdirSync(CACHE)) {
    if (!f.endsWith(".json")) continue;
    const st = fs.statSync(path.join(CACHE, f));
    const afterStart = startedAt && st.mtimeMs >= startedAt.getTime();
    if (afterStart) sinceStart++;
    if (now - st.mtimeMs < 5 * 60 * 1000) last5++;
    if (afterStart && (!latest || st.mtimeMs > latest.mtimeMs)) {
      latest = { name: f, mtime: new Date(st.mtimeMs).toISOString(), mtimeMs: st.mtimeMs };
    }
  }
}

const wave = fs
  .readdirSync(LE)
  .filter((f) => f.startsWith("azerbaijan-donor-wave") || f.startsWith(".enrich-wave"))
  .map((f) => {
    const st = fs.statSync(path.join(LE, f));
    return { f, size: st.size, mtime: st.mtime.toISOString() };
  });

let alive = false;
if (lock?.pid) {
  try {
    process.kill(lock.pid, 0);
    alive = true;
  } catch {
    alive = false;
  }
}

const out = {
  at: new Date().toISOString(),
  lock,
  alive,
  approxUniqueDonorNames: names.size,
  cacheWritesSinceStart: sinceStart,
  cacheWritesLast5min: last5,
  latestCache: latest,
  waveOutputs: wave,
  elapsedMin: startedAt ? Math.round((now - startedAt.getTime()) / 60000) : null,
  ratePerMin:
    startedAt && sinceStart > 0
      ? +(sinceStart / ((now - startedAt.getTime()) / 60000)).toFixed(2)
      : null,
};

try {
  fs.writeFileSync(path.join(LE, ".enrich-wave-watch.json"), JSON.stringify(out, null, 2));
} catch {
  /* ignore lock/busy */
}
console.log(JSON.stringify(out, null, 2));
