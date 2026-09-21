import { createHash } from "crypto";
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { BillingMeterService } from "../billing/billing-meter.service";
import { TaxpayerIntegrationService } from "../tax/taxpayer-integration.service";
import { decryptText } from "../security/pii-crypto.util";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { TradeCreditRequiredException } from "./trade-credit-required.exception";
import { TradeCreditPolicyService } from "./trade-credit-policy.service";
import {
  createControlPlanePaymentLink,
  sendControlPlaneNotification,
} from "../integration/control-plane-notifications.client";

const ENRICH_PROVIDER = "e_taxes_taxpayer";

@Injectable()
export class TradeCreditPhase2Service {
  private readonly logger = new Logger(TradeCreditPhase2Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingMeterService,
    private readonly taxpayers: TaxpayerIntegrationService,
    private readonly subscription: SubscriptionAccessService,
    private readonly policy: TradeCreditPolicyService,
  ) {}

  private async assertTradeCreditSku(organizationId: string) {
    const on = await this.subscription.hasModule(
      organizationId,
      ModuleEntitlement.TRADE_CREDIT_CONTROL,
    );
    if (!on) throw new TradeCreditRequiredException();
  }

  private async assertFactorSku(organizationId: string) {
    const on = await this.subscription.hasModule(
      organizationId,
      ModuleEntitlement.TRADE_CREDIT_FACTOR_LEAD,
    );
    if (!on) {
      throw new BadRequestException({
        code: "TRADE_CREDIT_FACTOR_REQUIRED",
        message: "SKU trade_credit_factor_lead is not entitled",
      });
    }
  }

  async isFactorLeadEntitled(organizationId: string): Promise<boolean> {
    return this.subscription.hasModule(
      organizationId,
      ModuleEntitlement.TRADE_CREDIT_FACTOR_LEAD,
    );
  }

  // --- 2a notify prefs ---

  async getBuyerPrefs(organizationId: string, counterpartyId: string) {
    await this.assertTradeCreditSku(organizationId);
    const row = await this.prisma.tradeCreditBuyerPref.findUnique({
      where: {
        organizationId_counterpartyId: { organizationId, counterpartyId },
      },
    });
    return {
      notifyOptIn: row?.notifyOptIn ?? false,
      notifyChannel: row?.notifyChannel ?? null,
    };
  }

  async setBuyerPrefs(
    organizationId: string,
    counterpartyId: string,
    input: { notifyOptIn: boolean; notifyChannel?: string | null },
  ) {
    await this.assertTradeCreditSku(organizationId);
    const row = await this.prisma.tradeCreditBuyerPref.upsert({
      where: {
        organizationId_counterpartyId: { organizationId, counterpartyId },
      },
      create: {
        organizationId,
        counterpartyId,
        notifyOptIn: input.notifyOptIn,
        notifyChannel: input.notifyChannel ?? null,
      },
      update: {
        notifyOptIn: input.notifyOptIn,
        notifyChannel: input.notifyChannel ?? null,
      },
    });
    return {
      notifyOptIn: row.notifyOptIn,
      notifyChannel: row.notifyChannel,
    };
  }

  async maybeNotifyGrantIssued(params: {
    organizationId: string;
    counterpartyId: string;
    grantId: string;
    amount: number;
    expiresAt: string;
    email?: string | null;
  }): Promise<void> {
    const recipient =
      params.email?.trim() ||
      (await this.resolveNotifyEmail(
        params.organizationId,
        params.counterpartyId,
      ));
    await this.sendBuyerLifecycleNotify({
      organizationId: params.organizationId,
      counterpartyId: params.counterpartyId,
      recipient,
      templateKey: "trade_credit_grant_issued",
      sourceEntityType: "trade_credit_grant",
      sourceEntityId: params.grantId,
      payload: {
        amount: params.amount,
        expiresAt: params.expiresAt,
      },
      subject: "Pickup grant issued",
      body: `Grant ${params.amount.toFixed(2)} AZN expires ${params.expiresAt}`,
    });
  }

  async maybeNotifyLimitRestored(params: {
    organizationId: string;
    counterpartyId: string;
    creditLimit: number;
  }): Promise<void> {
    const recipient = await this.resolveNotifyEmail(
      params.organizationId,
      params.counterpartyId,
    );
    await this.sendBuyerLifecycleNotify({
      organizationId: params.organizationId,
      counterpartyId: params.counterpartyId,
      recipient,
      templateKey: "trade_credit_limit_restored",
      sourceEntityType: "trade_credit_facility",
      sourceEntityId: params.counterpartyId,
      payload: { creditLimit: params.creditLimit },
      subject: "Trade credit available again",
      body: `Your available trade-credit limit was restored (${params.creditLimit.toFixed(2)} AZN).`,
    });
  }

