import { BillingStatus } from "@era365/database";
import { EntitlementsService } from "./entitlements.service";

function serviceWith(status: BillingStatus | null, superAdmin = false) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ isSuperAdmin: superAdmin }) },
    tenantBilling: {
      findUnique: jest.fn().mockResolvedValue(status ? { billingStatus: status } : null),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return new EntitlementsService(prisma as never);
}

const ORG = "6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b";

describe("EntitlementsService.validate", () => {
  it("ACTIVE allows writes", async () => {
    const res = await serviceWith(BillingStatus.ACTIVE).validate({
      organizationId: ORG,
      method: "POST",
      path: "/api/reservations",
    });
    expect(res).toEqual({ allowed: true, billingStatus: "ACTIVE" });
  });

  it("SOFT_BLOCK denies export paths with 402 and allows other writes", async () => {
    const svc = serviceWith(BillingStatus.SOFT_BLOCK);
    const exp = await svc.validate({ organizationId: ORG, method: "GET", path: "/api/reports/export" });
    expect(exp).toMatchObject({ allowed: false, code: "BILLING_SOFT_BLOCK_EXPORTS", httpStatus: 402 });
    const write = await svc.validate({ organizationId: ORG, method: "POST", path: "/api/visits" });
    expect(write.allowed).toBe(true);
  });

  it("SOFT_BLOCK treats satellite report downloads as exports", async () => {
    const svc = serviceWith(BillingStatus.SOFT_BLOCK);
    for (const path of ["/api/reports/pack/download", "/api/reports/daily/xlsx", "/api/menu/export"]) {
      expect(await svc.validate({ organizationId: ORG, method: "GET", path })).toMatchObject({
        allowed: false,
        code: "BILLING_SOFT_BLOCK_EXPORTS",
      });
    }
  });

  it("HARD_BLOCK allows reads and denies writes with 402", async () => {
    const svc = serviceWith(BillingStatus.HARD_BLOCK);
    expect((await svc.validate({ organizationId: ORG, method: "GET", path: "/api/folio" })).allowed).toBe(true);
    expect(
      await svc.validate({ organizationId: ORG, method: "POST", path: "/api/folio/pay" }),
    ).toMatchObject({ allowed: false, code: "BILLING_HARD_BLOCK_READ_ONLY", httpStatus: 402 });
  });

  it("HARD_BLOCK keeps session maintenance and ERA invoice payment open", async () => {
    const svc = serviceWith(BillingStatus.HARD_BLOCK);
    for (const path of ["/api/auth/session/refresh-permissions", "/api/auth/password"]) {
      expect((await svc.validate({ organizationId: ORG, method: "POST", path })).allowed).toBe(true);
    }
    expect(
      (await svc.validate({ organizationId: ORG, method: "POST", path: "/api/billing/checkout" })).allowed,
    ).toBe(true);
  });

  it("normalizes satellite paths without the /api prefix", async () => {
    const res = await serviceWith(BillingStatus.HARD_BLOCK).validate({
      organizationId: ORG,
      method: "PATCH",
      path: "/front-desk",
    });
    expect(res.allowed).toBe(false);
  });

  it("super-admin from DB bypasses the block", async () => {
    const res = await serviceWith(BillingStatus.HARD_BLOCK, true).validate({
      organizationId: ORG,
      userId: "u1",
      method: "POST",
      path: "/api/folio/pay",
    });
    expect(res.allowed).toBe(true);
  });
});
