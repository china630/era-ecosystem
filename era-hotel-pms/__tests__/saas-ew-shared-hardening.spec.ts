/**
 * EW drain / HOTELID isolation regressions (SHARED pool).
 */
import {
  assertHotelIdMatchesPolicy,
  enterBridgeTenant,
  bridgeRequestOrganizationId,
} from "@/lib/integration/elektraweb-bridge/config";
import { resetSatelliteTenantAlsForTests } from "./mocks/satellite-kit";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("saas EW SHARED hardening", () => {
  beforeEach(() => {
    resetSatelliteTenantAlsForTests();
    process.env.ERA_SATELLITE_ORGANIZATION_ID =
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  });

  afterEach(() => {
    resetSatelliteTenantAlsForTests();
  });

  it("assertHotelIdMatchesPolicy throws on mismatch", () => {
    expect(() =>
      assertHotelIdMatchesPolicy(
        {
          organizationId: ORG_A,
          elektrawebHotelId: 100,
        } as never,
        999,
      ),
    ).toThrow(/HOTELID mismatch/);
  });

  it("assertHotelIdMatchesPolicy accepts matching hotel id", () => {
    expect(() =>
      assertHotelIdMatchesPolicy(
        {
          organizationId: ORG_A,
          elektrawebHotelId: 42,
        } as never,
        42,
      ),
    ).not.toThrow();
  });

  it("drain tenant comes from ALS after enterBridgeTenant", () => {
    enterBridgeTenant(ORG_A);
    expect(bridgeRequestOrganizationId()).toBe(ORG_A);
  });
});
