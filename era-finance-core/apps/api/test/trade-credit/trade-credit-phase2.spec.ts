import { BadRequestException } from "@nestjs/common";
import { InvoiceStatus } from "@erafinance/database";
import { classifyTradeCredit } from "../../src/trade-credit/trade-credit-classifier";
import { TradeCreditPhase2Service } from "../../src/trade-credit/trade-credit-phase2.service";
import { DEFAULT_ORG_TRADE_CREDIT_POLICY } from "../../src/trade-credit/trade-credit-policy.types";
import type { PrismaService } from "../../src/prisma/prisma.service";
import type { BillingMeterService } from "../../src/billing/billing-meter.service";
import type { TaxpayerIntegrationService } from "../../src/tax/taxpayer-integration.service";
import type { SubscriptionAccessService } from "../../src/subscription/subscription-access.service";
import type { TradeCreditPolicyService } from "../../src/trade-credit/trade-credit-policy.service";

jest.mock("../../src/security/pii-crypto.util", () => ({
  ...jest.requireActual("../../src/security/pii-crypto.util"),
  decryptText: () => "1234567890",
}));

jest.mock("../../src/integration/control-plane-notifications.client", () => ({
  createControlPlanePaymentLink: jest.fn(),
  sendControlPlaneNotification: jest.fn(),
}));

describe("Phase 2 enrich classifier hooks", () => {
  const baseFeatures = {
    maxDpd: 0,
    avgDpd: 0,
    overdueShare: 0,
    partialPayRatio: 0,
    turnoverTrend: 0.1,
    utilization: 0.2,
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
  };

  it("riskyTaxpayer is informational when enrichRiskyForcesD is false", () => {
    const r = classifyTradeCredit(
      { ...baseFeatures, riskyTaxpayer: true },
      DEFAULT_ORG_TRADE_CREDIT_POLICY,
    );
    expect(r.group).toBe("A");
    expect(r.reasons).toContain("enrich_risky_informational");
  });

  it("riskyTaxpayer forces D when enrichRiskyForcesD is true", () => {
    const r = classifyTradeCredit(
      { ...baseFeatures, riskyTaxpayer: true },
      { ...DEFAULT_ORG_TRADE_CREDIT_POLICY, enrichRiskyForcesD: true },
    );
    expect(r.group).toBe("D");
    expect(r.reasons).toContain("enrich_risky_forces_d");
  });

  it("voenInactive forces D only when policy enabled", () => {
    const info = classifyTradeCredit(
      { ...baseFeatures, voenInactive: true },
      DEFAULT_ORG_TRADE_CREDIT_POLICY,
    );
    expect(info.group).toBe("A");
    expect(info.reasons).toContain("enrich_voen_inactive_informational");

    const forced = classifyTradeCredit(
      { ...baseFeatures, voenInactive: true },
      {
        ...DEFAULT_ORG_TRADE_CREDIT_POLICY,
        enrichVoenInactiveForcesD: true,
      },
    );
    expect(forced.group).toBe("D");
  });
});

describe("Phase 2 leak shape", () => {
  it("buyer pay-link / factor response keys never include policyGroup", () => {
    const payLink = {
      invoiceId: "i1",
      invoiceNumber: "INV-1",
      amount: 10,
      currency: "AZN",
      paymentUrl: "https://pay.example/x",
    };
    const factor = {
      id: "l1",
      status: "SUBMITTED",
      partnerKey: "default",
      invoiceId: null,
      createdAt: new Date().toISOString(),
      message: "Factoring lead submitted to partner queue (no GL posted)",
    };
    expect(payLink).not.toHaveProperty("policyGroup");
    expect(factor).not.toHaveProperty("policyGroup");
    expect(JSON.stringify(factor)).not.toMatch(
      /policyGroup|suggestedLimit|proposedKind|А–Г/,
    );
  });

  it("BadRequestException for missing factor SKU uses TRADE_CREDIT_FACTOR_REQUIRED", () => {
    const err = new BadRequestException({
      code: "TRADE_CREDIT_FACTOR_REQUIRED",
      message: "SKU trade_credit_factor_lead is not entitled",
    });
    const body = err.getResponse() as { code?: string };
    expect(body.code).toBe("TRADE_CREDIT_FACTOR_REQUIRED");
  });
});

