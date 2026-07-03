#!/usr/bin/env node
/**
 * Plan F QA smoke — export routes, seat licensing, timesheet contracts, audit correlation.
 * Prerequisite: orchestrator API up, platform_workforce entitled org in env.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

console.log("Plan F smoke checks…");

assert.ok(read("packages/era-contracts/src/events/workforce.events.ts").includes("WORKFORCE_TIMESHEET_BATCH_IMPORTED"));
assert.ok(read("packages/era-contracts/src/events/workforce.events.ts").includes("WORKFORCE_TIMESHEET_APPROVED"));
assert.ok(read("era-orchestrator/apps/api/src/platform/workforce/workforce-export.controller.ts").includes('@Get("roster")'));
assert.ok(read("era-orchestrator/apps/api/src/platform/workforce/licensing-seats.controller.ts").includes('@Post("check")'));
assert.ok(read("era-construction/app/api/timesheets/import/route.ts").includes("WORKFORCE_TIMESHEET_BATCH_IMPORTED"));
assert.ok(read("era-finance-core/apps/api/src/integration/workforce-timesheet-sync.service.ts").includes("handleApproved"));
assert.ok(read("packages/satellite-kit/src/audit/satellite-audit.ts").includes("stampWorkforceAuditContext"));
assert.ok(read("era-finance-core/apps/api/src/hr/employees.service.ts").includes("getEmasPrefill"));
assert.ok(read("docs/adr/workforce-external-payroll-and-1c-export.md").includes("platform_workforce"));

console.log("Plan F smoke: all static checks passed.");
