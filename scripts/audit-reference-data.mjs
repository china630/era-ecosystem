#!/usr/bin/env node
/**
 * Static audit: reference-data consumption boundaries.
 * Usage: node scripts/audit-reference-data.mjs [--json]
 */
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { ROOT, walkRepo, relPath, createIssue } from "./audit-lib.mjs";
import {
  ALLOWED_HUB_APPS,
  isHubGrepExcluded,
} from "./audit-allowlists.mjs";

/** @returns {{ auditId: string, issues: ReturnType<typeof createIssue>[] }} */
export function runReferenceDataAudit() {
  const issues = [];
  const files = walkRepo(ROOT, [], {
    extensions: /\.(ts|tsx|js|mjs|env|yml|yaml|md)$/,
    skipTestFiles: false,
  });

  for (const file of files) {
    const rel = relPath(file);
    const top = rel.split("/")[0];
    if (!top.startsWith("era-") && top !== "packages") continue;
    if (ALLOWED_HUB_APPS.has(top)) continue;
    if (isHubGrepExcluded(rel)) continue;

    const text = readFileSync(file, "utf8");
    const app = top.startsWith("era-") ? top : "packages";

    if (text.includes("ERA_DATA_HUB_URL") || text.includes("ERA_DATA_HUB_ENABLED")) {
      issues.push(
        createIssue({
          code: "DATA_HUB_DIRECT",
          domain: "REFERENCE",
          app,
          file: rel,
          message: "ERA_DATA_HUB_* env in industry satellite",
        }),
      );
    }
    if (/\/registry\/v1/.test(text)) {
      issues.push(
        createIssue({
          code: "DATA_HUB_DIRECT",
          domain: "REFERENCE",
          app,
          file: rel,
          message: "direct /registry/v1 reference",
        }),
      );
    }
  }

  return { auditId: "reference-data", issues };
}

function main() {
  const report = runReferenceDataAudit();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Reference data audit — ${report.issues.length} issue(s)\n`);
    for (const i of report.issues) {
      console.log(`  ${i.message}: ${i.file ?? i.app}`);
    }
  }
  process.exitCode = report.issues.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
