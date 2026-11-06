/**
 * Unit tests for GHCR path-filter plan.
 * Run: node --test scripts/__tests__/ci-changed-ghcr-services.spec.mjs
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveGhcrPlan,
  formatDeployScopeArtifact,
  GHCR_MATRIX,
} from "../ci-changed-ghcr-services.mjs";

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

  it("rebuilds active images when packages change and leaves paused apps out", () => {
    const plan = resolveGhcrPlan(["packages/satellite-kit/src/index.ts"]);
    assert.equal(plan.all, true);
    assert.equal(plan.rebuildPackages, true);
    assert.equal(plan.deploySkip, false);
    assert.equal(plan.deployScope, "custom");
    assert.equal(plan.imageTagMode, "sha");
    const deployed = new Set(plan.deployServices.split(/\s+/));
    for (const paused of ["logistics", "construction", "crm", "auto-service", "wholesale", "bank", "bank-dbo"]) {
      assert.equal(plan.services.includes(paused), false, paused);
      assert.equal(deployed.has(paused), false, paused);
    }
    assert.equal(plan.services.includes("bank-core"), true);
    assert.equal(plan.services.includes("orchestrator"), true);
    assert.equal(plan.services.length, GHCR_MATRIX.length - 7);
  });

  it("satellite-entrypoint change force-rebuilds active images only", () => {
    const plan = resolveGhcrPlan(["docker/scripts/satellite-entrypoint.sh"]);
    assert.equal(plan.all, true);
    assert.equal(plan.skipImages, false);
    assert.equal(plan.deployScope, "custom");
    assert.equal(plan.imageTagMode, "sha");
    assert.equal(plan.services.includes("logistics"), false);
    assert.equal(plan.services.includes("clinic"), true);
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

  it("compose-only: skipImages, active services, floating tag", () => {
    const plan = resolveGhcrPlan(["docker-compose.yml"]);
    assert.equal(plan.skipImages, true);
    assert.equal(plan.skip, true);
    assert.equal(plan.deploySkip, false);
    assert.equal(plan.deployScope, "custom");
    assert.equal(plan.imageTagMode, "floating");
    assert.match(plan.deployServices, /\borchestrator\b/);
    assert.equal(plan.deployServices.split(/\s+/).includes("bank"), false);
    assert.deepEqual(plan.services, []);
    assert.deepEqual(plan.matrix, []);
    assert.equal(plan.rebuildPackages, false);
  });

  it("prod compose-only same as compose", () => {
    const plan = resolveGhcrPlan(["docker-compose.prod.yml"]);
    assert.equal(plan.skipImages, true);
    assert.equal(plan.deploySkip, false);
    assert.equal(plan.deployScope, "custom");
    assert.equal(plan.imageTagMode, "floating");
    assert.equal(plan.deployServices.split(/\s+/).includes("wholesale"), false);
  });

  it("install-contract yaml-only: deploy all, no rebuild, floating tag", () => {
    const plan = resolveGhcrPlan(["config/satellite-install-contract.yaml"]);
    assert.equal(plan.skipImages, true);
    assert.equal(plan.deploySkip, false);
    assert.equal(plan.deployScope, "custom");
    assert.equal(plan.imageTagMode, "floating");
  });

  it("paused satellite diff builds and deploys nothing", () => {
    const plan = resolveGhcrPlan(["era-logistics/src/a.ts", "era-bank/src/b.ts", "era-crm/src/c.ts"]);
    assert.equal(plan.skipImages, true);
    assert.equal(plan.deploySkip, true);
    assert.equal(plan.deployScope, "skip");
    assert.deepEqual(plan.services, []);
  });

  it("deploy-droplet script-only: deploy active services, floating tag", () => {
    const plan = resolveGhcrPlan(["docker/scripts/deploy-droplet.sh"]);
    assert.equal(plan.skipImages, true);
    assert.equal(plan.deploySkip, false);
    assert.equal(plan.deployScope, "custom");
    assert.equal(plan.imageTagMode, "floating");
    assert.equal(plan.deployServices.includes("crm"), false);
  });

  it("formatDeployScopeArtifact: contract-only keeps SKIP=false (not skipImages)", () => {
    const plan = resolveGhcrPlan(["docker/scripts/deploy-droplet.sh"]);
    const a = formatDeployScopeArtifact(plan);
    assert.equal(a.skipImages, true);
    assert.equal(a.deploySkip, false);
    assert.match(a.envText, /^SKIP=false$/m);
    assert.match(a.envText, /^DEPLOY_SCOPE=custom$/m);
    assert.match(a.envText, /^DEPLOY_SERVICES=.*orchestrator/m);
    assert.doesNotMatch(a.envText, /(?:^|\s)logistics(?:\s|$)/);
    assert.match(a.envText, /^IMAGE_TAG_MODE=floating$/m);
  });

  it("formatDeployScopeArtifact: docs-only SKIP=true + scope skip", () => {
    const plan = resolveGhcrPlan(["docs/CI_CD.md"]);
    const a = formatDeployScopeArtifact(plan);
    assert.equal(a.deploySkip, true);
    assert.match(a.envText, /^SKIP=true$/m);
    assert.match(a.envText, /^DEPLOY_SCOPE=skip$/m);
  });

  it("clinic + compose → clinic image, active recreate, floating tag", () => {
    const plan = resolveGhcrPlan(["era-clinic/foo.ts", "docker-compose.yml"]);
    assert.equal(plan.skipImages, false);
    assert.equal(plan.deploySkip, false);
    assert.deepEqual(plan.services, ["clinic"]);
    assert.equal(plan.deployScope, "custom");
    assert.equal(plan.imageTagMode, "floating");
    assert.match(plan.deployServices, /\bclinic\b/);
    assert.match(plan.deployServices, /\borchestrator\b/);
    assert.equal(plan.deployServices.split(/\s+/).includes("auto-service"), false);
    assert.equal(plan.matrix.length, 1);
  });

  it("treats empty workflow_dispatch as all", () => {
    const plan = resolveGhcrPlan([], { dispatchServices: "" });
    assert.equal(plan.all, true);
    assert.equal(plan.services.length, GHCR_MATRIX.length - 7);
    assert.equal(plan.services.includes("bank"), false);
  });

  it("honours explicit dispatch list", () => {
    const plan = resolveGhcrPlan([], { dispatchServices: "orchestrator,clinic" });
    assert.deepEqual(plan.services, ["orchestrator", "clinic"]);
    assert.equal(plan.deployServices, "orchestrator clinic");
    assert.equal(plan.deployScope, "custom");
  });
});
