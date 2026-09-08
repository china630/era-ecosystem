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
  resolveHotelModuleKey,
  IndustryModuleInactiveError,
  runCronForEachTenant,
  requireSatelliteModule,
} from "./org-entitlement-gate.js";
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
    assert.equal(isClinicModuleActive(["clinic_registry_emr"], "clinic_patients"), true);
    assert.equal(isClinicModuleActive(["clinic_inpatient"], "clinic_sanatorium_clinical"), true);
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
  const prevCronIds = process.env.ERA_CRON_ORGANIZATION_IDS;
  const prevUnlock = process.env.ERA_DEV_UNLOCK_ALL_MODULES;
  const prevSecret = process.env.PLATFORM_CRON_SECRET;

  beforeEach(() => {
    process.env.ERA_DEV_UNLOCK_ALL_MODULES = "1";
    delete process.env.PLATFORM_CRON_SECRET;
  });

  afterEach(() => {
    if (prevCronIds === undefined) delete process.env.ERA_CRON_ORGANIZATION_IDS;
    else process.env.ERA_CRON_ORGANIZATION_IDS = prevCronIds;
    if (prevUnlock === undefined) delete process.env.ERA_DEV_UNLOCK_ALL_MODULES;
    else process.env.ERA_DEV_UNLOCK_ALL_MODULES = prevUnlock;
    if (prevSecret === undefined) delete process.env.PLATFORM_CRON_SECRET;
    else process.env.PLATFORM_CRON_SECRET = prevSecret;
  });

  it("runs work once per ERA_CRON_ORGANIZATION_IDS with ALS bound", async () => {
    const orgA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const orgB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    process.env.ERA_CRON_ORGANIZATION_IDS = `${orgA},${orgB}`;

    const seen: string[] = [];
    const gate = await runCronForEachTenant({}, async (organizationId) => {
      seen.push(organizationId);
      assert.equal(resolveSatelliteTenantOrgId(), organizationId);
      return { organizationId, ok: true };
    });

    assert.equal(gate.ok, true);
    if (!gate.ok) return;
    assert.deepEqual(seen, [orgA, orgB]);
    assert.deepEqual(gate.results, [
      { organizationId: orgA, ok: true },
      { organizationId: orgB, ok: true },
    ]);
  });

  it("returns 401 when cron secret configured and Authorization missing", async () => {
    process.env.ERA_CRON_ORGANIZATION_IDS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    process.env.PLATFORM_CRON_SECRET = "cron-secret";
    const gate = await runCronForEachTenant({}, async () => ({ ok: true }));
    assert.equal(gate.ok, false);
    if (gate.ok) return;
    assert.equal(gate.status, 401);
  });

  it("uses listOrganizationIds when ERA_CRON_ORGANIZATION_IDS unset", async () => {
    delete process.env.ERA_CRON_ORGANIZATION_IDS;
    const orgA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const orgB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const seen: string[] = [];
    const gate = await runCronForEachTenant(
      {
        listOrganizationIds: async () => [orgA, orgB, orgA],
      },
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

  it("env ERA_CRON_ORGANIZATION_IDS wins over listOrganizationIds", async () => {
    const orgEnv = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const orgDiscover = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    process.env.ERA_CRON_ORGANIZATION_IDS = orgEnv;
    const seen: string[] = [];
    const gate = await runCronForEachTenant(
      {
        listOrganizationIds: async () => [orgDiscover],
      },
      async (organizationId) => {
        seen.push(organizationId);
        return { organizationId };
      },
    );
    assert.equal(gate.ok, true);
    if (!gate.ok) return;
    assert.deepEqual(seen, [orgEnv]);
  });

  it("fetchPoolOrganizationIds wins over listOrganizationIds when env unset", async () => {
    delete process.env.ERA_CRON_ORGANIZATION_IDS;
    const orgPool = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const orgDiscover = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const seen: string[] = [];
    const gate = await runCronForEachTenant(
      {
        fetchPoolOrganizationIds: async () => [orgPool],
        listOrganizationIds: async () => [orgDiscover],
      },
      async (organizationId) => {
        seen.push(organizationId);
        return { organizationId };
      },
    );
    assert.equal(gate.ok, true);
    if (!gate.ok) return;
    assert.deepEqual(seen, [orgPool]);
  });

  it("empty listOrganizationIds falls back to process bind", async () => {
    delete process.env.ERA_CRON_ORGANIZATION_IDS;
    const bound = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    process.env.ERA_SATELLITE_ORGANIZATION_ID = bound;
    try {
      const seen: string[] = [];
      const gate = await runCronForEachTenant(
        {
          listOrganizationIds: async () => [],
        },
        async (organizationId) => {
          seen.push(organizationId);
          return { organizationId };
        },
      );
      assert.equal(gate.ok, true);
      if (!gate.ok) return;
      assert.deepEqual(seen, [bound]);
    } finally {
      delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    }
  });
});
