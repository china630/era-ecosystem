/**
 * Unit tests for GHCR path-filter plan.
 * Run: node --test scripts/__tests__/ci-changed-ghcr-services.spec.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveGhcrPlan, GHCR_MATRIX } from "../ci-changed-ghcr-services.mjs";

describe("resolveGhcrPlan", () => {
  it("rebuilds only orchestrator for orch-only diffs", () => {
    const plan = resolveGhcrPlan(["era-orchestrator/apps/api/src/foo.ts"]);
    assert.equal(plan.skip, false);
    assert.equal(plan.rebuildPackages, false);
    assert.deepEqual(plan.services, ["orchestrator"]);
    assert.equal(plan.deployServices, "orchestrator");
    assert.equal(plan.matrix.length, 1);
    assert.equal(plan.matrix[0].service, "orchestrator");
  });

  it("maps finance web vs api", () => {
    const web = resolveGhcrPlan(["era-finance-core/apps/web/src/app/page.tsx"]);
    assert.deepEqual(web.services, ["finance-web"]);
    const api = resolveGhcrPlan(["era-finance-core/apps/api/src/main.ts"]);
    assert.deepEqual(api.services, ["finance-core"]);
  });

  it("rebuilds all images when packages change", () => {
    const plan = resolveGhcrPlan(["packages/satellite-kit/src/index.ts"]);
    assert.equal(plan.all, true);
    assert.equal(plan.rebuildPackages, true);
    assert.equal(plan.services.length, GHCR_MATRIX.length);
    assert.equal(plan.deployScope, "all");
  });

  it("skips docs-only diffs", () => {
    const plan = resolveGhcrPlan(["docs/CI_CD.md", "README.md"]);
    assert.equal(plan.skip, true);
    assert.equal(plan.deployScope, "skip");
    assert.deepEqual(plan.services, []);
  });

  it("treats empty workflow_dispatch as all", () => {
    const plan = resolveGhcrPlan([], { dispatchServices: "" });
    assert.equal(plan.all, true);
    assert.equal(plan.services.length, GHCR_MATRIX.length);
  });

  it("honours explicit dispatch list", () => {
    const plan = resolveGhcrPlan([], { dispatchServices: "orchestrator,clinic" });
    assert.deepEqual(plan.services, ["orchestrator", "clinic"]);
    assert.equal(plan.deployServices, "orchestrator clinic");
  });
});
