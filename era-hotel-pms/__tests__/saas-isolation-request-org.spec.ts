/**
 * SaaS isolation — hotel ops stamps use requestOrganizationId (ALS), not process bind.
 */
import { requestOrganizationId, enterRequestTenant } from "@/lib/request-organization";
import {
  enterSatelliteTenant,
  resetSatelliteTenantAlsForTests,
} from "./mocks/satellite-kit";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("saas hotel requestOrganizationId stamps", () => {
  const prevBind = process.env.ERA_SATELLITE_ORGANIZATION_ID;
  const prevSkip = process.env.ERA_SKIP_TENANT_FILTER;

  beforeEach(() => {
    delete process.env.ERA_SKIP_TENANT_FILTER;
    process.env.ERA_SATELLITE_ORGANIZATION_ID = ORG_B;
    resetSatelliteTenantAlsForTests();
  });

  afterEach(() => {
    resetSatelliteTenantAlsForTests();
    if (prevBind === undefined) delete process.env.ERA_SATELLITE_ORGANIZATION_ID;
    else process.env.ERA_SATELLITE_ORGANIZATION_ID = prevBind;
    if (prevSkip === undefined) delete process.env.ERA_SKIP_TENANT_FILTER;
    else process.env.ERA_SKIP_TENANT_FILTER = prevSkip;
  });

  it("without ALS falls back to process bind Org B", () => {
    expect(requestOrganizationId()).toBe(ORG_B);
  });

  it("enterRequestTenant then stamp uses ALS org not bind", () => {
    enterRequestTenant(ORG_A);
    expect(requestOrganizationId()).toBe(ORG_A);
  });

  it("enterSatelliteTenant then stamp uses ALS org", () => {
    enterSatelliteTenant({ organizationId: ORG_A });
    expect(requestOrganizationId()).toBe(ORG_A);
  });
});
