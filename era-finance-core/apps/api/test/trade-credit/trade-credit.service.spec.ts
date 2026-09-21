import {
  BadRequestException,
  ConflictException,
  HttpStatus,
} from "@nestjs/common";
import {
  InvoiceStatus,
  TradeCreditFacilityStatus,
  TradeCreditGrantStatus,
} from "@erafinance/database";
import { TradeCreditService, hashGrantCode } from "../../src/trade-credit/trade-credit.service";
import { TradeCreditRequiredException } from "../../src/trade-credit/trade-credit-required.exception";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { SubscriptionAccessService } from "../../src/subscription/subscription-access.service";
import type { TradeCreditPolicyService } from "../../src/trade-credit/trade-credit-policy.service";
import { DEFAULT_ORG_TRADE_CREDIT_POLICY } from "../../src/trade-credit/trade-credit-policy.types";

describe("TradeCreditService (Phase 0)", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const cpId = "22222222-2222-4222-8222-222222222222";
  const facilityId = "33333333-3333-4333-8333-333333333333";

  function makePolicyMock(): TradeCreditPolicyService {
    return {
      effectiveGroup: jest.fn().mockReturnValue(null),
      getOrgPolicyDefaults: jest
        .fn()
        .mockResolvedValue(DEFAULT_ORG_TRADE_CREDIT_POLICY),
      buildFeatures: jest.fn().mockResolvedValue({
        maxDpd: 0,
        avgDpd: 0,
        overdueShare: 0,
        partialPayRatio: 0,
        turnoverTrend: 0,
        utilization: 0,
        paidInvoiceCount: 10,
        openAr: 0,
        creditLimit: 1000,
      weightedAvgDpd: 0,
      turnoverTrendYoy: null,
      maxOpenRemainder: 0,
      concentration: 0,
      recognizedLast90: 0,
      recognizedSame90LastYear: 0,
      paymentTermsDays: 30,
      enrichAt: null,
      enrichStale: false,
      }),
      scheduleReclassify: jest.fn(),
    } as unknown as TradeCreditPolicyService;
  }

  function makeSvc(opts?: {
    hasModule?: boolean;
    facility?: {
      id: string;
      creditLimit: number;
      stopList: boolean;
      status: TradeCreditFacilityStatus;
    } | null;
    invoices?: Array<{ totalAmount: number; paidAmount: number }>;
    issuedGrants?: Array<{ amount: number; expiresAt: Date }>;
  }) {
    const hasModule = opts?.hasModule ?? true;
    const facility =
      opts?.facility === undefined
        ? {
            id: facilityId,
            creditLimit: 1000,
            stopList: false,
            status: TradeCreditFacilityStatus.ACTIVE,
          }
        : opts.facility;
    const invoices = opts?.invoices ?? [];
    const issuedGrants = opts?.issuedGrants ?? [];

    const tradeCreditGrant = {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockImplementation(async (args: {
        where?: { status?: TradeCreditGrantStatus };
        select?: { amount?: boolean };
      }) => {
        if (args?.select?.amount) {
          return issuedGrants.map((g) => ({ amount: g.amount }));
        }
        return [];
      }),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const tradeCreditFacilityFindFirst = jest.fn().mockResolvedValue(
      facility
        ? {
            id: facility.id,
            organizationId: orgId,
            counterpartyId: cpId,
            creditLimit: facility.creditLimit,
            stopList: facility.stopList,
            status: facility.status,
            policyGroup: null,
            policyGroupManual: null,
          }
        : null,
    );

    const prisma = {
      counterparty: {
        findFirst: jest.fn().mockResolvedValue({ id: cpId }),
      },
      tradeCreditFacility: {
        findUnique: jest.fn().mockResolvedValue(
          facility
            ? {
                id: facility.id,
                organizationId: orgId,
                counterpartyId: cpId,
                creditLimit: facility.creditLimit,
                stopList: facility.stopList,
                status: facility.status,
                policyGroup: null,
                policyGroupManual: null,
                policyReasonsJson: null,
                proposedLimit: null,
                proposedAt: null,
                limitBeforeBlock: null,
                autoRaiseMuted: false,
              }
            : null,
        ),
        findFirst: tradeCreditFacilityFindFirst,
        upsert: jest.fn(),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue(
          invoices.map((i) => ({
            totalAmount: i.totalAmount,
            paidAmount: i.paidAmount,
            status: InvoiceStatus.SENT,
          })),
        ),
      },
      tradeCreditGrant,
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          tradeCreditGrant,
          tradeCreditFacility: {
            findFirst: tradeCreditFacilityFindFirst,
          },
        }),
      ),
    } as unknown as PrismaService;

    const subscription = {
      hasModule: jest.fn().mockResolvedValue(hasModule),
    } as unknown as SubscriptionAccessService;

    const policy = makePolicyMock();
    const svc = new TradeCreditService(prisma, subscription, policy, {
      maybeNotifyGrantExpired: jest.fn(),
    } as never);
    return { svc, prisma, subscription, tradeCreditGrant, policy };
  }

  it("computes available = max(0, limit - openAr - unusedIssuedGrants)", async () => {
    const { svc } = makeSvc({
      invoices: [
        { totalAmount: 400, paidAmount: 100 },
        { totalAmount: 50, paidAmount: 50 },
      ],
      issuedGrants: [{ amount: 200, expiresAt: new Date(Date.now() + 3600_000) }],
    });

    const view = await svc.getFacilityView(orgId, cpId);
    expect(view.openAr).toBe(300);
    expect(view.unusedIssuedGrants).toBe(200);
    expect(view.available).toBe(500);
    expect(view).not.toHaveProperty("policyGroup");
  });

  it("returns available 0 when stopList or DISABLED", async () => {
    const stopped = makeSvc({
      facility: {
        id: facilityId,
        creditLimit: 5000,
        stopList: true,
        status: TradeCreditFacilityStatus.ACTIVE,
      },
    });
    expect((await stopped.svc.getFacilityView(orgId, cpId)).available).toBe(0);

    const disabled = makeSvc({
      facility: {
        id: facilityId,
        creditLimit: 5000,
        stopList: false,
        status: TradeCreditFacilityStatus.DISABLED,
      },
    });
    expect((await disabled.svc.getFacilityView(orgId, cpId)).available).toBe(0);
  });

  it("issue refuses over residual without override", async () => {
    const { svc, tradeCreditGrant } = makeSvc({
      invoices: [{ totalAmount: 800, paidAmount: 0 }],
    });
    tradeCreditGrant.create.mockResolvedValue({});

    await expect(
      svc.issueGrant({
        organizationId: orgId,
        counterpartyId: cpId,
        amount: 250,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tradeCreditGrant.create).not.toHaveBeenCalled();
  });

  it("override without reason when amount > available → BadRequest", async () => {
    const { svc, tradeCreditGrant } = makeSvc({
      invoices: [{ totalAmount: 800, paidAmount: 0 }],
    });
    tradeCreditGrant.create.mockResolvedValue({});

    await expect(
      svc.issueGrant({
        organizationId: orgId,
        counterpartyId: cpId,
        amount: 250,
        override: true,
        reason: "ab",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tradeCreditGrant.create).not.toHaveBeenCalled();
  });

  it("issue allows over residual with override + reason", async () => {
    const { svc, tradeCreditGrant } = makeSvc({
      invoices: [{ totalAmount: 800, paidAmount: 0 }],
    });
    const expiresAt = new Date(Date.now() + 86_400_000);
    tradeCreditGrant.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: "44444444-4444-4444-8444-444444444444",
      counterpartyId: cpId,
      amount: args.data.amount,
      expiresAt,
      status: TradeCreditGrantStatus.ISSUED,
      overrideReason: args.data.overrideReason,
    }));

    const result = await svc.issueGrant({
      organizationId: orgId,
      counterpartyId: cpId,
      amount: 250,
      override: true,
      reason: "Manager approved rush order",
      issuedByUserId: "user-1",
    });

    expect(result.code.length).toBeGreaterThanOrEqual(8);
    expect(result.overrideReason).toBe("Manager approved rush order");
    expect(tradeCreditGrant.create).toHaveBeenCalled();
    const createArg = tradeCreditGrant.create.mock.calls[0][0];
    expect(createArg.data.codeHash).toBe(hashGrantCode(result.code));
  });

  it("consume expired / wrong code / over amount → ConflictException", async () => {
    const { svc, tradeCreditGrant } = makeSvc();

    tradeCreditGrant.findFirst.mockResolvedValue(null);
    await expect(
      svc.consumeGrant({
        organizationId: orgId,
        counterpartyId: cpId,
        code: "WRONGCODE1",
        amount: 10,
        sourceEntityType: "SHIPMENT",
        sourceEntityId: "s1",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    tradeCreditGrant.findFirst.mockResolvedValue({
      id: "g1",
      counterpartyId: cpId,
      amount: 100,
      status: TradeCreditGrantStatus.ISSUED,
      expiresAt: new Date(Date.now() - 1000),
      issuedByUserId: null,
      issuedByBuyer: false,
      consumedAt: null,
      consumedRefType: null,
      consumedRefId: null,
      overrideReason: null,
      facilityId,
      createdAt: new Date(),
    });
    tradeCreditGrant.update.mockResolvedValue({});
    await expect(
      svc.consumeGrant({
        organizationId: orgId,
        counterpartyId: cpId,
        code: "VALIDCODE1",
        amount: 10,
        sourceEntityType: "SHIPMENT",
        sourceEntityId: "s1",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    tradeCreditGrant.findFirst.mockResolvedValue({
      id: "g2",
      counterpartyId: cpId,
      amount: 50,
      status: TradeCreditGrantStatus.ISSUED,
      expiresAt: new Date(Date.now() + 3600_000),
      issuedByUserId: null,
      issuedByBuyer: false,
      consumedAt: null,
      consumedRefType: null,
      consumedRefId: null,
      overrideReason: null,
      facilityId,
      createdAt: new Date(),
    });
    await expect(
      svc.consumeGrant({
        organizationId: orgId,
        counterpartyId: cpId,
        code: "VALIDCODE2",
        amount: 100,
        sourceEntityType: "SHIPMENT",
        sourceEntityId: "s1",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("consume when facility stopList → ConflictException", async () => {
    const { svc, tradeCreditGrant } = makeSvc({
      facility: {
        id: facilityId,
        creditLimit: 5000,
        stopList: true,
        status: TradeCreditFacilityStatus.ACTIVE,
      },
    });

    tradeCreditGrant.findFirst.mockResolvedValue({
      id: "g-stop",
      counterpartyId: cpId,
      amount: 100,
      status: TradeCreditGrantStatus.ISSUED,
      expiresAt: new Date(Date.now() + 3600_000),
      issuedByUserId: null,
      issuedByBuyer: false,
      consumedAt: null,
      consumedRefType: null,
      consumedRefId: null,
      overrideReason: null,
      facilityId,
      createdAt: new Date(),
    });

    await expect(
      svc.consumeGrant({
        organizationId: orgId,
        counterpartyId: cpId,
        code: "STOPLISTCODE",
        amount: 10,
        sourceEntityType: "SHIPMENT",
        sourceEntityId: "s-stop",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("SKU off → 402 TRADE_CREDIT_REQUIRED", async () => {
    const { svc } = makeSvc({ hasModule: false });
    try {
      await svc.getFacilityView(orgId, cpId);
      fail("expected TradeCreditRequiredException");
    } catch (e) {
      expect(e).toBeInstanceOf(TradeCreditRequiredException);
      const ex = e as TradeCreditRequiredException;
      expect(ex.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
      const body = ex.getResponse() as { code: string };
      expect(body.code).toBe("TRADE_CREDIT_REQUIRED");
    }
  });

  it("facility view DTO shape has no policyGroup", async () => {
    const { svc } = makeSvc();
    const view = await svc.getFacilityView(orgId, cpId);
    expect(Object.keys(view).sort()).toEqual(
      [
        "available",
        "counterpartyId",
        "creditLimit",
        "facilityId",
        "openAr",
        "status",
        "stopList",
        "unusedIssuedGrants",
      ].sort(),
    );
    expect("policyGroup" in view).toBe(false);
  });
});
