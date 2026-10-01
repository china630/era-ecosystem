import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PaymentOrderStatus,
  Prisma,
  TariffTier,
} from "@erafinance/database";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "./billing.service";
import { SystemConfigService } from "../system-config/system-config.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import type { CheckoutDto } from "./dto/checkout.dto";
import { PashaBankPaymentProvider } from "./providers/pasha-bank-payment.provider";
import { DrakarisPaymentProvider } from "../integrations/payment-providers/drakaris/drakaris-payment.provider";
import { BillingPlatformService } from "./billing-platform.service";
import {
  catalogModuleKeyToPatch,
  parseToggleModuleMetadata,
  TOGGLE_MODULE_META_PURPOSE,
} from "./billing-module-toggle.helpers";
import { OrganizationModuleService } from "./organization-module.service";
import { BillingSettlementService } from "./billing-settlement.service";

@Injectable()
export class PaymentProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly billingPlatform: BillingPlatformService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly orgModules: OrganizationModuleService,
    private readonly pasha: PashaBankPaymentProvider,
    private readonly drakaris: DrakarisPaymentProvider,
    private readonly config: ConfigService,
    private readonly systemConfig: SystemConfigService,
    private readonly audit: AuditService,
    private readonly billingSettlement: BillingSettlementService,
  ) {}

  /**
   * Создаёт заказ и возвращает URL оплаты (PAŞA Bank или mock-редирект).
   */
  async createOrder(
    organizationId: string,
    dto: CheckoutDto,
  ): Promise<{ orderId: string; paymentUrl: string; providerMode: string }> {
    const months = dto.months ?? 1;
    let amountAzn = dto.amountAzn;
    if (dto.tier != null) {
      const newTier = dto.tier as TariffTier;
      if (months === 1 && newTier === TariffTier.TIER_3) {
        const pr = await this.billing.calculateUpgradePrice(organizationId, newTier);
        amountAzn = pr.currentTier === TariffTier.TIER_1 ? pr.amountAzn : await this.systemConfig.getBillingPriceAzn(newTier);
      } else {
        amountAzn = await this.systemConfig.getBillingPriceAzn(newTier);
      }
    }

    const webApp = this.config
      .get<string>("WEB_APP_PUBLIC_URL", "http://localhost:3000")
      .replace(/\/$/, "");
    const apiPublic = this.config
      .get<string>("API_PUBLIC_URL", "http://127.0.0.1:4000")
      .replace(/\/$/, "");

    const paymentKind = dto.provider ?? "pasha_bank";

    const order = await this.prisma.paymentOrder.create({
      data: {
        organizationId,
        amountAzn: new Prisma.Decimal(amountAzn),
        monthsApplied: months,
        description: `Subscription renewal (${months} mo.)`,
        idempotencyKey: dto.idempotencyKey ?? null,
        status: PaymentOrderStatus.PENDING,
        provider: paymentKind === "drakaris" ? "drakaris" : "pasha_bank",
        metadata: {},
      },
    });

    const returnUrl = `${webApp}/billing/success?orderId=${encodeURIComponent(order.id)}`;
    const callbackUrl = `${apiPublic}/api/billing/webhooks/pasha_bank`;

    if (paymentKind === "drakaris") {
      const session = await this.drakaris.createPaymentSession({
        internalOrderId: order.id,
        organizationId,
        amount: amountAzn,
        currency: "AZN",
        description: order.description,
        returnUrl,
        callbackUrl,
      });
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          provider: "drakaris",
          providerTxnId: session.externalId ?? null,
          metadata: {
            lastPaymentUrl: session.paymentUrl,
            providerMode: session.providerMode,
          } as Prisma.InputJsonValue,
        },
      });
      return {
        orderId: order.id,
        paymentUrl: session.paymentUrl,
        providerMode: session.providerMode,
      };
    }

    const session = await this.pasha.createPaymentSession({
      internalOrderId: order.id,
      organizationId,
      amount: amountAzn,
      currency: "AZN",
      description: order.description,
      returnUrl,
      callbackUrl,
    });

    const provider =
      session.providerMode === "mock" ? "mock" : "pasha_bank";
    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        provider,
        providerTxnId: session.externalId ?? null,
        metadata: {
          lastPaymentUrl: session.paymentUrl,
          providerMode: session.providerMode,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      orderId: order.id,
      paymentUrl: session.paymentUrl,
      providerMode: session.providerMode,
    };
  }

  /**
   * Заказ Pro-rata за включение модуля до конца текущего месяца (`monthsApplied: 0`).
   * После оплаты модуль включается в `finalizePaidOrder` по metadata.
   */
  async createProRataModuleOrder(
    organizationId: string,
    amountAzn: number,
    moduleKey: string,
  ): Promise<{ orderId: string; paymentUrl: string; providerMode: string }> {
    const webApp = this.config
      .get<string>("WEB_APP_PUBLIC_URL", "http://localhost:3000")
      .replace(/\/$/, "");
    const apiPublic = this.config
      .get<string>("API_PUBLIC_URL", "http://127.0.0.1:4000")
      .replace(/\/$/, "");

    const order = await this.prisma.paymentOrder.create({
      data: {
        organizationId,
        amountAzn: new Prisma.Decimal(amountAzn),
        monthsApplied: 0,
        description: `Pro-rata: enable module ${moduleKey} until month end`,
        idempotencyKey: null,
        status: PaymentOrderStatus.PENDING,
        provider: "pasha_bank",
        metadata: {
          purpose: TOGGLE_MODULE_META_PURPOSE,
          moduleKey,
          enabled: true,
        } as Prisma.InputJsonValue,
      },
    });

    const returnUrl = `${webApp}/billing/success?orderId=${encodeURIComponent(order.id)}`;
    const callbackUrl = `${apiPublic}/api/billing/webhooks/pasha_bank`;

    const session = await this.pasha.createPaymentSession({
      internalOrderId: order.id,
      organizationId,
      amount: amountAzn,
      currency: "AZN",
      description: order.description,
      returnUrl,
      callbackUrl,
    });

    const provider =
      session.providerMode === "mock" ? "mock" : "pasha_bank";
    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        provider,
        providerTxnId: session.externalId ?? null,
        metadata: {
          purpose: TOGGLE_MODULE_META_PURPOSE,
          moduleKey,
          enabled: true,
          lastPaymentUrl: session.paymentUrl,
          providerMode: session.providerMode,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      orderId: order.id,
      paymentUrl: session.paymentUrl,
      providerMode: session.providerMode,
    };
  }

  /** Called by Drakaris/yığım inbound API after creating a pending PaymentOrder. */
  async finalizePaidOrderPublic(orderId: string): Promise<void> {
    await this.finalizePaidOrder(orderId);
  }

  /**
   * TZ §14.8 / v12.7: сначала проверяем владельца для платформенного счёта, затем PAID → продление → SubscriptionInvoice + BillingInvoiceItem.
   */
  private async finalizePaidOrder(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentOrder.findUnique({
        where: { id: orderId },
        include: { organization: true },
      });
      if (!current) {
        throw new BadRequestException("Payment order not found");
      }

      if (current.status === PaymentOrderStatus.PAID) {
        await this.billingPlatform.recordPaidOrderInvoice(tx, orderId);
        return;
      }

      if (current.status !== PaymentOrderStatus.PENDING) {
        throw new BadRequestException("Payment order cannot be completed");
      }

      const ownerUserId = await this.billingPlatform.resolveOwnerUserId(
        tx,
        current.organizationId,
      );
      if (!ownerUserId) {
        throw new BadRequestException({
          code: "BILLING_OWNER_REQUIRED",
          message:
            "Cannot finalize payment: organization has no billable owner for platform billing.",
        });
      }

      const marked = await tx.paymentOrder.updateMany({
        where: { id: orderId, status: PaymentOrderStatus.PENDING },
        data: {
          status: PaymentOrderStatus.PAID,
          paidAt: new Date(),
        },
      });

      if (marked.count === 0) {
        const again = await tx.paymentOrder.findUnique({ where: { id: orderId } });
        if (again?.status === PaymentOrderStatus.PAID) {
          await this.billingPlatform.recordPaidOrderInvoice(tx, orderId);
          return;
        }
        throw new BadRequestException("Payment order cannot be completed");
      }

      const toggleMeta = parseToggleModuleMetadata(current.metadata);
      if (
        toggleMeta?.enabled === true &&
        current.monthsApplied === 0 &&
        toggleMeta.moduleKey
      ) {
        await this.subscriptionAccess.updateModuleAddons(
          current.organizationId,
          catalogModuleKeyToPatch(toggleMeta.moduleKey, true),
          tx,
        );
        const pm = await tx.pricingModule.findUnique({
          where: { key: toggleMeta.moduleKey },
        });
        if (pm) {
          await this.orgModules.upsertActiveInTx(
            tx,
            current.organizationId,
            toggleMeta.moduleKey,
            pm.pricePerMonth,
          );
        }
      } else if (current.monthsApplied > 0) {
        await this.billing.extendSubscriptionByMonths(
          current.organizationId,
          current.monthsApplied,
          tx,
          { clearTrial: true },
        );
      }

      await this.audit.logPlatformBillingPaymentApplied(tx, orderId, {
        organizationId: current.organizationId,
        amountAzn: current.amountAzn.toString(),
        monthsApplied: current.monthsApplied,
        ownerUserId,
      });

      await this.billingPlatform.recordPaidOrderInvoice(tx, orderId);

      const meta =
        current.metadata != null && typeof current.metadata === "object"
          ? (current.metadata as Record<string, unknown>)
          : {};
      const tierIntradyUnlock = meta.tierIntradyUnlock === true;
      await this.billingSettlement.settleOrganizationsForOwner(ownerUserId, {
        tierBumpOrganizationIds: tierIntradyUnlock
          ? [current.organizationId]
          : undefined,
      });
    });
  }

  /** Intraday tier-ceiling unlock: pay → bump tier (metadata.tierIntradyUnlock). */
  async createTierCeilingUnlockOrder(
    organizationId: string,
    amountAzn: number,
  ): Promise<{ orderId: string; paymentUrl: string; providerMode: string }> {
    const session = await this.createOrder(organizationId, {
      amountAzn,
      provider: "pasha_bank",
    });
    await this.prisma.paymentOrder.update({
      where: { id: session.orderId },
      data: {
        description: "Tier spend ceiling unlock",
        metadata: {
          tierIntradyUnlock: true,
        } as Prisma.InputJsonValue,
      },
    });
    return session;
  }
}

