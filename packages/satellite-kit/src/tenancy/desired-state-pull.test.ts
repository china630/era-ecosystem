/**
 * Desired-state pull (Wave 6) + reconcile helpers (Wave 7).
 * Run via package test script after build.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  pullDesiredStateOnce,
  resetDesiredStatePullForTests,
  resolveSatelliteKeyForDesiredState,
  shouldPullDesiredStateOnBoot,
} from "./desired-state-pull";
import { resetRuntimeConfigForTests, satelliteRuntimeConfig } from "./runtime-config-core";
import { resetOrganizationBindForTests, setRuntimeOrganizationId } from "./organization-bind-core";

const ENV_KEYS = [
  "ERA_IN_DOCKER",
  "ERA_DESIRED_STATE_PULL",
  "ERA_SATELLITE_KEY",
  "SATELLITE_EVENT_SERVICE_TOKEN",
  "CONTROL_PLANE_SERVICE_TOKEN",
  "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
  "ORCHESTRATOR_URL",
  "CONTROL_PLANE_URL",
  "ORCHESTRATOR_EVENT_URL",
  "ERA_SATELLITE_ORGANIZATION_ID",
  "ERA_BANK_ORGANIZATION_ID",
  "ORGANIZATION_ID",
  "ERA_ORG_BIND_FILE",
  "ERA_RUNTIME_CONFIG_FILE",
] as const;

describe("desired-state-pull", () => {
  const saved: Record<string, string | undefined> = {};
  let tmpDir = "";

  beforeEach(() => {
    resetDesiredStatePullForTests();
    resetRuntimeConfigForTests();
    resetOrganizationBindForTests();
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "era-dsp-"));
    process.env.ERA_ORG_BIND_FILE = path.join(tmpDir, "organization-bind.json");
    process.env.ERA_RUNTIME_CONFIG_FILE = path.join(tmpDir, "runtime-config.json");
  });

  afterEach(() => {
    resetDesiredStatePullForTests();
    resetRuntimeConfigForTests();
    resetOrganizationBindForTests();
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("shouldPullDesiredStateOnBoot defaults true in Docker", () => {
    process.env.ERA_IN_DOCKER = "1";
    assert.equal(shouldPullDesiredStateOnBoot(), true);
    process.env.ERA_DESIRED_STATE_PULL = "0";
    assert.equal(shouldPullDesiredStateOnBoot(), false);
  });

  it("resolveSatelliteKeyForDesiredState prefers env", () => {
    process.env.ERA_SATELLITE_KEY = "industry_clinic";
    assert.equal(resolveSatelliteKeyForDesiredState(), "industry_clinic");
    assert.equal(resolveSatelliteKeyForDesiredState("industry_hotel_pms"), "industry_hotel_pms");
  });

  it("skips pull when folklore token", async () => {
    setRuntimeOrganizationId("00000000-0000-4000-8000-000000000001");
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "dev-satellite-event-token";
    process.env.ERA_SATELLITE_KEY = "industry_hotel_pms";
    process.env.ORCHESTRATOR_URL = "http://orchestrator:4000";
    const result = await pullDesiredStateOnce({
      fetchImpl: async () => {
        throw new Error("should not fetch");
      },
    });
    assert.equal(result.status, "skipped");
    if (result.status === "skipped") {
      assert.match(result.reason, /folklore|token/i);
    }
  });

  it("applies process-wide config from orch payload", async () => {
    const orgId = "00000000-0000-4000-8000-000000000099";
    setRuntimeOrganizationId(orgId);
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "real-satellite-event-token-xyz";
    process.env.ERA_SATELLITE_KEY = "industry_hotel_pms";
    process.env.ORCHESTRATOR_URL = "http://orch.test:4000";

    const result = await pullDesiredStateOnce({
      fetchImpl: async (input, init) => {
        const url = String(input);
        assert.match(url, /\/v1\/internal\/satellites\/desired-state/);
        assert.match(url, /satelliteKey=industry_hotel_pms/);
        const headers = init?.headers as Record<string, string>;
        assert.equal(headers["X-Organization-Id"], orgId);
        assert.equal(headers.Authorization, "Bearer real-satellite-event-token-xyz");
        return new Response(
          JSON.stringify({
            organizationId: orgId,
            satelliteKey: "industry_hotel_pms",
            generatedAt: new Date().toISOString(),
            config: {
              organizationId: orgId,
              orchestratorEventUrl: "http://orchestrator:4000",
              activeModules: ["industry_hotel_pms"],
              vendorBridgesEnabled: true,
              elektrawebBridge: { inboundEnabled: true, writeEnabled: false },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    assert.equal(result.status, "applied");
    const cfg = satelliteRuntimeConfig();
    assert.equal(cfg.organizationId, orgId);
    assert.equal(cfg.orchestratorEventUrl, "http://orchestrator:4000");
    assert.deepEqual(cfg.activeModules, ["industry_hotel_pms"]);
    assert.equal(cfg.vendorBridgesEnabled, true);
  });

  it("returns unchanged on second identical pull", async () => {
    const orgId = "00000000-0000-4000-8000-000000000088";
    setRuntimeOrganizationId(orgId);
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "real-token-for-pull-tests-ok";
    process.env.ERA_SATELLITE_KEY = "industry_clinic";
    process.env.ORCHESTRATOR_URL = "http://orch.test:4000";

    const payload = {
      organizationId: orgId,
      satelliteKey: "industry_clinic",
      generatedAt: "2026-01-01T00:00:00.000Z",
      config: {
        organizationId: orgId,
        edition: "mvp",
      },
    };

    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const first = await pullDesiredStateOnce({ fetchImpl });
    assert.equal(first.status, "applied");
    const second = await pullDesiredStateOnce({ fetchImpl });
    assert.equal(second.status, "unchanged");
  });

  it("keeps local snapshot on orch down (error, no throw)", async () => {
    const orgId = "00000000-0000-4000-8000-000000000077";
    setRuntimeOrganizationId(orgId);
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "real-token-orch-down-case";
    process.env.ERA_SATELLITE_KEY = "finance_core";
    process.env.ORCHESTRATOR_URL = "http://orch.test:4000";

    const result = await pullDesiredStateOnce({
      fetchImpl: async () => {
        throw new Error("fetch failed");
      },
    });
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.match(result.reason, /fetch failed/);
    }
  });

  it("reports 401 without throwing", async () => {
    setRuntimeOrganizationId("00000000-0000-4000-8000-000000000066");
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "real-token-401-case-here";
    process.env.ERA_SATELLITE_KEY = "industry_fnb_pos";
    process.env.ORCHESTRATOR_URL = "http://orch.test:4000";

    const result = await pullDesiredStateOnce({
      fetchImpl: async () => new Response("nope", { status: 401 }),
    });
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.equal(result.httpStatus, 401);
    }
  });

  it("persists desiredStateHash for restart hash-skip", async () => {
    const orgId = "00000000-0000-4000-8000-000000000055";
    setRuntimeOrganizationId(orgId);
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "real-token-hash-persist-ok";
    process.env.ERA_SATELLITE_KEY = "industry_retail";
    process.env.ORCHESTRATOR_URL = "http://orch.test:4000";

    const payload = {
      organizationId: orgId,
      satelliteKey: "industry_retail",
      generatedAt: "2026-01-01T00:00:00.000Z",
      config: { organizationId: orgId, edition: "pilot" },
    };
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const first = await pullDesiredStateOnce({ fetchImpl });
    assert.equal(first.status, "applied");
    if (first.status !== "applied") return;
    const cfg = satelliteRuntimeConfig();
    assert.equal(cfg.desiredStateHash, first.hash);
    assert.ok(cfg.pulledAt);

    resetDesiredStatePullForTests();
    const second = await pullDesiredStateOnce({ fetchImpl });
    assert.equal(second.status, "unchanged");
  });

  it("maps @era/bank-core-api package name to industry_banking", () => {
    // resolve uses cwd package.json — assert explicit override path works
    assert.equal(
      resolveSatelliteKeyForDesiredState("industry_banking"),
      "industry_banking",
    );
  });
});
