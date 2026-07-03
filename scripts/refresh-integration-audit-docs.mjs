#!/usr/bin/env node
/**
 * Refresh living integration audit sections in docs.
 *
 * Usage:
 *   node scripts/refresh-integration-audit-docs.mjs           # dry-run summary
 *   node scripts/refresh-integration-audit-docs.mjs --write # apply updates
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { resolve } from "path";
import { runAllAudits } from "./run-integration-audits.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = new Date().toISOString().slice(0, 10);

const DOC_TARGETS = [
  {
    path: join(ROOT, "docs/DATA_MODEL_INTEGRATION_AUDIT.md"),
    markers: ["issues-count", "automation-date"],
  },
  {
    path: join(ROOT, "docs/MDM_IDENTITY_AUDIT.md"),
    markers: ["mdm-scan-summary"],
  },
  {
    path: join(ROOT, "docs/REFERENCE_DATA_CONSUMER_AUDIT.md"),
    markers: ["reference-scan-summary"],
  },
];

function replaceAutoBlock(content, marker, body) {
  const start = `<!-- AUDIT:AUTO:${marker} -->`;
  const end = `<!-- /AUDIT:AUTO:${marker} -->`;
  const re = new RegExp(`${start}[\\s\\S]*?${end}`, "m");
  const block = `${start}\n${body}\n${end}`;
  if (!re.test(content)) return { content, changed: false };
  return { content: content.replace(re, block), changed: true };
}

function buildDataModelSections(report) {
  const count = report.issues.length;
  const byCode = new Map();
  for (const i of report.issues) {
    byCode.set(i.code, (byCode.get(i.code) ?? 0) + 1);
  }
  const breakdown =
    byCode.size === 0
      ? "none"
      : [...byCode.entries()].map(([c, n]) => `${c}=${n}`).join(", ");

  return {
    "issues-count": `**Automated issues:** ${count} (${breakdown})`,
    "automation-date": `Last refresh: **${TODAY}** via \`run-integration-audits.mjs --strict\``,
  };
}

function buildMdmSummary(report) {
  const mdm = report.issues.filter((i) => i.domain === "MDM");
  return `MDM domain flags: **${mdm.length}** issue(s) as of ${TODAY}.`;
}

function buildReferenceSummary(report) {
  const ref = report.issues.filter((i) => i.domain === "REFERENCE");
  return `Reference/hub domain flags: **${ref.length}** issue(s) as of ${TODAY}.`;
}

function applyDocUpdates(report, write) {
  const dataSections = buildDataModelSections(report);
  const changes = [];

  for (const target of DOC_TARGETS) {
    if (!existsSync(target.path)) continue;
    let content = readFileSync(target.path, "utf8");
    let fileChanged = false;

    if (target.path.includes("DATA_MODEL")) {
      for (const [marker, body] of Object.entries(dataSections)) {
        const r = replaceAutoBlock(content, marker, body);
        content = r.content;
        fileChanged = fileChanged || r.changed;
      }
    }
    if (target.path.includes("MDM_IDENTITY")) {
      const r = replaceAutoBlock(content, "mdm-scan-summary", buildMdmSummary(report));
      content = r.content;
      fileChanged = fileChanged || r.changed;
    }
    if (target.path.includes("REFERENCE_DATA")) {
      const r = replaceAutoBlock(
        content,
        "reference-scan-summary",
        buildReferenceSummary(report),
      );
      content = r.content;
      fileChanged = fileChanged || r.changed;
    }

    if (fileChanged && write) {
      writeFileSync(target.path, content, "utf8");
    }
    if (fileChanged) {
      changes.push(target.path.replace(ROOT, "").replace(/\\/g, "/"));
    }
  }

  return changes;
}

function appendChangelogRow(report) {
  const path = join(ROOT, "docs/DATA_MODEL_INTEGRATION_AUDIT.md");
  if (!existsSync(path)) return false;
  let content = readFileSync(path, "utf8");
  const row = `| ${TODAY} | W5 automation refresh — ${report.issues.length} issue(s) |`;
  if (content.includes(row)) return false;
  const marker = "## 10. Changelog";
  if (!content.includes(marker)) return false;
  content = content.replace(marker, `${marker}\n\n${row}`);
  writeFileSync(path, content, "utf8");
  return true;
}

function main() {
  const write = process.argv.includes("--write");
  const report = runAllAudits();

  const changes = applyDocUpdates(report, write);
  console.log(`Integration audit doc refresh (${write ? "write" : "dry-run"})\n`);
  console.log(`  Issues: ${report.issues.length}`);
  console.log(`  Files with AUTO markers updated: ${changes.length}`);
  for (const c of changes) {
    console.log(`    - ${c}`);
  }

  if (write && changes.length > 0) {
    appendChangelogRow(report);
    console.log("\nChangelog row appended to DATA_MODEL_INTEGRATION_AUDIT.md");
  } else if (!write) {
    console.log("\nRe-run with --write to apply.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