  async maybeNotifyGrantExpired(params: {
    organizationId: string;
    counterpartyId: string;
    grantId: string;
    amount: number;
  }): Promise<void> {
    const recipient = await this.resolveNotifyEmail(
      params.organizationId,
      params.counterpartyId,
    );
    await this.sendBuyerLifecycleNotify({
      organizationId: params.organizationId,
      counterpartyId: params.counterpartyId,
      recipient,
      templateKey: "trade_credit_grant_expired",
      sourceEntityType: "trade_credit_grant",
      sourceEntityId: params.grantId,
      payload: { amount: params.amount },
      subject: "Pickup grant expired",
      body: `Pickup grant ${params.amount.toFixed(2)} AZN expired unused.`,
    });
  }

  private async resolveNotifyEmail(
    organizationId: string,
    counterpartyId: string,
  ): Promise<string | null> {
    const cp = await this.prisma.counterparty.findFirst({
      where: { id: counterpartyId, organizationId, deletedAt: null },
      select: { email: true },
    });
    const email = cp?.email?.trim();
    return email || null;
  }

  private async sendBuyerLifecycleNotify(params: {
    organizationId: string;
    counterpartyId: string;
    recipient: string | null;
    templateKey: string;
    sourceEntityType: string;
    sourceEntityId: string;
    payload: Record<string, unknown>;
    subject: string;
    body: string;
  }): Promise<void> {
    const prefs = await this.prisma.tradeCreditBuyerPref.findUnique({
      where: {
        organizationId_counterpartyId: {
          organizationId: params.organizationId,
          counterpartyId: params.counterpartyId,
        },
      },
    });
    if (!prefs?.notifyOptIn) return;
    const recipient = params.recipient?.trim();
    if (!recipient) return;
    // Never put А–Г / policyGroup in notify payloads.
    try {
      await sendControlPlaneNotification(params.organizationId, {
        channel: prefs.notifyChannel === "whatsapp" ? "WHATSAPP" : "EMAIL",
        messageClass: "LIFECYCLE",
        templateKey: params.templateKey,
        recipient,
        sourceEntityType: params.sourceEntityType,
        sourceEntityId: params.sourceEntityId,
        payload: params.payload,
        subject: params.subject,
        body: params.body,
      });
    } catch (e) {
      this.logger.warn(
        `Buyer notify skipped (${params.templateKey}): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  async getBuyerGrantMeta(
    organizationId: string,
    counterpartyId: string,
    grantId: string,
  ) {
    await this.assertTradeCreditSku(organizationId);
    const grant = await this.prisma.tradeCreditGrant.findFirst({
      where: { id: grantId, organizationId, counterpartyId },
      select: {
        id: true,
        amount: true,
        expiresAt: true,
        status: true,
        createdAt: true,
      },
    });
    if (!grant) throw new BadRequestException("Grant not found");
    return {
      id: grant.id,
      amount: Number(grant.amount),
      expiresAt: grant.expiresAt.toISOString(),
      status: grant.status,
      createdAt: grant.createdAt.toISOString(),
      // plaintext code never re-fetched
    };
  }

  // --- 2b enrichment ---

  async listEnrichmentRuns(
    organizationId: string,
    counterpartyId: string,
  ) {
    await this.assertTradeCreditSku(organizationId);
    const rows = await this.prisma.tradeCreditEnrichmentRun.findMany({
      where: { organizationId, counterpartyId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const enrichMeter =
      await this.billing.getTradeCreditEnrichMeterState(organizationId);
    return {
      runs: rows.map((r) => this.serializeEnrichment(r)),
      enrichMeter: {
        softBlocked: enrichMeter.softBlocked,
        unitPriceAzn: enrichMeter.unitPriceAzn,
      },
    };
  }

  async runDeepCheck(params: {
    organizationId: string;
    counterpartyId: string;
    userId?: string | null;
  }) {
    await this.assertTradeCreditSku(params.organizationId);

    const meter = await this.billing.getTradeCreditEnrichMeterState(
      params.organizationId,
    );
    if (meter.softBlocked) {
      throw new BadRequestException({
        code: "TRADE_CREDIT_ENRICH_SOFT_BLOCKED",
        message:
          "Enrichment meter soft ceiling reached — upgrade spend tier or wait for next billing cycle",
        unitPriceAzn: meter.unitPriceAzn,
        spentAzn: meter.spentAzn,
        ceiling: meter.ceiling,
      });
    }

    const cp = await this.prisma.counterparty.findFirst({
      where: {
        id: params.counterpartyId,
        organizationId: params.organizationId,
        deletedAt: null,
      },
      select: { id: true, taxIdCipher: true },
    });
    if (!cp) throw new BadRequestException("Counterparty not found");

    const voen = cp.taxIdCipher ? decryptText(cp.taxIdCipher) : null;
    if (!voen || !/^\d{10}$/.test(voen)) {
      throw new BadRequestException("Counterparty VÖEN required for deep check");
    }

    const facility = await this.prisma.tradeCreditFacility.findUnique({
      where: {
        organizationId_counterpartyId: {
          organizationId: params.organizationId,
          counterpartyId: params.counterpartyId,
        },
      },
      select: { id: true },
    });

    let lookup: Awaited<
      ReturnType<TaxpayerIntegrationService["lookupTaxpayerByVoen"]>
    > | null = null;
    let errorMessage: string | null = null;
    try {
      lookup = await this.taxpayers.lookupTaxpayerByVoen(voen);
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    // Never treat transport/outage as voenInactive — only explicit inactive signal.
    const riskyTaxpayer = lookup?.isRiskyTaxpayer ?? null;
    const voenInactive = lookup ? (lookup.isInactive ?? false) : null;

    let billed = false;
    let paidMeterUnits = 0;
    if (lookup != null) {
      try {
        const meterResult = await this.billing.recordTradeCreditEnrichUsage(
          params.organizationId,
          1,
        );
        if (meterResult.softBlocked) {
          throw new BadRequestException({
            code: "TRADE_CREDIT_ENRICH_SOFT_BLOCKED",
            message:
              "Enrichment meter soft ceiling reached — upgrade spend tier or wait for next billing cycle",
          });
        }
        // Successful check bills one unit (even if unit price is 0 in config).
        billed = true;
        paidMeterUnits = 1;
      } catch (e) {
        if (
          e instanceof BadRequestException &&
          typeof e.getResponse() === "object" &&
          (e.getResponse() as { code?: string }).code ===
            "TRADE_CREDIT_ENRICH_SOFT_BLOCKED"
        ) {
          throw e;
        }
        this.logger.warn(
          `Enrich meter soft-fail: ${e instanceof Error ? e.message : String(e)}`,
        );
        billed = false;
        paidMeterUnits = 0;
      }
    }

    const run = await this.prisma.tradeCreditEnrichmentRun.create({
      data: {
        organizationId: params.organizationId,
        counterpartyId: params.counterpartyId,
        facilityId: facility?.id ?? null,
        provider: ENRICH_PROVIDER,
        paidMeterUnits,
        billed,
        consentPurpose: "trade_credit_underwriting",
        payloadJson: lookup
          ? ({
              name: lookup.name,
              isVatPayer: lookup.isVatPayer,
              address: lookup.address,
              isRiskyTaxpayer: lookup.isRiskyTaxpayer,
              isInactive: lookup.isInactive,
            } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        riskyTaxpayer,
        voenInactive,
        voenName: lookup?.name ?? null,
        errorMessage,
        createdByUserId: params.userId ?? null,
      },
    });

    // Optional policy-driven reclassify after enrich
    try {
      await this.policy.scheduleReclassify(
        params.organizationId,
        params.counterpartyId,
      );
    } catch {
      /* ignore */
    }

    return this.serializeEnrichment(run);
  }

  // --- 2c pay + factor ---

  async createInvoicePayLink(params: {
    organizationId: string;
    counterpartyId: string;
    invoiceId: string;
  }) {
    await this.assertTradeCreditSku(params.organizationId);
    const inv = await this.prisma.invoice.findFirst({
      where: {
        id: params.invoiceId,
        organizationId: params.organizationId,
        counterpartyId: params.counterpartyId,
        deletedAt: null,
        status: {
          in: [
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.LOCKED_BY_SIGNATURE,
          ],
        },
      },
      select: {
        id: true,
        number: true,
        totalAmount: true,
        paidAmount: true,
        currency: true,
      },
    });
    if (!inv) throw new BadRequestException("Invoice not found");
    const remaining = Number(inv.totalAmount) - Number(inv.paidAmount ?? 0);
    if (!(remaining > 0)) {
      throw new BadRequestException("Invoice has no remaining balance");
    }

    try {
      const link = await createControlPlanePaymentLink(params.organizationId, {
        amountAzn: remaining,
        counterpartyRef: params.counterpartyId,
        sourceEntityType: "sales_invoice",
        sourceEntityId: inv.id,
        description: `Invoice ${inv.number}`,
        expiresInHours: 72,
      });
      const url = link.paymentUrl ?? link.portalPayUrl;
      if (!url) {
        throw new ServiceUnavailableException("Payment link URL missing");
      }
      return {
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        amount: remaining,
        currency: inv.currency || "AZN",
        paymentUrl: url,
      };
    } catch (e) {
      throw new ServiceUnavailableException(
        e instanceof Error ? e.message : "Payment link unavailable",
      );
    }
  }

  async submitFactorLead(params: {
    organizationId: string;
    counterpartyId: string;
    invoiceId?: string | null;
    note?: string | null;
    partnerKey?: string;
  }) {
    await this.assertFactorSku(params.organizationId);
    await this.assertTradeCreditSku(params.organizationId);

    if (params.invoiceId) {
      const inv = await this.prisma.invoice.findFirst({
        where: {
          id: params.invoiceId,
          organizationId: params.organizationId,
          counterpartyId: params.counterpartyId,
        },
        select: { id: true },
      });
      if (!inv) throw new BadRequestException("Invoice not found");
    }

    const facility = await this.prisma.tradeCreditFacility.findUnique({
      where: {
        organizationId_counterpartyId: {
          organizationId: params.organizationId,
          counterpartyId: params.counterpartyId,
        },
      },
      select: { creditLimit: true, stopList: true },
    });

    const openArAgg = await this.prisma.invoice.findMany({
      where: {
        organizationId: params.organizationId,
        counterpartyId: params.counterpartyId,
        status: {
          in: [
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.LOCKED_BY_SIGNATURE,
          ],
        },
      },
      select: { totalAmount: true, paidAmount: true },
      take: 200,
    });
    const openAr = openArAgg.reduce(
      (s, i) => s + (Number(i.totalAmount) - Number(i.paidAmount ?? 0)),
      0,
    );

    // Hashed discipline stats — never А–Г letter
    const statsPayload = JSON.stringify({
      creditLimit: facility ? Number(facility.creditLimit) : 0,
      openAr: Math.round(openAr * 100) / 100,
      stopList: facility?.stopList ?? false,
      invoiceId: params.invoiceId ?? null,
    });
    const hashedStatsJson = {
      sha256: createHash("sha256").update(statsPayload).digest("hex"),
      openArBucket:
        openAr < 1000 ? "lt1k" : openAr < 10000 ? "1k_10k" : "gte10k",
    };

    const lead = await this.prisma.tradeCreditFactorLead.create({
      data: {
        organizationId: params.organizationId,
        counterpartyId: params.counterpartyId,
        invoiceId: params.invoiceId ?? null,
        partnerKey: params.partnerKey?.trim() || "default",
        status: "SUBMITTED",
        note: params.note?.trim() || null,
        hashedStatsJson,
      },
    });

    return {
      id: lead.id,
      status: lead.status,
      partnerKey: lead.partnerKey,
      invoiceId: lead.invoiceId,
      createdAt: lead.createdAt.toISOString(),
      // Referral only — no GL disbursement
      message: "Factoring lead submitted to partner queue (no GL posted)",
    };
  }

  private serializeEnrichment(r: {
    id: string;
    provider: string;
    paidMeterUnits: number;
    billed: boolean;
    consentPurpose: string;
    riskyTaxpayer: boolean | null;
    voenInactive: boolean | null;
    voenName: string | null;
    errorMessage: string | null;
    createdAt: Date;
    createdByUserId: string | null;
  }) {
    return {
      id: r.id,
      provider: r.provider,
      paidMeterUnits: r.paidMeterUnits,
      billed: r.billed,
      consentPurpose: r.consentPurpose,
      riskyTaxpayer: r.riskyTaxpayer,
      voenInactive: r.voenInactive,
      voenName: r.voenName,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
      createdByUserId: r.createdByUserId,
    };
  }
}
