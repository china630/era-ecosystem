import { TariffTier } from "@erafinance/database";
import { BillingMeterService } from "../../src/billing/billing-meter.service";

const ORG_ID = "550e8400-e29b-41d4-a716-446655440000";
const OWNER_ID = "660e8400-e29b-41d4-a716-446655440001";

describe("BillingMeterService.ensureIntradayTierInvoice", () => {
  it("skips when intraday invoice already exists for org and period", async () => {
    const prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ ownerId: OWNER_ID }),
      },
      organizationMembership: { findFirst: jest.fn() },
      subscriptionInvoice: {
        findFirst: jest.fn().mockResolvedValue({ id: "inv-1" }),
        create: jest.fn(),
      },
    };
    const controlPlane = {} as any;
    const systemConfig = {} as any;
    const svc = new BillingMeterService(
      prisma as any,
      controlPlane,
      systemConfig,
    );

    await svc.ensureIntradayTierInvoice(
      ORG_ID,
      TariffTier.TIER_0,
      100,
      105,
    );

    expect(prisma.subscriptionInvoice.create).not.toHaveBeenCalled();
  });

  it("creates ISSUED invoice when none exists", async () => {
    const prisma = {
      organization: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ ownerId: OWNER_ID })
          .mockResolvedValueOnce({ name: "Demo Org" }),
      },
      organizationMembership: { findFirst: jest.fn() },
      subscriptionInvoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "inv-new" }),
      },
    };
    const controlPlane = {} as any;
    const systemConfig = {} as any;
    const svc = new BillingMeterService(
      prisma as any,
      controlPlane,
      systemConfig,
    );

    await svc.ensureIntradayTierInvoice(
      ORG_ID,
      TariffTier.TIER_1,
      500,
      520,
    );

    expect(prisma.subscriptionInvoice.create).toHaveBeenCalledTimes(1);
    const arg = prisma.subscriptionInvoice.create.mock.calls[0][0];
    expect(arg.data.userId).toBe(OWNER_ID);
    expect(arg.data.items.create.organizationId).toBe(ORG_ID);
  });
});
