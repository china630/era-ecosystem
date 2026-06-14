import { TrialEntitlementResolver } from "./trial-entitlement.resolver";

describe("TrialEntitlementResolver", () => {
  const prisma = {
    organizationSubscription: { findUnique: jest.fn() },
    organizationModule: { findUnique: jest.fn() },
    organizationSatelliteEntitlement: { findUnique: jest.fn(), findMany: jest.fn() },
    pricingModule: { findUnique: jest.fn(), findMany: jest.fn() },
    satellite: { findMany: jest.fn() },
  };

  function resolver() {
    return new TrialEntitlementResolver(prisma as never);
  }

  beforeEach(() => jest.resetAllMocks());

  it("resolveSatelliteKeyForModule maps industry gate to itself", async () => {
    prisma.pricingModule.findUnique.mockResolvedValue({
      satelliteKey: null,
      catalogKind: "SATELLITE",
    });
    await expect(
      resolver().resolveSatelliteKeyForModule("industry_hotel_pms"),
    ).resolves.toBe("industry_hotel_pms");
  });

  it("resolveSatelliteKeyForModule maps finance slug to finance_core", async () => {
    prisma.pricingModule.findUnique.mockResolvedValue({
      satelliteKey: "finance_core",
      catalogKind: "MODULE",
    });
    await expect(resolver().resolveSatelliteKeyForModule("nas")).resolves.toBe(
      "finance_core",
    );
  });
});
