/**
 * Break down e-taxes cache error files by type and retry eligibility.
 *
 * Usage:
 *   node tools/analyze-etaxes-cache-errors.mjs
 *   node tools/analyze-etaxes-cache-errors.mjs --json
 */

import fs from "node:fs";
import path from "node:path";
import { toEtaxesSearchQuery } from "./etaxes-search-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE_DIR = path.join(ROOT, "data", "legal-entities", ".cache", "etaxes-search");
const JSON_OUT = process.argv.includes("--json");

function classifyError(error) {
  const e = String(error ?? "");
  if (/ETAXES_TIMEOUT/i.test(e)) return "timeout";
  if (/HTTP 404/.test(e)) return "http_404";
  if (/HTTP 5\d\d/.test(e)) return "http_5xx";
  if (/HTTP 4\d\d/.test(e)) return "http_4xx_other";
  if (/HTTP 429/.test(e)) return "http_429";
  return "other";
}

function isWrongCase404(data) {
  if (!data?.error || !/404/.test(String(data.error))) return false;
  const raw = data.query ?? "";
  const apiQ = toEtaxesSearchQuery(raw);
  if (data.api_query === apiQ) return false;
  if (data.query === apiQ) return false;
  return true;
}

function isRetryable(data) {
  const e = String(data?.error ?? "");
  if (isWrongCase404(data)) return "wrong_case_404";
  if (/ETAXES_TIMEOUT/i.test(e)) return "timeout";
  if (/HTTP 5\d\d/.test(e)) return "http_5xx";
  if (/HTTP 429/.test(e)) return "http_429";
  return null;
}

const stats = {
  scanned: 0,
  name_files: 0,
  voen_files: 0,
  with_error: 0,
  with_hits_and_error: 0,
  error_by_type: {},
  retryable: {
    wrong_case_404: 0,
    timeout: 0,
    http_5xx: 0,
    http_429: 0,
    total_unique: 0,
  },
  http_404_correct_case: 0,
  samples: {
    wrong_case_404: [],
    timeout: [],
    http_5xx: [],
    http_404_correct_case: [],
  },
};

const retryableKeys = new Set();

for (const file of fs.readdirSync(CACHE_DIR)) {
  if (!file.endsWith(".json")) continue;
  stats.scanned++;
  if (file.startsWith("voen_")) stats.voen_files++;
  else stats.name_files++;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), "utf8"));
  } catch {
    continue;
  }

  if (!data.error) continue;
  stats.with_error++;

  const hits = (data.taxpayers ?? []).length;
  if (hits > 0) stats.with_hits_and_error++;

  const type = classifyError(data.error);
  stats.error_by_type[type] = (stats.error_by_type[type] || 0) + 1;

  const retry = isRetryable(data);
  if (retry) {
    stats.retryable[retry]++;
    retryableKeys.add(file);
    if (stats.samples[retry].length < 5) {
      stats.samples[retry].push({
        file,
        query: data.query,
        api_query: data.api_query,
        error: data.error,
      });
    }
  } else if (type === "http_404" && !isWrongCase404(data)) {
    stats.http_404_correct_case++;
    if (stats.samples.http_404_correct_case.length < 5) {
      stats.samples.http_404_correct_case.push({
        file,
        query: data.query,
        api_query: data.api_query,
        error: data.error,
      });
    }
  }
}

stats.retryable.total_unique = retryableKeys.size;

const report = {
  cache_dir: CACHE_DIR,
  ...stats,
  recommendation: {
    worth_retry:
      stats.retryable.wrong_case_404 +
      stats.retryable.timeout +
      stats.retryable.http_5xx +
      stats.retryable.http_429,
    likely_hopeless: stats.http_404_correct_case,
    note:
      "Retry wrong_case_404 + timeout + 5xx/429 only. http_404 with correct api_query is unlikely to yield new VÖEN.",
  },
  updated_at: new Date().toISOString(),
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("=== e-taxes cache error breakdown ===\n");
  console.log(`Files scanned:     ${stats.scanned} (name: ${stats.name_files}, voen: ${stats.voen_files})`);
  console.log(`With error field:  ${stats.with_error}`);
  console.log(`Hits + error:      ${stats.with_hits_and_error}\n`);

  console.log("By error type:");
  for (const [k, v] of Object.entries(stats.error_by_type).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(18)} ${v}`);
  }

  console.log("\nRetry eligibility:");
  console.log(`  wrong_case_404     ${stats.retryable.wrong_case_404}  ← purge + re-fetch`);
  console.log(`  timeout            ${stats.retryable.timeout}  ← re-fetch`);
  console.log(`  http_5xx           ${stats.retryable.http_5xx}  ← re-fetch`);
  console.log(`  http_429           ${stats.retryable.http_429}  ← re-fetch with delay`);
  console.log(`  ─────────────────`);
  console.log(`  total retryable    ${stats.retryable.total_unique}`);
  console.log(`  http_404 (correct case) ${stats.http_404_correct_case}  ← likely hopeless`);

  console.log("\nRecommendation:");
  console.log(
    `  Worth retry: ~${report.recommendation.worth_retry} files | Hopeless 404: ~${report.recommendation.likely_hopeless}`,
  );
  console.log(`  ${report.recommendation.note}`);

  if (stats.samples.wrong_case_404.length) {
    console.log("\nSample wrong_case_404:");
    for (const s of stats.samples.wrong_case_404) console.log(`  ${s.query} → ${s.error}`);
  }
  if (stats.samples.timeout.length) {
    console.log("\nSample timeout:");
    for (const s of stats.samples.timeout) console.log(`  ${s.query} → ${s.error}`);
  }
  if (stats.samples.http_5xx.length) {
    console.log("\nSample http_5xx:");
    for (const s of stats.samples.http_5xx) console.log(`  ${s.query} → ${s.error}`);
  }
}
