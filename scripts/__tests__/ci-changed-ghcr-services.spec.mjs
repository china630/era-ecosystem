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
    assert.equal(plan.skipImages, false);
    assert.equal(plan.deploySkip, false);
    assert.equal(plan.rebuildPackages, false);
    assert.deepEqual(plan.services, ["orchestrator"]);
    assert.equal(plan.deployServices, "orchestrator");
    assert.equal(plan.deployScope, "custom");
    assert.equal(plan.imageTagMode, "sha");
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
    assert.equal(plan.deploySkip, false);
    assert.equal(plan.imageTagMode, "sha");
  });

  it("satellite-entrypoint change force-rebuilds all images", () => {
    const plan = resolveGhcrPlan(["docker/scripts/satellite-entrypoint.sh"]);
    assert.equal(plan.all, true);
    assert.equal(plan.skipImages, false);
    assert.equal(plan.deployScope, "all");
    assert.equal(plan.imageTagMode, "sha");
  });

  it("skips docs-only diffs (no images, no deploy)", () => {
    const plan = resolveGhcrPlan(["docs/CI_CD.md", "README.md"]);
    assert.equal(plan.skip, true);
    assert.equal(plan.skipImages, true);
    assert.equal(plan.deploySkip, true);
    assert.equal(plan.deployScope, "skip");
    assert.equal(plan.imageTagMode, "sha");
    assert.deepEqual(plan.services, []);
  });

  it("compose-only: skipImages, deployScope all, floating tag", () => {
    const plan = resolveGhcrPlan(["docker-compose.yml"]);
    assert.equal(plan.skipImages, true);
    assert.equal(plan.skip, true);
    assert.equal(plan.deploySkip, false);
    assert.equal(plan.deployScope, "all");
    assert.equal(plan.imageTagMode, "floating");
    assert.equal(plan.deployServices, "");
    assert.deepEqual(plan.services, []);
    assert.deepEqual(plan.matrix, []);
    assert.equal(plan.rebuildPackages, false);
  });

  it("prod compose-only same as compose", () => {
    const plan = resolveGhcrPlan(["docker-compose.prod.yml"]);
    assert.equal(plan.skipImages, true);
    assert.equal(plan.deploySkip, false);
    assert.equal(plan.deployScope, "all");
    assert.equal(plan.imageTagMode, "floating");
  });

  it("install-contract yaml-only: deploy all, no rebuild, floating tag", () => {
    const plan = resolveGhcrPlan(["config/satellite-install-contract.yaml"]);
    assert.equal(plan.skipImages, true);
    assert.equal(plan.deploySkip, false);
    assert.equal(plan.deployScope, "all");
    assert.equal(plan.imageTagMode, "floating");
  });

  it("deploy-droplet script-only: deploy all, floating tag", () => {
    const plan = resolveGhcrPlan(["docker/scripts/deploy-droplet.sh"]);
    assert.equal(plan.skipImages, true);
    assert.equal(plan.deploySkip, false);
    assert.equal(plan.deployScope, "all");
    assert.equal(plan.imageTagMode, "floating");
  });

  it("clinic + compose → clinic image + deployScope all + floating tag", () => {
    const plan = resolveGhcrPlan(["era-clinic/foo.ts", "docker-compose.yml"]);
    assert.equal(plan.skipImages, false);
    assert.equal(plan.deploySkip, false);
    assert.deepEqual(plan.services, ["clinic"]);
    assert.equal(plan.deployScope, "all");
    assert.equal(plan.imageTagMode, "floating");
    assert.equal(plan.deployServices, "");
    assert.equal(plan.matrix.length, 1);
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
    assert.equal(plan.deployScope, "custom");
  });
});