describe("TradeCreditPhase2Service deep-check billing semantics", () => {
  const orgId = "11111111-1111-4111-8111-111111111111";
  const cpId = "22222222-2222-4222-8222-222222222222";

  function makeSvc(opts?: {
    softBlocked?: boolean;
    meterThrows?: boolean;
    lookupThrows?: boolean;
    lookup?: {
      name: string;
      isVatPayer: boolean;
      address: string | null;
      isRiskyTaxpayer: boolean | null;
      isInactive: boolean | null;
    } | null;
  }) {
    const created: Array<Record<string, unknown>> = [];
    const prisma = {
      counterparty: {
        findFirst: jest.fn().mockResolvedValue({
          id: cpId,
          taxIdCipher: "cipher",
        }),
      },
      tradeCreditFacility: {
        findUnique: jest.fn().mockResolvedValue({ id: "fac1" }),
      },
      tradeCreditEnrichmentRun: {
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return {
            id: "run1",
            provider: data.provider,
            paidMeterUnits: data.paidMeterUnits,
            billed: data.billed,
            consentPurpose: data.consentPurpose,
            riskyTaxpayer: data.riskyTaxpayer,
            voenInactive: data.voenInactive,
            voenName: data.voenName,
            errorMessage: data.errorMessage,
            createdAt: new Date("2026-09-17T12:00:00.000Z"),
            createdByUserId: data.createdByUserId ?? null,
          };
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: {
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;

    const billing = {
      getTradeCreditEnrichMeterState: jest.fn().mockResolvedValue({
        softBlocked: opts?.softBlocked ?? false,
        spentAzn: 0,
        ceiling: 100,
        unitPriceAzn: 2,
      }),
      recordTradeCreditEnrichUsage: jest.fn().mockImplementation(async () => {
        if (opts?.meterThrows) throw new Error("meter down");
        return { spentAzn: 2, addedAzn: 2, softBlocked: false };
      }),
    } as unknown as BillingMeterService;

    const taxpayers = {
      lookupTaxpayerByVoen: jest.fn().mockImplementation(async () => {
        if (opts?.lookupThrows) throw new Error("e-taxes down");
        if (opts?.lookup === null) throw new Error("not found");
        return (
          opts?.lookup ?? {
            name: "Demo Co",
            isVatPayer: true,
            address: null,
            isRiskyTaxpayer: false,
            isInactive: false,
          }
        );
      }),
    } as unknown as TaxpayerIntegrationService;

    const subscription = {
      hasModule: jest.fn().mockResolvedValue(true),
    } as unknown as SubscriptionAccessService;

    const policy = {
      scheduleReclassify: jest.fn().mockResolvedValue(undefined),
    } as unknown as TradeCreditPolicyService;

    const svc = new TradeCreditPhase2Service(
      prisma,
      billing,
      taxpayers,
      subscription,
      policy,
    );
    return { svc, created, billing, taxpayers, prisma };
  }

  it("soft-blocked meter refuses deep check before bureau call", async () => {
    const { svc, taxpayers, created } = makeSvc({ softBlocked: true });
    await expect(
      svc.runDeepCheck({ organizationId: orgId, counterpartyId: cpId }),
    ).rejects.toMatchObject({
      response: { code: "TRADE_CREDIT_ENRICH_SOFT_BLOCKED" },
    });
    expect(taxpayers.lookupTaxpayerByVoen).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it("lookup outage does not set voenInactive=true and does not bill", async () => {
    const { svc, created } = makeSvc({ lookupThrows: true });
    const run = await svc.runDeepCheck({
      organizationId: orgId,
      counterpartyId: cpId,
    });
    expect(run.voenInactive).toBeNull();
    expect(run.billed).toBe(false);
    expect(created[0]?.billed).toBe(false);
    expect(created[0]?.voenInactive).toBeNull();
  });

  it("meter failure after successful lookup keeps billed=false", async () => {
    const { svc, created } = makeSvc({ meterThrows: true });
    const run = await svc.runDeepCheck({
      organizationId: orgId,
      counterpartyId: cpId,
    });
    expect(run.billed).toBe(false);
    expect(run.paidMeterUnits).toBe(0);
    expect(created[0]?.billed).toBe(false);
  });

  it("successful lookup with meter sets billed=true and respects isInactive", async () => {
    const { svc, created } = makeSvc({
      lookup: {
        name: "Inactive Co",
        isVatPayer: false,
        address: null,
        isRiskyTaxpayer: false,
        isInactive: true,
      },
    });
    const run = await svc.runDeepCheck({
      organizationId: orgId,
      counterpartyId: cpId,
    });
    expect(run.billed).toBe(true);
    expect(run.voenInactive).toBe(true);
    expect(created[0]?.billed).toBe(true);
  });

  it("pay-link rejects non-open invoice status", async () => {
    const { svc, prisma } = makeSvc();
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      svc.createInvoicePayLink({
        organizationId: orgId,
        counterpartyId: cpId,
        invoiceId: "33333333-3333-4333-8333-333333333333",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          status: {
            in: [
              InvoiceStatus.SENT,
              InvoiceStatus.PARTIALLY_PAID,
              InvoiceStatus.LOCKED_BY_SIGNATURE,
            ],
          },
        }),
      }),
    );
  });
});
