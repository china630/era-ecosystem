/**
 * SaaS Wave 8 — EW ingest stamps use ALS, not process bind.
 * Uses hotel jest kit mock (same module instance as bridge config).
 */
import {
  bridgeRequestOrganizationId,
  enterBridgeTenant,
} from "@/lib/integration/elektraweb-bridge/config";
import { resetSatelliteTenantAlsForTests } from "./mocks/satellite-kit";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("saas wave 8 bridge ALS stamps", () => {
  const prevBind = process.env.ERA_SATELLITE_ORGANIZATION_ID;

  beforeEach(() => {
    process.env.ERA_SATELLITE_ORGANIZATION_ID = ORG_B;
    resetSatelliteTenantAlsForTests();
  });

  afterEach(() => {
    resetSatelliteTenantAlsForTests();
    if (prevBind === undefined) delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    else process.env.ERA_SATELLITE_ORGANIZATION_ID = prevBind;
  });

  it("without ALS falls back to process bind Org B", () => {
    expect(bridgeRequestOrganizationId()).toBe(ORG_B);
  });

  it("enterBridgeTenant then stamp helper uses JWT org not bind", () => {
    expect(process.env.ERA_SATELLITE_ORGANIZATION_ID).toBe(ORG_B);
    enterBridgeTenant(ORG_A);
    expect(bridgeRequestOrganizationId()).toBe(ORG_A);
  });
});
