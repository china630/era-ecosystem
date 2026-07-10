/**
 * Report e-taxes search cache size on disk.
 *
 * Usage:
 *   node tools/etaxes-cache-stats.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE_DIR = path.join(ROOT, "data", "legal-entities", ".cache", "etaxes-search");
const STATS_FILE = path.join(ROOT, "data", "legal-entities", ".etaxes-cache-stats.json");

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

let files = 0;
let bytes = 0;
let nameFiles = 0;
let voenFiles = 0;
let withHits = 0;
let withErrors = 0;

if (fs.existsSync(CACHE_DIR)) {
  for (const file of fs.readdirSync(CACHE_DIR)) {
    if (!file.endsWith(".json")) continue;
    files++;
    if (file.startsWith("voen_")) voenFiles++;
    else nameFiles++;
    const full = path.join(CACHE_DIR, file);
    const st = fs.statSync(full);
    bytes += st.size;
    try {
      const j = JSON.parse(fs.readFileSync(full, "utf8"));
      if (j.error) withErrors++;
      if ((j.taxpayers ?? []).length > 0) withHits++;
    } catch {
      /* ignore */
    }
  }
}

const stats = {
  cache_dir: CACHE_DIR,
  files,
  name_files: nameFiles,
  voen_files: voenFiles,
  bytes,
  human_size: formatBytes(bytes),
  queries_with_hits: withHits,
  queries_with_errors: withErrors,
  updated_at: new Date().toISOString(),
};

fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), "utf8");
console.log(JSON.stringify(stats, null, 2));
