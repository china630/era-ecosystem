/**
 * Unit tests for integration audit baseline logic.
 * Run: node --test scripts/__tests__/integration-audit.spec.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { issueKey } from "../audit-lib.mjs";
import { compareBaseline, loadBaseline } from "../run-integration-audits.mjs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const FIXTURE_BASELINE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../audit-baselines/integration-audit.baseline.json",
);

describe("issueKey", () => {
  it("uses app for app-level issues", () => {
    assert.equal(issueKey({ code: "PII_DUPLICATE", app: "era-clinic" }), "PII_DUPLICATE:era-clinic");
  });

  it("uses file for route-level issues", () => {
    assert.equal(
      issueKey({ code: "MDM_LOOKUP_ONLY_ROUTE", file: "era-clinic/app/api/x/route.ts" }),
      "MDM_LOOKUP_ONLY_ROUTE:era-clinic/app/api/x/route.ts",
    );
  });
});

describe("compareBaseline", () => {
  const baseline = {
    allowedIssues: [
      { code: "PII_DUPLICATE", app: "era-clinic", wave: "W1" },
    ],
  };

  it("ci mode allows baselined issue", () => {
    const issues = [
      { code: "PII_DUPLICATE", app: "era-clinic", message: "test" },
    ];
    const r = compareBaseline(issues, baseline, "ci");
    assert.equal(r.fail, false);
    assert.equal(r.regressions.length, 0);
    assert.equal(r.allowedRemaining.length, 1);
  });

  it("ci mode fails on new issue", () => {
    const issues = [
      { code: "PII_DUPLICATE", app: "era-clinic", message: "test" },
      { code: "DATA_HUB_DIRECT", app: "era-crm", message: "new" },
    ];
    const r = compareBaseline(issues, baseline, "ci");
    assert.equal(r.fail, true);
    assert.equal(r.regressions.length, 1);
    assert.equal(r.regressions[0].code, "DATA_HUB_DIRECT");
  });

  it("strict mode fails on baselined issue", () => {
    const issues = [{ code: "PII_DUPLICATE", app: "era-clinic", message: "test" }];
    const r = compareBaseline(issues, baseline, "strict");
    assert.equal(r.fail, true);
    assert.equal(r.regressions.length, 1);
  });

  it("reports fixed baselined entries", () => {
    const r = compareBaseline([], baseline, "ci");
    assert.equal(r.fixedBaselined.length, 1);
    assert.equal(r.fail, false);
  });
});

describe("loadBaseline", () => {
  it("loads repo baseline JSON", () => {
    const b = loadBaseline(FIXTURE_BASELINE);
    assert.equal(b.version, 1);
    assert.ok(Array.isArray(b.allowedIssues));
  });
});

describe("reference audit allowlist", () => {
  it("orchestrator is not flagged as industry", async () => {
    const { ALLOWED_HUB_APPS } = await import("../audit-allowlists.mjs");
    assert.ok(ALLOWED_HUB_APPS.has("era-orchestrator"));
  });
});
