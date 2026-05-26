import {
  BadRequestException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PlatformPaymentLinkStatus,
  Prisma,
} from "@era365/database";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentProviderService } from "../../billing/payment-provider.service";
import { PlatformEntitlementService } from "../platform-entitlement.service";

const ENTITLEMENT = "platform_payments";

export type CreatePaymentLinkInput = {
  amountAzn: number;
  counterpartyRef?: string;
  sourceEntityType: string;
  sourceEntityId: string;
  description?: string;
  expiresInHours?: number;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: PlatformEntitlementService,
    private readonly paymentProvider: PaymentProviderService,
    private readonly config: ConfigService,
  ) {}

  async createPaymentLink(organizationId: string, body: CreatePaymentLinkInput) {
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);

    const amount = Number(body.amountAzn);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("amountAzn must be positive");
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt =
      body.expiresInHours != null
        ? new Date(Date.now() + body.expiresInHours * 3600_000)
        : new Date(Date.now() + 72 * 3600_000);

    const link = await this.prisma.platformPaymentLink.create({
      data: {
        organizationId,
        amountAzn: new Prisma.Decimal(amount),
        counterpartyRef: body.counterpartyRef ?? null,
        sourceEntityType: body.sourceEntityType,
        sourceEntityId: body.sourceEntityId,
        token,
        expiresAt,
        status: PlatformPaymentLinkStatus.PENDING,
        metadata: {
          description: body.description ?? "Platform payment link",
        },
      },
    });

    const session = await this.paymentProvider.createOrder(organizationId, {
      amountAzn: amount,
      provider: "pasha_bank",
      idempotencyKey: `ppl-${link.id}`,
    });

    const publicBase = this.config
      .get<string>("WEB_APP_PUBLIC_URL", "http://localhost:3000")
      .replace(/\/$/, "");
    const linkUrl = `${publicBase}/pay/${token}`;

    const updated = await this.prisma.platformPaymentLink.update({
      where: { id: link.id },
      data: {
        paymentOrderId: session.orderId,
        paymentUrl: session.paymentUrl,
      },
    });

    return {
      id: updated.id,
      token: updated.token,
      paymentUrl: session.paymentUrl,
      portalPayUrl: linkUrl,
      amountAzn: amount,
      expiresAt: updated.expiresAt,
      status: updated.status,
    };
  }

  async getPaymentLinkByToken(token: string) {
    const link = await this.prisma.platformPaymentLink.findUnique({
      where: { token },
    });
    if (!link) {
      throw new BadRequestException("Payment link not found");
    }
    if (link.expiresAt && link.expiresAt < new Date()) {
      return { ...link, expired: true };
    }
    return { ...link, expired: false };
  }
}
