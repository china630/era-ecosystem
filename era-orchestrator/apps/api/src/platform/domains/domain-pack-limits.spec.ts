import {
  assertDomainPackDowngradeAllowed,
  assertSatelliteLoginHostCreateAllowed,
  resolveDomainEntitlements,
} from "./domain-pack-limits";

describe("domain pack limits", () => {
  it("resolves domain entitlements from active modules", () => {
    expect(resolveDomainEntitlements(["platform_domain"])).toEqual({
      hasBasic: true,
      hasOrgPack: false,
    });
    expect(resolveDomainEntitlements(["platform_domain_org", "nas"])).toEqual({
      hasBasic: false,
      hasOrgPack: true,
    });
  });

  it("rejects second satellite_login host on basic pack", async () => {
    const db = {
      platformCustomDomain: {
        findMany: async () => [{ hostname: "pms.one.az", satelliteKey: "industry_hotel_pms" }],
      },
    };
    await expect(
      assertSatelliteLoginHostCreateAllowed(
        db,
        "org-1",
        "industry_clinic",
        { hasBasic: true, hasOrgPack: false },
      ),
    ).rejects.toThrow(/org pack/i);
  });

  it("allows one host per satelliteKey on org pack", async () => {
    const db = {
      platformCustomDomain: {
        findMany: async () => [{ hostname: "pms.one.az", satelliteKey: "industry_hotel_pms" }],
      },
    };
    await expect(
      assertSatelliteLoginHostCreateAllowed(
        db,
        "org-1",
        "industry_clinic",
        { hasBasic: false, hasOrgPack: true },
      ),
    ).resolves.toBeUndefined();

    await expect(
      assertSatelliteLoginHostCreateAllowed(
        db,
        "org-1",
        "industry_hotel_pms",
        { hasBasic: false, hasOrgPack: true },
      ),
    ).rejects.toThrow(/already exists/i);
  });

  it("rejects org pack downgrade with multiple ACTIVE login hosts", async () => {
    const db = {
      platformCustomDomain: {
        findMany: async () => [
          { hostname: "pms.one.az" },
          { hostname: "clinic.two.az" },
        ],
      },
    };
    await expect(assertDomainPackDowngradeAllowed(db, "org-1")).rejects.toThrow(
      /Cannot downgrade/i,
    );
  });
});
