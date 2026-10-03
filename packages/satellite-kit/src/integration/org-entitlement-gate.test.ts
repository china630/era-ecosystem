import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  INDUSTRY_MODULE_BY_APP,
  INDUSTRY_MODULE_KEY_ALIASES,
  resolveIndustryModuleKey,
  resolveEntitlementActiveModules,
  isHotelModuleActive,
  isClinicModuleActive,
  resolveClinicModuleForPathname,
  resolveHotelModuleKey,
  IndustryModuleInactiveError,
  runCronForEachTenant,
  requireSatelliteModule,
  setCronPoolRetryDelaysForTests,
} from "./org-entitlement-gate.js";
import {
  fetchPoolOrganizationIdsFromOrch,
  SatellitePoolRegistryError,
} from "./fetch-pool-organization-ids.js";
import { resolveSatelliteTenantOrgId, runWithSatelliteTenant } from "../tenancy/satellite-tenant-context.js";
import {
  applySatelliteRuntimeConfig,
  resetRuntimeConfigForTests,
} from "../tenancy/runtime-config-core.js";
import { resetOrganizationBindForTests } from "../tenancy/organization-bind-core.js";

describe("industry module key aliases", () => {
  it("maps legacy industry slugs to canonical", () => {
    assert.equal(resolveIndustryModuleKey("industry_fb_pos"), "industry_fnb_pos");
    assert.equal(resolveIndustryModuleKey("industry_retail_ecom"), "industry_retail");
    assert.equal(INDUSTRY_MODULE_BY_APP.fb, "industry_fnb_pos");
    assert.equal(INDUSTRY_MODULE_BY_APP.retail, "industry_retail");
    assert.equal(INDUSTRY_MODULE_KEY_ALIASES.industry_auto_sto, "industry_auto_service");
  });

  it("resolves hotel legacy aliases", () => {
    assert.equal(resolveHotelModuleKey("hotel_channel_ota"), "hotel_distribution");
    assert.equal(
      isHotelModuleActive(["hotel_distribution"], "hotel_channel_ota"),
      true,
    );
  });

  it("checks clinic module presence", () => {
    assert.equal(isClinicModuleActive(["clinic_lab"], "clinic_lab"), true);
    assert.equal(isClinicModuleActive(["clinic_lab"], "clinic_inpatient"), false);
    assert.equal(isClinicModuleActive(["clinic_registry_emr"], "clinic_registry_emr"), true);
    assert.equal(isClinicModuleActive(["clinic_inpatient"], "clinic_sanatorium"), false);
  });

  it("maps paid clinic routes and leaves schedule on the gate", () => {
    assert.equal(resolveClinicModuleForPathname("/api/patients"), "clinic_registry_emr");
    assert.equal(
      resolveClinicModuleForPathname("/api/appointments/apt_1/reschedule"),
      "clinic_registry_emr",
    );
    assert.equal(resolveClinicModuleForPathname("/api/appointments"), null);
    assert.equal(resolveClinicModuleForPathname("/api/lab/import"), "clinic_lab");
    assert.equal(resolveClinicModuleForPathname("/api/insurance/check"), "clinic_insurance");
    assert.equal(
      resolveClinicModuleForPathname("/api/sanatorium/nurse-roster"),
      "clinic_nurse_roster",
    );
    assert.equal(resolveClinicModuleForPathname("/api/sanatorium/episodes"), "clinic_sanatorium");
    assert.equal(resolveClinicModuleForPathname("/api/admin/wards"), "clinic_inpatient");
    assert.equal(resolveClinicModuleForPathname("/api/admin/catalog"), null);
    assert.equal(resolveClinicModuleForPathname("/portal"), "platform_portal");
  });
});

