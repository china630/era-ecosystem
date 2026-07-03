#!/usr/bin/env node
/**
 * Static audit: MDM identity patterns per app.
 * Usage: node scripts/audit-mdm-identity.mjs [--json]
 */
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { ROOT, walkRepo, relPath, createIssue } from "./audit-lib.mjs";

const MDM_APPS = /^era-(clinic|hotel-pms|finance-core|bank-core|fnb-pos)/;

/** @returns {{ auditId: string, issues: ReturnType<typeof createIssue>[] }} */
export function runMdmIdentityAudit() {
  const files = walkRepo(ROOT, [], { extensions: /\.(ts|tsx)$/ });
  const issues = [];

  for (const file of files) {
    const rel = relPath(file);
    if (!MDM_APPS.test(rel)) continue;
    const text = readFileSync(file, "utf8");
    const isRoute =
      rel.includes("/app/api/") &&
      (text.includes("export async function POST") || text.includes("export async function PATCH"));
    if (!isRoute) continue;
    const usesLookup = text.includes("lookupGlobalPersonByFin");
    const usesLink = text.includes("linkPersonIdentity");
    const usesResolve = text.includes("resolvePersonIdentity");
    if (usesLookup && !usesLink && !usesResolve) {
      issues.push(
        createIssue({
          code: "MDM_LOOKUP_ONLY_ROUTE",
          domain: "MDM",
          app: rel.split("/")[0],
          file: rel,
          message: "lookup-only create/update route",
        }),
      );
    }
  }

  return { auditId: "mdm-identity", issues };
}

function main() {
  const report = runMdmIdentityAudit();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`MDM identity audit — ${report.issues.length} issue(s)\n`);
    for (const i of report.issues) {
      console.log(`  ${i.message}: ${i.file}`);
    }
  }
  process.exitCode = report.issues.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
