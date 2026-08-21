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
} from "./org-entitlement-gate.js";
import {
  applySatelliteRuntimeConfig,
  resetRuntimeConfigForTests,
} from "../tenancy/runtime-config-core.js";

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
  });
});

describe("resolveEntitlementActiveModules", () => {
  let cfgFile = "";

  beforeEach(() => {
    cfgFile = path.join(os.tmpdir(), `era-runtime-config-test-${process.pid}-${Date.now()}.json`);
    process.env.ERA_RUNTIME_CONFIG_FILE = cfgFile;
    resetRuntimeConfigForTests();
  });

  afterEach(() => {
    try {
      fs.unlinkSync(cfgFile);
    } catch {
      /* missing ok */
    }
    delete process.env.ERA_RUNTIME_CONFIG_FILE;
    resetRuntimeConfigForTests();
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
});

describe("IndustryModuleInactiveError", () => {
  it("carries 403 status", () => {
    const err = new IndustryModuleInactiveError("clinic_lab");
    assert.equal(err.status, 403);
    assert.equal(err.moduleKey, "clinic_lab");
  });
});
