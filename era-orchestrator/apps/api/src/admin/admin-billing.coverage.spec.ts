import { BadRequestException } from "@nestjs/common";
import { BillingStatus } from "@era365/database";
import { addBakuDays, todayBakuYmd } from "@era/satellite-kit/time";
import { AdminBillingService } from "./admin-billing.service";

describe("AdminBillingService.setBillingCoverage", () => {
  const orgId = "6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b";

  function setup(opts: { hasSubscription: boolean; status?: BillingStatus }) {
    const tx = {
      organizationSubscription: { update: jest.fn(), create: jest.fn() },
      organization: { update: jest.fn() },
      tenantBilling: { updateMany: jest.fn() },
      platformAuditLog: { create: jest.fn() },
    };
    const prisma = {
      organization: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: orgId,
            billingStatus: opts.status ?? BillingStatus.HARD_BLOCK,
            subscription: opts.hasSubscription ? { id: "s1" } : null,
          })
          .mockResolvedValue({
            billingStatus: BillingStatus.ACTIVE,
            subscription: { expiresAt: null, billingCoveredUntil: null },
          }),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const svc = new AdminBillingService(prisma as never, {} as never, {} as never);
    return { svc, tx };
  }

  it("sets expiresAt + billingCoveredUntil and lifts HARD_BLOCK on both status rows", async () => {
    const { svc, tx } = setup({ hasSubscription: true });
    const ymd = addBakuDays(todayBakuYmd(), 30);
    await svc.setBillingCoverage(orgId, ymd, "admin-1");

    const subData = tx.organizationSubscription.update.mock.calls[0][0].data;
    expect(subData.billingCoveredUntil).toBeInstanceOf(Date);
    expect(subData.expiresAt).toEqual(subData.billingCoveredUntil);
    expect(tx.organization.update).toHaveBeenCalledWith({
      where: { id: orgId },
      data: { billingStatus: BillingStatus.ACTIVE },
    });
    expect(tx.tenantBilling.updateMany).toHaveBeenCalledWith({
      where: { organizationId: orgId },
      data: { billingStatus: BillingStatus.ACTIVE },
    });
    expect(tx.platformAuditLog.create.mock.calls[0][0].data.action).toBe(
      "BILLING_COVERAGE_SET",
    );
  });

  it("creates the subscription row when missing", async () => {
    const { svc, tx } = setup({ hasSubscription: false });
    await svc.setBillingCoverage(orgId, addBakuDays(todayBakuYmd(), 1), null);
    expect(tx.organizationSubscription.create).toHaveBeenCalled();
    expect(tx.organization.update).toHaveBeenCalled();
  });

  it("rejects a past day", async () => {
    const { svc, tx } = setup({ hasSubscription: true });
    await expect(
      svc.setBillingCoverage(orgId, addBakuDays(todayBakuYmd(), -1), null),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.organization.update).not.toHaveBeenCalled();
  });

  it("clearing coverage leaves billing status untouched", async () => {
    const { svc, tx } = setup({ hasSubscription: true, status: BillingStatus.ACTIVE });
    await svc.setBillingCoverage(orgId, null, "admin-1");
    expect(tx.organizationSubscription.update).toHaveBeenCalledWith({
      where: { organizationId: orgId },
      data: { billingCoveredUntil: null },
    });
    expect(tx.organization.update).not.toHaveBeenCalled();
    expect(tx.tenantBilling.updateMany).not.toHaveBeenCalled();
  });
});
