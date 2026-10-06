import { ConfigService } from "@nestjs/config";
import {
  referralCommissionTierRate,
  ReferralsService,
} from "./referrals.service";

describe("referralCommissionTierRate", () => {
  it("returns 10% below 10 referred orgs", () => {
    expect(referralCommissionTierRate(0)).toBe(10);
    expect(referralCommissionTierRate(9)).toBe(10);
  });
  it("returns 15% from 10 to 49", () => {
    expect(referralCommissionTierRate(10)).toBe(15);
    expect(referralCommissionTierRate(49)).toBe(15);
  });
  it("returns 20% from 50 upward", () => {
    expect(referralCommissionTierRate(50)).toBe(20);
    expect(referralCommissionTierRate(100)).toBe(20);
  });
});

describe("ReferralsService.accrueCommissionsForSubscriptionInvoice", () => {
  it("sums every invoice line for the org into one commission", async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      billingInvoiceItem: {
        findMany: jest.fn().mockResolvedValue([
          { id: "1", organizationId: "org-1", amount: 29 },
          { id: "2", organizationId: "org-1", amount: 39 },
          { id: "3", organizationId: "org-1", amount: 19 },
        ]),
      },
      referral: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ref-1",
          isActive: true,
          windowEndsAt: new Date("2099-01-01T00:00:00.000Z"),
          partnerId: "p1",
          partner: { fixedRatePercent: null },
        }),
        count: jest.fn().mockResolvedValue(1),
      },
      referralCommission: { upsert },
    };
    const config = { get: jest.fn() } as unknown as ConfigService;
    const svc = new ReferralsService(prisma as never, config);
    await svc.accrueCommissionsForSubscriptionInvoice("inv-1", "2026-06");
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0][0] as {
      create: { amountAzn: { toString(): string }; ratePercent: { toString(): string } };
    };
    expect(Number(arg.create.amountAzn.toString())).toBeCloseTo(8.7);
    expect(Number(arg.create.ratePercent.toString())).toBe(10);
  });
});

describe("ReferralsService.deactivateExpiredReferrals", () => {
  it("calls updateMany with windowEndsAt lt now", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = { referral: { updateMany } } as never;
    const config = { get: jest.fn() } as unknown as ConfigService;
    const svc = new ReferralsService(prisma, config);
    const now = new Date("2026-06-01T00:00:00.000Z");
    const n = await svc.deactivateExpiredReferrals(now);
    expect(n).toBe(3);
    expect(updateMany).toHaveBeenCalledWith({
      where: { isActive: true, windowEndsAt: { lt: now } },
      data: { isActive: false },
    });
  });
});
