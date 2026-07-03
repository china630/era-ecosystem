#!/usr/bin/env node
/**
 * Unified integration audit runner with baseline compare.
 *
 * Usage:
 *   node scripts/run-integration-audits.mjs
 *   node scripts/run-integration-audits.mjs --ci
 *   node scripts/run-integration-audits.mjs --strict
 *   node scripts/run-integration-audits.mjs --json
 *   node scripts/run-integration-audits.mjs --update-baseline
 *   node scripts/run-integration-audits.mjs --only data-model,reference
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { issueKey } from "./audit-lib.mjs";
import { runDataModelAudit } from "./audit-data-model-integration.mjs";
import { runMdmIdentityAudit } from "./audit-mdm-identity.mjs";
import { runReferenceDataAudit } from "./audit-reference-data.mjs";

const SCRIPTS_DIR = join(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_BASELINE = join(SCRIPTS_DIR, "audit-baselines/integration-audit.baseline.json");

const AUDIT_RUNNERS = {
  "data-model": runDataModelAudit,
  "mdm-identity": runMdmIdentityAudit,
  "reference-data": runReferenceDataAudit,
};

/** @param {string} [path] */
export function loadBaseline(path = DEFAULT_BASELINE) {
  if (!existsSync(path)) {
    return { version: 1, updatedAt: null, allowedIssues: [] };
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * @param {Array<{ code: string, app?: string, file?: string }>} issues
 * @param {{ allowedIssues?: Array<{ code: string, app?: string, file?: string, wave?: string }> }} baseline
 * @param {"ci" | "strict"} mode
 */
export function compareBaseline(issues, baseline, mode) {
  const allowed = new Set(
    (baseline.allowedIssues ?? []).map((e) =>
      issueKey({ code: e.code, app: e.app, file: e.file }),
    ),
  );
  const found = new Set(issues.map((i) => issueKey(i)));

  const regressions = [];
  const allowedRemaining = [];
  const fixedBaselined = [];

  for (const issue of issues) {
    const key = issueKey(issue);
    if (mode === "strict" || allowed.size === 0) {
      regressions.push(issue);
    } else if (allowed.has(key)) {
      allowedRemaining.push(issue);
    } else {
      regressions.push(issue);
    }
  }

  for (const entry of baseline.allowedIssues ?? []) {
    const key = issueKey(entry);
    if (!found.has(key)) {
      fixedBaselined.push(entry);
    }
  }

  return { regressions, allowedRemaining, fixedBaselined, fail: mode === "strict" ? issues.length > 0 : regressions.length > 0 };
}

/** @param {{ only?: string[], domainFilter?: string }} [opts] */
export function runAllAudits(opts = {}) {
  const only = opts.only?.length ? new Set(opts.only) : null;
  const audits = [];
  const issues = [];

  for (const [id, fn] of Object.entries(AUDIT_RUNNERS)) {
    if (only && !only.has(id)) continue;
    const result = id === "data-model" ? fn({ domainFilter: opts.domainFilter }) : fn();
    audits.push({ id, issueCount: result.issues.length });
    issues.push(...result.issues);
  }

  return {
    generatedAt: new Date().toISOString(),
    audits,
    issues,
  };
}

function parseArgs(argv) {
  return {
    ci: argv.includes("--ci"),
    strict: argv.includes("--strict"),
    json: argv.includes("--json"),
    updateBaseline: argv.includes("--update-baseline"),
    only: argv.includes("--only")
      ? argv[argv.indexOf("--only") + 1]?.split(",").map((s) => s.trim())
      : undefined,
    domain: argv.includes("--domain") ? argv[argv.indexOf("--domain") + 1] : undefined,
    baselinePath: argv.includes("--baseline")
      ? argv[argv.indexOf("--baseline") + 1]
      : DEFAULT_BASELINE,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const mode = args.strict || args.ci && loadBaseline(args.baselinePath).allowedIssues?.length === 0
    ? "strict"
    : args.ci
      ? "ci"
      : "report";

  const report = runAllAudits({ only: args.only, domainFilter: args.domain });
  const baseline = loadBaseline(args.baselinePath);
  const comparison =
    mode === "report"
      ? { regressions: report.issues, allowedRemaining: [], fixedBaselined: [], fail: report.issues.length > 0 }
      : compareBaseline(report.issues, baseline, mode === "strict" ? "strict" : "ci");

  report.baseline = {
    mode,
    path: args.baselinePath,
    allowedCount: baseline.allowedIssues?.length ?? 0,
    regressions: comparison.regressions.length,
    allowedRemaining: comparison.allowedRemaining.length,
    fixedBaselined: comparison.fixedBaselined.length,
  };
  report.regressions = comparison.regressions;
  report.fixedBaselined = comparison.fixedBaselined;

  if (args.updateBaseline) {
    const next = {
      version: 1,
      updatedAt: new Date().toISOString().slice(0, 10),
      note: "Updated via --update-baseline",
      allowedIssues: report.issues.map((i) => ({
        code: i.code,
        app: i.app,
        file: i.file,
        note: i.message,
      })),
    };
    writeFileSync(args.baselinePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    console.log(`Baseline updated: ${args.baselinePath} (${next.allowedIssues.length} entries)`);
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Integration audit suite — ${report.issues.length} issue(s) [mode=${mode}]\n`);
    for (const a of report.audits) {
      console.log(`  ${a.id}: ${a.issueCount} issue(s)`);
    }
    if (comparison.fixedBaselined.length > 0) {
      console.log("\nFixed (still in baseline — shrink baseline PR):");
      for (const f of comparison.fixedBaselined) {
        console.log(`  - ${issueKey(f)} (${f.wave ?? "?"})`);
      }
    }
    if (comparison.regressions.length > 0) {
      console.log("\nRegressions / failures:");
      for (const i of comparison.regressions) {
        console.log(`  [${i.code}] ${i.app ?? ""} ${i.file ?? ""}: ${i.message}`);
      }
    } else {
      console.log("\nNo regressions.");
    }
  }

  const exitFail =
    args.updateBaseline ? false : mode === "strict" ? report.issues.length > 0 : comparison.fail;
  process.exitCode = exitFail ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
