/**
 * Purge e-taxes name cache entries that used wrong letter case.
 * DVX expects az-AZ uppercase (i→İ, ı→I). Old runs sent lowercase / ASCII rules.
 *
 * Usage:
 *   node tools/retry-etaxes-wrong-case-404.mjs              # report
 *   node tools/retry-etaxes-wrong-case-404.mjs --purge      # delete eligible
 *   node tools/retry-etaxes-wrong-case-404.mjs --purge --hits  # also stale hits w/o api_query
 */

import fs from "node:fs";
import path from "node:path";
import { toEtaxesSearchQuery } from "./etaxes-search-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE_DIR = path.join(ROOT, "data", "legal-entities", ".cache", "etaxes-search");
const PURGE = process.argv.includes("--purge");
const INCLUDE_HITS = process.argv.includes("--hits");

const stats = {
  scanned: 0,
  keep_correct: 0,
  purge_404_wrong_case: 0,
  purge_hit_wrong_case: 0,
  purged: 0,
};

function shouldPurge(data, file) {
  const raw = data.query ?? file.slice(5, -5).replace(/_/g, "");
  const apiQ = toEtaxesSearchQuery(raw);
  if (data.api_query === apiQ) return false;
  if (data.query === apiQ) return false;

  const is404 = data.error && /404/.test(String(data.error));
  const hasHits = (data.taxpayers ?? []).length > 0;

  if (is404) return "404";
  if (INCLUDE_HITS && hasHits && !data.api_query) return "hit";
  return false;
}

for (const file of fs.readdirSync(CACHE_DIR)) {
  if (!file.startsWith("name_") || !file.endsWith(".json")) continue;
  stats.scanned++;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), "utf8"));
  } catch {
    continue;
  }

  const reason = shouldPurge(data, file);
  if (!reason) {
    stats.keep_correct++;
    continue;
  }

  if (reason === "404") stats.purge_404_wrong_case++;
  if (reason === "hit") stats.purge_hit_wrong_case++;

  if (PURGE) {
    fs.unlinkSync(path.join(CACHE_DIR, file));
    stats.purged++;
  }
}

console.log(
  JSON.stringify(
    {
      ...stats,
      include_hits: INCLUDE_HITS,
      hint: PURGE
        ? "Restart trigram sweep to re-fetch purged queries."
        : "Run with --purge [--hits] to delete.",
    },
    null,
    2,
  ),
);
