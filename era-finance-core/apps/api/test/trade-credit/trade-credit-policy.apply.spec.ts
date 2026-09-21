import { BadRequestException } from "@nestjs/common";
import {
  InvoiceStatus,
  TradeCreditFacilityStatus,
  TradeCreditGrantStatus,
  TradeCreditPolicyGroup,
} from "@erafinance/database";
import { TradeCreditPolicyService } from "../../src/trade-credit/trade-credit-policy.service";
import { TradeCreditService } from "../../src/trade-credit/trade-credit.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { SubscriptionAccessService } from "../../src/subscription/subscription-access.service";
import type { CronModuleGateService } from "../../src/subscription/cron-module-gate.service";
import { DEFAULT_ORG_TRADE_CREDIT_POLICY } from "../../src/trade-credit/trade-credit-policy.types";

describe("TradeCreditPolicy apply (Phase 1)", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const cpId = "22222222-2222-4222-8222-222222222222";
  const facilityId = "33333333-3333-4333-8333-333333333333";

  function makePolicySvc(opts?: {
    facility?: Record<string, unknown> | null;
    orgPolicy?: Partial<typeof DEFAULT_ORG_TRADE_CREDIT_POLICY>;
    paidCount?: number;
    openInvoices?: Array<{
      totalAmount: number;
      paidAmount: number;
      dueDate: Date;
    }>;
  }) {
    const facility =
      opts?.facility === undefined
        ? {
            id: facilityId,
            organizationId: orgId,
            counterpartyId: cpId,
            creditLimit: 1000,
            stopList: false,
            status: TradeCreditFacilityStatus.ACTIVE,
            policyGroup: null,
            policyGroupManual: null,
            policyReasonsJson: null,
            policyComputedAt: null,
            autoRaiseMuted: false,
            proposedLimit: null,
            proposedAt: null,
            limitBeforeBlock: null,
          }
        : opts.facility;

    const orgPolicy = {
      ...DEFAULT_ORG_TRADE_CREDIT_POLICY,
      ...opts?.orgPolicy,
    };

    const tradeCreditGrant = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };

    const tradeCreditFacility = {
      findUnique: jest.fn().mockResolvedValue(facility),
      update: jest.fn().mockImplementation(async ({ data }: { data: unknown }) => ({
        ...facility,
        ...(data as object),
      })),
      findMany: jest.fn().mockResolvedValue(
        facility ? [{ counterpartyId: cpId }] : [],
      ),
    };

    const tradeCreditPolicy = {
      findUnique: jest.fn().mockResolvedValue({
        organizationId: orgId,
        autoRaiseEnabled: orgPolicy.autoRaiseEnabled,
        autoDMaxDpd: orgPolicy.autoDMaxDpd,
        autoRaisePct: orgPolicy.autoRaisePct,
        autoRaiseCapAzn: orgPolicy.autoRaiseCapAzn,
        grantTtlHoursA: orgPolicy.grantTtlHoursA,
        grantTtlHoursB: orgPolicy.grantTtlHoursB,
        grantTtlHoursC: orgPolicy.grantTtlHoursC,
        groupCRequireConfirm: orgPolicy.groupCRequireConfirm,
        minPaidInvoices: orgPolicy.minPaidInvoices,
        enrichRiskyForcesD: orgPolicy.enrichRiskyForcesD,
        enrichVoenInactiveForcesD: orgPolicy.enrichVoenInactiveForcesD,
      }),
      create: jest.fn(),
      update: jest.fn(),
    };

    const openInvoices = opts?.openInvoices ?? [];
    const invoice = {
      findMany: jest.fn().mockImplementation(async (args: {
        select?: Record<string, boolean>;
        where?: { status?: unknown };
      }) => {
        if (args?.select?.dueDate) {
          return openInvoices;
        }
        if (args?.select?.totalAmount && args?.select?.paidAmount) {
          return openInvoices.map((i) => ({
            totalAmount: i.totalAmount,
            paidAmount: i.paidAmount,
          }));
        }
        // recognized revenue queries
        return [];
      }),
      count: jest.fn().mockImplementation(async (args: {
        where?: { status?: InvoiceStatus };
      }) => {
        if (args?.where?.status === InvoiceStatus.PAID) {
          return opts?.paidCount ?? 10;
        }
        return 0;
      }),
      findFirst: jest.fn().mockResolvedValue(
        (opts?.paidCount ?? 10) > 0
          ? { totalAmount: 200 }
          : null,
      ),
    };

    const tradeCreditEnrichmentRun = {
      findFirst: jest.fn().mockResolvedValue(null),
    };

    const tradeCreditLimitDecision = {
      create: jest.fn().mockResolvedValue({ id: "dec-1" }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    };

    const prisma = {
      tradeCreditFacility,
      tradeCreditPolicy,
      tradeCreditGrant,
      tradeCreditEnrichmentRun,
      tradeCreditLimitDecision,
      invoice,
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      counterparty: {
        findFirst: jest.fn().mockResolvedValue({ id: cpId }),
      },
    } as unknown as PrismaService;

    const subscription = {
      hasModule: jest.fn().mockResolvedValue(true),
    } as unknown as SubscriptionAccessService;

    const cronGate = {
      isModuleOn: jest.fn().mockResolvedValue(true),
    } as unknown as CronModuleGateService;

    const policySvc = new TradeCreditPolicyService(
      prisma,
      subscription,
      cronGate,
    );
    return {
      policySvc,
      prisma,
      tradeCreditFacility,
      tradeCreditGrant,
      tradeCreditLimitDecision,
      facility,
    };
  }

  const healthyFeatures = {
    maxDpd: 0,
    avgDpd: 0,
    overdueShare: 0,
    partialPayRatio: 0,
    turnoverTrend: 0.1,
    turnoverTrendYoy: 0.1,
    utilization: 0.2,
    paidInvoiceCount: 10,
    openAr: 0,
    creditLimit: 1000,
    weightedAvgDpd: 0,
    maxOpenRemainder: 0,
    concentration: 0,
    recognizedLast90: 3000,
    recognizedSame90LastYear: 3000,
    paymentTermsDays: 30,
    enrichAt: null as string | null,
    enrichStale: false,
  };

  function makeTradeSvc(opts?: {
    facility?: Record<string, unknown> | null;
    policyGroup?: TradeCreditPolicyGroup | null;
    policyGroupManual?: TradeCreditPolicyGroup | null;
    maxDpdOpen?: boolean;
    orgPolicy?: Partial<typeof DEFAULT_ORG_TRADE_CREDIT_POLICY>;
  }) {
    const facilityBase = {
      id: facilityId,
      organizationId: orgId,
      counterpartyId: cpId,
      creditLimit: 1000,
      stopList: false,
      status: TradeCreditFacilityStatus.ACTIVE,
      policyGroup: opts?.policyGroup ?? null,
      policyGroupManual: opts?.policyGroupManual ?? null,
      policyReasonsJson: ["mapped_B"],
      policyComputedAt: new Date(),
      autoRaiseMuted: false,
      proposedLimit: null,
      proposedAt: null,
      limitBeforeBlock: null,
      ...(opts?.facility ?? {}),
    };

    const overdueDue = new Date();
    overdueDue.setUTCDate(overdueDue.getUTCDate() - 5);

    const { policySvc, prisma: policyPrisma, tradeCreditFacility } =
      makePolicySvc({
        facility: facilityBase,
        orgPolicy: opts?.orgPolicy,
        paidCount: 10,
        openInvoices: opts?.maxDpdOpen
          ? [{ totalAmount: 100, paidAmount: 0, dueDate: overdueDue }]
          : [],
      });

    const tradeCreditGrant = {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: "g1",
        counterpartyId: cpId,
        amount: 50,
        expiresAt: new Date(Date.now() + 3600_000),
        status: TradeCreditGrantStatus.ISSUED,
        overrideReason: null,
      }),
      findFirst: jest.fn(),
      update: jest.fn(),
    };

    const prisma = {
      ...(policyPrisma as unknown as Record<string, unknown>),
      tradeCreditFacility: {
        ...tradeCreditFacility,
        findUnique: jest.fn().mockResolvedValue(facilityBase),
      },
      tradeCreditGrant,
      invoice: {
        findMany: jest.fn().mockResolvedValue(
          opts?.maxDpdOpen
            ? [
                {
                  totalAmount: 100,
                  paidAmount: 0,
                  dueDate: overdueDue,
                  status: InvoiceStatus.SENT,
                },
              ]
            : [],
        ),
        count: jest.fn().mockResolvedValue(10),
      },
      counterparty: {
        findFirst: jest.fn().mockResolvedValue({ id: cpId }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;

    // Re-bind policy service to shared prisma for feature queries used by issueGrant
    const subscription = {
      hasModule: jest.fn().mockResolvedValue(true),
    } as unknown as SubscriptionAccessService;
    const cronGate = {
      isModuleOn: jest.fn().mockResolvedValue(true),
    } as unknown as CronModuleGateService;

    const policySvcBound = new TradeCreditPolicyService(
      prisma,
      subscription,
      cronGate,
    );

    // Stub org policy + features for B overdue path
    jest
      .spyOn(policySvcBound, "getOrgPolicyDefaults")
      .mockResolvedValue({
        ...DEFAULT_ORG_TRADE_CREDIT_POLICY,
        ...opts?.orgPolicy,
      });

    if (opts?.maxDpdOpen) {
      jest.spyOn(policySvcBound, "buildFeatures").mockResolvedValue({
        maxDpd: 5,
        avgDpd: 5,
        overdueShare: 1,
        partialPayRatio: 0,
        turnoverTrend: 0,
        utilization: 0.1,
        paidInvoiceCount: 10,
        openAr: 100,
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
      });
    } else {
      jest.spyOn(policySvcBound, "buildFeatures").mockResolvedValue({
        maxDpd: 0,
        avgDpd: 0,
        overdueShare: 0,
        partialPayRatio: 0,
        turnoverTrend: 0,
        utilization: 0.1,
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
      });
    }

    const svc = new TradeCreditService(prisma, subscription, policySvcBound, {
      maybeNotifyGrantExpired: jest.fn(),
    } as never);
    return { svc, prisma, tradeCreditGrant, policySvc: policySvcBound };
  }

  it("auto-D voids ISSUED grants and sets limit 0", async () => {
    const overdue = new Date();
    overdue.setUTCDate(overdue.getUTCDate() - 100);
    const { policySvc, tradeCreditFacility, tradeCreditGrant } = makePolicySvc({
      paidCount: 10,
      openInvoices: [
        { totalAmount: 500, paidAmount: 0, dueDate: overdue },
      ],
      facility: {
        id: facilityId,
        organizationId: orgId,
        counterpartyId: cpId,
        creditLimit: 2000,
        stopList: false,
        policyGroup: null,
        policyGroupManual: null,
        policyReasonsJson: null,
        policyComputedAt: null,
        autoRaiseMuted: false,
        proposedLimit: null,
        proposedAt: null,
        limitBeforeBlock: null,
      },
    });

    const result = await policySvc.reclassifyCounterparty(orgId, cpId);
    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.effectiveGroup).toBe("D");
    }
    expect(tradeCreditGrant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: TradeCreditGrantStatus.VOID },
      }),
    );
    expect(tradeCreditFacility.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stopList: true,
          creditLimit: expect.anything(),
          limitBeforeBlock: expect.anything(),
        }),
      }),
    );
  });

  it("auto-A does not raise when flag off (only proposed)", async () => {
    const { policySvc, tradeCreditFacility } = makePolicySvc({
      paidCount: 10,
      orgPolicy: {
        autoRaiseEnabled: false,
        autoRaisePct: 20,
        autoRaiseCapAzn: 5000,
      },
      openInvoices: [],
      facility: {
        id: facilityId,
        organizationId: orgId,
        counterpartyId: cpId,
        creditLimit: 1000,
        stopList: false,
        policyGroup: null,
        policyGroupManual: null,
        policyReasonsJson: null,
        policyComputedAt: null,
        autoRaiseMuted: false,
        proposedLimit: null,
        proposedAt: null,
        limitBeforeBlock: null,
      },
    });

    // Force A via healthy features
    jest.spyOn(policySvc, "buildFeatures").mockResolvedValue({
      maxDpd: 0,
      avgDpd: 2,
      overdueShare: 0,
      partialPayRatio: 0,
      turnoverTrend: 0.1,
      utilization: 0.3,
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
    });

    await policySvc.reclassifyCounterparty(orgId, cpId);
    const updateArg = tradeCreditFacility.update.mock.calls[0][0].data;
    expect(updateArg.proposedLimit).toBeDefined();
    expect(updateArg.creditLimit).toBeUndefined();
  });

  it("raise respects cap when auto-raise enabled", async () => {
    const { policySvc, tradeCreditFacility } = makePolicySvc({
      paidCount: 10,
      orgPolicy: {
        autoRaiseEnabled: true,
        autoRaisePct: 50,
        autoRaiseCapAzn: 1100,
      },
      facility: {
        id: facilityId,
        organizationId: orgId,
        counterpartyId: cpId,
        creditLimit: 1000,
        stopList: false,
        policyGroup: null,
        policyGroupManual: null,
        policyReasonsJson: null,
        policyComputedAt: null,
        autoRaiseMuted: false,
        proposedLimit: null,
        proposedAt: null,
        limitBeforeBlock: null,
      },
    });

    jest.spyOn(policySvc, "buildFeatures").mockResolvedValue({
      maxDpd: 0,
      avgDpd: 1,
      overdueShare: 0,
      partialPayRatio: 0,
      turnoverTrend: 0.2,
      utilization: 0.2,
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
    });

    await policySvc.reclassifyCounterparty(orgId, cpId);
    const updateArg = tradeCreditFacility.update.mock.calls[0][0].data;
    expect(Number(updateArg.creditLimit)).toBe(1100);
    expect(updateArg.proposedLimit).toBeNull();
  });

  it("B blocks grant when overdue", async () => {
    const { svc, tradeCreditGrant } = makeTradeSvc({
      policyGroup: TradeCreditPolicyGroup.B,
      maxDpdOpen: true,
    });

    await expect(
      svc.issueGrant({
        organizationId: orgId,
        counterpartyId: cpId,
        amount: 50,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tradeCreditGrant.create).not.toHaveBeenCalled();
  });

  it("staff view has policyGroup; buyer getFacilityView has no policyGroup", async () => {
    const { svc } = makeTradeSvc({
      policyGroup: TradeCreditPolicyGroup.A,
    });

    const staff = await svc.getStaffFacilityView(orgId, cpId);
    expect(staff.policyGroup).toBe("A");
    expect(staff.policyGroupComputed).toBe("A");

    const buyer = await svc.getFacilityView(orgId, cpId);
    expect(buyer).not.toHaveProperty("policyGroup");
    expect("policyGroup" in buyer).toBe(false);
    expect(buyer).not.toHaveProperty("suggestedLimit");
    expect(buyer).not.toHaveProperty("proposedKind");
  });

  it("pin D blocks grant issue without override", async () => {
    const { svc, tradeCreditGrant } = makeTradeSvc({
      policyGroupManual: TradeCreditPolicyGroup.D,
      policyGroup: TradeCreditPolicyGroup.A,
      facility: {
        stopList: true,
        creditLimit: 0,
        limitBeforeBlock: 1000,
      },
    });

    await expect(
      svc.issueGrant({
        organizationId: orgId,
        counterpartyId: cpId,
        amount: 50,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tradeCreditGrant.create).not.toHaveBeenCalled();
  });

  it("group C refuses TTL above policy without override", async () => {
    const { svc, tradeCreditGrant } = makeTradeSvc({
      policyGroup: TradeCreditPolicyGroup.C,
      orgPolicy: { grantTtlHoursC: 8 },
    });

    await expect(
      svc.issueGrant({
        organizationId: orgId,
        counterpartyId: cpId,
        amount: 50,
        ttlHours: 48,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tradeCreditGrant.create).not.toHaveBeenCalled();
  });

  it("consumeGrant refuses when effective group is D even if stopList cleared", async () => {
    const { svc, prisma } = makeTradeSvc({
      policyGroup: TradeCreditPolicyGroup.D,
      facility: {
        stopList: false,
        creditLimit: 500,
        status: TradeCreditFacilityStatus.ACTIVE,
      },
    });

    (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => {
      const tx = {
        tradeCreditGrant: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findFirst: jest.fn().mockResolvedValue({
            id: "g1",
            counterpartyId: cpId,
            amount: 50,
            status: TradeCreditGrantStatus.ISSUED,
            expiresAt: new Date(Date.now() + 3600_000),
          }),
          update: jest.fn(),
        },
        tradeCreditFacility: {
          findFirst: jest.fn().mockResolvedValue({
            id: facilityId,
            organizationId: orgId,
            counterpartyId: cpId,
            stopList: false,
            status: TradeCreditFacilityStatus.ACTIVE,
            policyGroup: TradeCreditPolicyGroup.D,
            policyGroupManual: null,
            creditLimit: 500,
          }),
        },
      };
      return fn(tx);
    });

    await expect(
      svc.consumeGrant({
        organizationId: orgId,
        counterpartyId: cpId,
        code: "ABCDEFGHJKLM",
        amount: 50,
        sourceEntityType: "WHOLESALE_ORDER",
        sourceEntityId: "ord-1",
      }),
    ).rejects.toThrow(/Group D/);
  });

  it("auto-raise does not compound when facility already group A", async () => {
    const { policySvc, tradeCreditFacility } = makePolicySvc({
      paidCount: 10,
      facility: {
        id: facilityId,
        organizationId: orgId,
        counterpartyId: cpId,
        creditLimit: 1000,
        stopList: false,
        policyGroup: TradeCreditPolicyGroup.A,
        policyGroupManual: null,
        policyReasonsJson: null,
        policyComputedAt: new Date(),
        autoRaiseMuted: false,
        proposedLimit: null,
        proposedAt: null,
        limitBeforeBlock: null,
      },
      orgPolicy: {
        autoRaiseEnabled: true,
        autoRaisePct: 10,
        autoRaiseCapAzn: 5000,
      },
    });

    jest.spyOn(policySvc, "buildFeatures").mockResolvedValue({
      maxDpd: 0,
      avgDpd: 0,
      overdueShare: 0,
      partialPayRatio: 0,
      turnoverTrend: 0.2,
      utilization: 0.2,
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
    });

    await policySvc.reclassifyCounterparty(orgId, cpId);
    const updateArg = tradeCreditFacility.update.mock.calls[0][0].data;
    expect(updateArg.creditLimit).toBeUndefined();
  });

  it("Phase 3: thin history proposes TRIAL when limit is 0 (no auto apply)", async () => {
    const { policySvc, tradeCreditFacility } = makePolicySvc({
      paidCount: 1,
      facility: {
        id: facilityId,
        organizationId: orgId,
        counterpartyId: cpId,
        creditLimit: 0,
        stopList: false,
        policyGroup: null,
        policyGroupManual: null,
        policyReasonsJson: null,
        policyComputedAt: null,
        autoRaiseMuted: false,
        proposedLimit: null,
        proposedAt: null,
        proposedKind: null,
        suggestedLimit: null,
        limitBeforeBlock: null,
      },
    });

    jest.spyOn(policySvc, "buildFeatures").mockResolvedValue({
      ...healthyFeatures,
      paidInvoiceCount: 1,
      creditLimit: 0,
      recognizedLast90: 0,
    });

    const result = await policySvc.reclassifyCounterparty(orgId, cpId);
    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.thinHistory).toBe(true);
      expect(result.proposedKind).toBe("TRIAL");
    }
    const updateArg = tradeCreditFacility.update.mock.calls[0][0].data;
    expect(updateArg.proposedKind).toBe("TRIAL");
    expect(Number(updateArg.proposedLimit)).toBe(200);
    expect(updateArg.creditLimit).toBeUndefined();
  });

  it("Phase 3: restore proposal when clean after DPD block (never silent)", async () => {
    const { policySvc, tradeCreditFacility } = makePolicySvc({
      paidCount: 10,
      facility: {
        id: facilityId,
        organizationId: orgId,
        counterpartyId: cpId,
        creditLimit: 0,
        stopList: true,
        policyGroup: TradeCreditPolicyGroup.B,
        policyGroupManual: null,
        policyReasonsJson: null,
        policyComputedAt: new Date(),
        autoRaiseMuted: false,
        proposedLimit: null,
        proposedAt: null,
        proposedKind: null,
        suggestedLimit: null,
        limitBeforeBlock: 1500,
      },
    });

    jest.spyOn(policySvc, "buildFeatures").mockResolvedValue({
      ...healthyFeatures,
      creditLimit: 0,
      recognizedLast90: 4500,
    });

    await policySvc.reclassifyCounterparty(orgId, cpId);
    const updateArg = tradeCreditFacility.update.mock.calls[0][0].data;
    expect(updateArg.proposedKind).toBe("RESTORE");
    expect(Number(updateArg.proposedLimit)).toBe(1500);
    expect(updateArg.creditLimit).toBeUndefined();
    expect(updateArg.stopList).toBeUndefined();
  });

  it("Phase 3: WC proposal does not auto-apply creditLimit", async () => {
    const { policySvc, tradeCreditFacility } = makePolicySvc({
      paidCount: 10,
      facility: {
        id: facilityId,
        organizationId: orgId,
        counterpartyId: cpId,
        creditLimit: 1000,
        stopList: false,
        policyGroup: TradeCreditPolicyGroup.B,
        policyGroupManual: TradeCreditPolicyGroup.B,
        policyReasonsJson: null,
        policyComputedAt: new Date(),
        autoRaiseMuted: false,
        proposedLimit: null,
        proposedAt: null,
        proposedKind: null,
        suggestedLimit: null,
        limitBeforeBlock: null,
      },
      orgPolicy: { autoRaiseEnabled: false },
    });

    jest.spyOn(policySvc, "buildFeatures").mockResolvedValue({
      ...healthyFeatures,
      recognizedLast90: 9000,
      creditLimit: 1000,
    });

    await policySvc.reclassifyCounterparty(orgId, cpId);
    const updateArg = tradeCreditFacility.update.mock.calls[0][0].data;
    expect(updateArg.proposedKind).toBe("WORKING_CAPITAL");
    expect(Number(updateArg.proposedLimit)).toBeGreaterThan(1000);
    expect(updateArg.creditLimit).toBeUndefined();
  });

  it("Phase 3: acceptRaise writes TradeCreditLimitDecision", async () => {
    const { policySvc, tradeCreditLimitDecision, tradeCreditFacility } =
      makePolicySvc({
        paidCount: 10,
        facility: {
          id: facilityId,
          organizationId: orgId,
          counterpartyId: cpId,
          creditLimit: 1000,
          stopList: false,
          policyGroup: TradeCreditPolicyGroup.A,
          policyGroupManual: null,
          policyReasonsJson: ["mapped_A"],
          policyComputedAt: new Date(),
          autoRaiseMuted: false,
          proposedLimit: 1200,
          proposedAt: new Date(),
          proposedKind: "WORKING_CAPITAL",
          suggestedLimit: 1200,
          limitBeforeBlock: null,
        },
      });

    jest
      .spyOn(policySvc, "buildFeatures")
      .mockResolvedValue({ ...healthyFeatures });

    await policySvc.acceptRaise(orgId, cpId);
    expect(tradeCreditLimitDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accepted: true,
          kind: "WORKING_CAPITAL",
        }),
      }),
    );
    expect(tradeCreditFacility.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          creditLimit: expect.anything(),
          proposedLimit: null,
          proposedKind: null,
        }),
      }),
    );
  });

  it("Phase 3: ENRICH_HAIRCUT outranks A-raise proposal", async () => {
    const { policySvc, tradeCreditFacility } = makePolicySvc({
      paidCount: 10,
      orgPolicy: { autoRaiseEnabled: false, autoRaisePct: 20 },
      facility: {
        id: facilityId,
        organizationId: orgId,
        counterpartyId: cpId,
        creditLimit: 5000,
        stopList: false,
        policyGroup: null,
        policyGroupManual: null,
        policyReasonsJson: null,
        policyComputedAt: null,
        autoRaiseMuted: false,
        proposedLimit: null,
        proposedAt: null,
        proposedKind: null,
        suggestedLimit: null,
        limitBeforeBlock: null,
      },
    });

    jest.spyOn(policySvc, "buildFeatures").mockResolvedValue({
      ...healthyFeatures,
      creditLimit: 5000,
      recognizedLast90: 9000,
      riskyTaxpayer: true,
      enrichStale: false,
    });

    await policySvc.reclassifyCounterparty(orgId, cpId);
    const updateArg = tradeCreditFacility.update.mock.calls[0][0].data;
    expect(updateArg.proposedKind).toBe("ENRICH_HAIRCUT");
    expect(Number(updateArg.proposedLimit)).toBeLessThan(5000);
    expect(updateArg.creditLimit).toBeUndefined();
  });

  it("Phase 3: partial-pay tightens grant TTL to group C hours", async () => {
    const { svc, tradeCreditGrant, policySvc } = makeTradeSvc({
      policyGroup: TradeCreditPolicyGroup.A,
      orgPolicy: { grantTtlHoursA: 24, grantTtlHoursC: 8 },
    });
    jest.spyOn(policySvc, "buildFeatures").mockResolvedValue({
      ...healthyFeatures,
      partialPayRatio: 0.4,
      creditLimit: 1000,
    });

    const t0 = Date.now();
    await svc.issueGrant({
      organizationId: orgId,
      counterpartyId: cpId,
      amount: 50,
    });
    const created = tradeCreditGrant.create.mock.calls[0][0].data as {
      expiresAt: Date;
    };
    const ttlMs = created.expiresAt.getTime() - t0;
    expect(ttlMs).toBeLessThanOrEqual(8 * 3600_000 + 2000);
    expect(ttlMs).toBeGreaterThan(7 * 3600_000);
  });
});
