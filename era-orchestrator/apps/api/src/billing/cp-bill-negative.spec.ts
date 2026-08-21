import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@era365/database";
import { AccessControlService } from "../access/access-control.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { BillingPlatformService } from "./billing-platform.service";

describe("Platform BILL negative paths (AC-CP-BILL)", () => {
  const orgId = "00000000-0000-4000-8000-000000000001";

  it("assertModuleAccess returns 403 SUBSCRIPTION_MISSING when org has no subscription", async () => {
    const prisma = {
      organizationSubscription: { findUnique: jest.fn().mockResolvedValue(null) },
      organizationModule: { findUnique: jest.fn() },
    };
    const pricing = { isPremiumModuleKey: () => false };
    const svc = new SubscriptionAccessService(prisma as never, pricing as never);
    await expect(svc.assertModuleAccess(orgId, "platform_notifications")).rejects.toMatchObject({
      response: expect.objectContaining({
        statusCode: 403,
        code: "SUBSCRIPTION_MISSING",
      }),
    });
  });

  it("assertUserCanAccessInvoice returns 403 for foreign-org / other-owner invoice", async () => {
    const prisma = {
      subscriptionInvoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: "inv-foreign",
          userId: "owner-other",
          items: [],
        }),
      },
    };
    const svc = new BillingPlatformService(
      prisma as never,
      {} as never,
      {} as never,
    );
    await expect(
      svc.assertUserCanAccessInvoice("owner-self", "inv-foreign"),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "BILLING_INVOICE_ACCESS",
      }),
    });
    await expect(
      svc.assertUserCanAccessInvoice("owner-self", "inv-foreign"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("assertOwnerForBilling returns 403 when membership is not OWNER", async () => {
    const prisma = {
      organizationMembership: {
        findUnique: jest.fn().mockResolvedValue({
          userId: "u1",
          organizationId: orgId,
          role: UserRole.ACCOUNTANT,
        }),
      },
    };
    const access = new AccessControlService(prisma as never);
    await expect(access.assertOwnerForBilling("u1", orgId)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "BILLING_OWNER_ONLY",
      }),
    });
  });
});