describe("resolveEntitlementActiveModules", () => {
  let cfgFile = "";

  beforeEach(() => {
    cfgFile = path.join(os.tmpdir(), `era-runtime-config-test-${process.pid}-${Date.now()}.json`);
    process.env.ERA_RUNTIME_CONFIG_FILE = cfgFile;
    process.env.ERA_ORG_BIND_FILE = path.join(os.tmpdir(), `era-bind-missing-${process.pid}.json`);
    resetRuntimeConfigForTests();
    resetOrganizationBindForTests();
  });

  afterEach(() => {
    try {
      fs.unlinkSync(cfgFile);
    } catch {
      /* missing ok */
    }
    delete process.env.ERA_RUNTIME_CONFIG_FILE;
    delete process.env.ERA_ORG_BIND_FILE;
    resetRuntimeConfigForTests();
    resetOrganizationBindForTests();
  });

  it("prefers snapshot activeModules", () => {
    const active = resolveEntitlementActiveModules({
      activeModules: ["industry_clinic", "clinic_lab"],
    });
    assert.deepEqual(active, ["industry_clinic", "clinic_lab"]);
  });

  it("falls back to runtime-config cache when snapshot null", async () => {
    await applySatelliteRuntimeConfig({
      config: { activeModules: ["industry_hotel_pms", "hotel_core"] },
      updatedBy: "test",
    });
    const active = resolveEntitlementActiveModules(null);
    assert.deepEqual(active, ["industry_hotel_pms", "hotel_core"]);
  });

  it("returns null when no snapshot and no cache (fail-closed)", () => {
    assert.equal(resolveEntitlementActiveModules(null), null);
  });

  it("requireSatelliteModule uses request ALS when process bind is fallback", async () => {
    const prevOrg = process.env.ERA_SATELLITE_ORGANIZATION_ID;
    const prevUnlock = process.env.ERA_DEV_UNLOCK_ALL_MODULES;
    const prevOrch = process.env.ORCHESTRATOR_EVENT_URL;
    delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    delete process.env.ERA_DEV_UNLOCK_ALL_MODULES;
    delete process.env.ORCHESTRATOR_EVENT_URL;
    try {
      await applySatelliteRuntimeConfig({
        config: { activeModules: ["industry_hotel_pms", "hotel_core"] },
        updatedBy: "test",
      });
      await runWithSatelliteTenant(
        { organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        async () => {
          await requireSatelliteModule("industry_hotel_pms");
        },
      );
    } finally {
      if (prevOrg === undefined) delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
      else process.env.ERA_SATELLITE_ORGANIZATION_ID = prevOrg;
      if (prevUnlock === undefined) delete process.env.ERA_DEV_UNLOCK_ALL_MODULES;
      else process.env.ERA_DEV_UNLOCK_ALL_MODULES = prevUnlock;
      if (prevOrch === undefined) delete process.env.ORCHESTRATOR_EVENT_URL;
      else process.env.ORCHESTRATOR_EVENT_URL = prevOrch;
    }
  });

  it("requireSatelliteModule throws on fallback without ALS", async () => {
    const prevOrg = process.env.ERA_SATELLITE_ORGANIZATION_ID;
    const prevUnlock = process.env.ERA_DEV_UNLOCK_ALL_MODULES;
    delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    delete process.env.ERA_DEV_UNLOCK_ALL_MODULES;
    try {
      await assert.rejects(
        () => requireSatelliteModule("industry_clinic"),
        (err: unknown) =>
          err instanceof IndustryModuleInactiveError &&
          err.moduleKey === "industry_clinic",
      );
    } finally {
      if (prevOrg === undefined) delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
      else process.env.ERA_SATELLITE_ORGANIZATION_ID = prevOrg;
      if (prevUnlock === undefined) delete process.env.ERA_DEV_UNLOCK_ALL_MODULES;
      else process.env.ERA_DEV_UNLOCK_ALL_MODULES = prevUnlock;
    }
  });

  it("requireSatelliteModule ignores a bound process org without ALS", async () => {
    const prevOrg = process.env.ERA_SATELLITE_ORGANIZATION_ID;
    const prevUnlock = process.env.ERA_DEV_UNLOCK_ALL_MODULES;
    const prevOrch = process.env.ORCHESTRATOR_EVENT_URL;
    process.env.ERA_SATELLITE_ORGANIZATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    delete process.env.ERA_DEV_UNLOCK_ALL_MODULES;
    delete process.env.ORCHESTRATOR_EVENT_URL;
    try {
      await applySatelliteRuntimeConfig({
        config: { activeModules: ["industry_hotel_pms", "hotel_core"] },
        updatedBy: "test",
      });
      await assert.rejects(
        () => requireSatelliteModule("industry_hotel_pms"),
        (err: unknown) =>
          err instanceof IndustryModuleInactiveError &&
          err.moduleKey === "industry_hotel_pms",
      );
    } finally {
      if (prevOrg === undefined) delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
      else process.env.ERA_SATELLITE_ORGANIZATION_ID = prevOrg;
      if (prevUnlock === undefined) delete process.env.ERA_DEV_UNLOCK_ALL_MODULES;
      else process.env.ERA_DEV_UNLOCK_ALL_MODULES = prevUnlock;
      if (prevOrch === undefined) delete process.env.ORCHESTRATOR_EVENT_URL;
      else process.env.ORCHESTRATOR_EVENT_URL = prevOrch;
    }
  });

  it("requireSatelliteModule accepts explicit organizationId without ALS", async () => {
    const prevOrg = process.env.ERA_SATELLITE_ORGANIZATION_ID;
    const prevUnlock = process.env.ERA_DEV_UNLOCK_ALL_MODULES;
    const prevOrch = process.env.ORCHESTRATOR_EVENT_URL;
    delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    delete process.env.ERA_DEV_UNLOCK_ALL_MODULES;
    delete process.env.ORCHESTRATOR_EVENT_URL;
    try {
      await applySatelliteRuntimeConfig({
        config: { activeModules: ["industry_hotel_pms", "hotel_core"] },
        updatedBy: "test",
      });
      await requireSatelliteModule("industry_hotel_pms", {
        organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      });
    } finally {
      if (prevOrg === undefined) delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
      else process.env.ERA_SATELLITE_ORGANIZATION_ID = prevOrg;
      if (prevUnlock === undefined) delete process.env.ERA_DEV_UNLOCK_ALL_MODULES;
      else process.env.ERA_DEV_UNLOCK_ALL_MODULES = prevUnlock;
      if (prevOrch === undefined) delete process.env.ORCHESTRATOR_EVENT_URL;
      else process.env.ORCHESTRATOR_EVENT_URL = prevOrch;
    }
  });
});

describe("IndustryModuleInactiveError", () => {
  it("carries 403 status", () => {
    const err = new IndustryModuleInactiveError("clinic_lab");
    assert.equal(err.status, 403);
    assert.equal(err.moduleKey, "clinic_lab");
  });
});

describe("runCronForEachTenant", () => {
  const orgA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const orgB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const bound = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const envKeys = [
    "ERA_DEV_UNLOCK_ALL_MODULES",
    "PLATFORM_CRON_SECRET",
    "ERA_SATELLITE_ORGANIZATION_ID",
    "ERA_RUNTIME_CONFIG_FILE",
    "ERA_ORG_BIND_FILE",
    "ORCHESTRATOR_EVENT_URL",
    "ORCHESTRATOR_URL",
    "CONTROL_PLANE_URL",
    "SATELLITE_EVENT_SERVICE_TOKEN",
    "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN",
    "CONTROL_PLANE_SERVICE_TOKEN",
    "ERA_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_APP_URL",
  ] as const;
  const prev: Record<string, string | undefined> = {};

  async function setTopology(topology: "SHARED" | "DEDICATED" | "ONPREM") {
    await applySatelliteRuntimeConfig({
      config: { deploymentTopology: topology },
      updatedBy: "test",
    });
  }

  beforeEach(() => {
    for (const k of envKeys) prev[k] = process.env[k];
    for (const k of envKeys) delete process.env[k];
    process.env.ERA_DEV_UNLOCK_ALL_MODULES = "1";
    process.env.ERA_RUNTIME_CONFIG_FILE = path.join(
      os.tmpdir(),
      `era-runtime-config-cron-${process.pid}-${Date.now()}.json`,
    );
    process.env.ERA_ORG_BIND_FILE = path.join(
      os.tmpdir(),
      `era-bind-missing-cron-${process.pid}.json`,
    );
    resetRuntimeConfigForTests();
    resetOrganizationBindForTests();
    setCronPoolRetryDelaysForTests([1, 1]);
  });

  afterEach(() => {
    try {
      fs.unlinkSync(process.env.ERA_RUNTIME_CONFIG_FILE ?? "");
    } catch {
      /* missing ok */
    }
    for (const k of envKeys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
    resetRuntimeConfigForTests();
    resetOrganizationBindForTests();
    setCronPoolRetryDelaysForTests(null);
  });

  it("SHARED: runs work once per registry org with ALS bound", async () => {
    await setTopology("SHARED");
    const seen: string[] = [];
    const gate = await runCronForEachTenant(
      { fetchPoolOrganizationIds: async () => [orgA, orgB, orgA] },
      async (organizationId) => {
        seen.push(organizationId);
        assert.equal(resolveSatelliteTenantOrgId(), organizationId);
        return { organizationId };
      },
    );
    assert.equal(gate.ok, true);
    if (!gate.ok) return;
    assert.deepEqual(seen, [orgA, orgB]);
  });

  it("SHARED: empty registry → 503, work never starts, process bind ignored", async () => {
    await setTopology("SHARED");
    process.env.ERA_SATELLITE_ORGANIZATION_ID = bound;
    let ran = false;
    const gate = await runCronForEachTenant(
      { fetchPoolOrganizationIds: async () => [] },
      async () => {
        ran = true;
        return {};
      },
    );
    assert.equal(ran, false);
    assert.equal(gate.ok, false);
    if (gate.ok) return;
    assert.equal(gate.status, 503);
    assert.equal(gate.reason, "pool_registry_empty");
  });

  it("SHARED: missing fetchPoolOrganizationIds → 503", async () => {
    await setTopology("SHARED");
    process.env.ERA_SATELLITE_ORGANIZATION_ID = bound;
    const gate = await runCronForEachTenant({}, async () => ({}));
    assert.equal(gate.ok, false);
    if (gate.ok) return;
    assert.equal(gate.status, 503);
    assert.equal(gate.reason, "pool_registry_not_configured");
  });

  it("SHARED: retries network drops with backoff, then succeeds", async () => {
    await setTopology("SHARED");
    let calls = 0;
    const gate = await runCronForEachTenant(
      {
        fetchPoolOrganizationIds: async () => {
          calls += 1;
          if (calls < 3) {
            throw new SatellitePoolRegistryError("network_error", "drop", { retryable: true });
          }
          return [orgA];
        },
      },
      async (organizationId) => ({ organizationId }),
    );
    assert.equal(calls, 3);
    assert.equal(gate.ok, true);
  });

  it("SHARED: persistent network drop → 503 after retries", async () => {
    await setTopology("SHARED");
    let calls = 0;
    let ran = false;
    const gate = await runCronForEachTenant(
      {
        fetchPoolOrganizationIds: async () => {
          calls += 1;
          throw new SatellitePoolRegistryError("network_error", "drop", { retryable: true });
        },
      },
      async () => {
        ran = true;
        return {};
      },
    );
    assert.equal(calls, 3);
    assert.equal(ran, false);
    assert.equal(gate.ok, false);
    if (gate.ok) return;
    assert.equal(gate.status, 503);
    assert.equal(gate.reason, "network_error");
  });

  it("SHARED: rejected token is not retried → 503", async () => {
    await setTopology("SHARED");
    let calls = 0;
    const gate = await runCronForEachTenant(
      {
        fetchPoolOrganizationIds: async () => {
          calls += 1;
          throw new SatellitePoolRegistryError("unauthorized", "bad token", { status: 401 });
        },
      },
      async () => ({}),
    );
    assert.equal(calls, 1);
    assert.equal(gate.ok, false);
    if (gate.ok) return;
    assert.equal(gate.status, 503);
    assert.equal(gate.reason, "unauthorized");
  });

  it("SHARED: orch URL / token missing → 503 from strict registry call", async () => {
    await setTopology("SHARED");
    const gate = await runCronForEachTenant(
      {
        fetchPoolOrganizationIds: () =>
          fetchPoolOrganizationIdsFromOrch({ satelliteKey: "industry_clinic" }),
      },
      async () => ({}),
    );
    assert.equal(gate.ok, false);
    if (gate.ok) return;
    assert.equal(gate.status, 503);
    assert.equal(gate.reason, "orch_url_missing");
  });

  for (const topology of ["DEDICATED", "ONPREM"] as const) {
    it(`${topology}: one process org, registry not consulted`, async () => {
      await setTopology(topology);
      process.env.ERA_SATELLITE_ORGANIZATION_ID = bound;
      let registryCalled = false;
      const seen: string[] = [];
      const gate = await runCronForEachTenant(
        {
          fetchPoolOrganizationIds: async () => {
            registryCalled = true;
            return [orgA];
          },
        },
        async (organizationId) => {
          seen.push(organizationId);
          assert.equal(resolveSatelliteTenantOrgId(), organizationId);
          return { organizationId };
        },
      );
      assert.equal(registryCalled, false);
      assert.equal(gate.ok, true);
      assert.deepEqual(seen, [bound]);
    });

    it(`${topology}: no process org → 503`, async () => {
      await setTopology(topology);
      let ran = false;
      const gate = await runCronForEachTenant({}, async () => {
        ran = true;
        return {};
      });
      assert.equal(ran, false);
      assert.equal(gate.ok, false);
      if (gate.ok) return;
      assert.equal(gate.status, 503);
      assert.equal(gate.reason, "satellite_unbound");
    });
  }

  it("returns 401 when cron secret configured and Authorization missing", async () => {
    await setTopology("DEDICATED");
    process.env.ERA_SATELLITE_ORGANIZATION_ID = bound;
    process.env.PLATFORM_CRON_SECRET = "cron-secret";
    const gate = await runCronForEachTenant({}, async () => ({ ok: true }));
    assert.equal(gate.ok, false);
    if (gate.ok) return;
    assert.equal(gate.status, 401);
  });

  it("SHARED: module check runs per registry org (no process org needed)", async () => {
    delete process.env.ERA_DEV_UNLOCK_ALL_MODULES;
    await applySatelliteRuntimeConfig({
      config: { deploymentTopology: "SHARED", activeModules: ["industry_clinic"] },
      updatedBy: "test",
    });
    const seen: string[] = [];
    const gate = await runCronForEachTenant(
      { satelliteKey: "industry_clinic", fetchPoolOrganizationIds: async () => [orgA, orgB] },
      async (organizationId) => {
        seen.push(organizationId);
        return { organizationId };
      },
    );
    assert.equal(gate.ok, true);
    assert.deepEqual(seen, [orgA, orgB]);
  });

  it("SHARED: no listed org has the module → 403, work never starts", async () => {
    delete process.env.ERA_DEV_UNLOCK_ALL_MODULES;
    await applySatelliteRuntimeConfig({
      config: { deploymentTopology: "SHARED", activeModules: ["industry_hotel_pms"] },
      updatedBy: "test",
    });
    let ran = false;
    const gate = await runCronForEachTenant(
      { satelliteKey: "industry_clinic", fetchPoolOrganizationIds: async () => [orgA] },
      async () => {
        ran = true;
        return {};
      },
    );
    assert.equal(ran, false);
    assert.equal(gate.ok, false);
    if (gate.ok) return;
    assert.equal(gate.status, 403);
    assert.equal(gate.reason, "module_inactive");
  });
});

