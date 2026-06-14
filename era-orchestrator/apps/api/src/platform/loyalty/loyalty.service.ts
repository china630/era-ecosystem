import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PlatformPromotionDiscountType,
  PlatformPromotionStatus,
  Prisma,
} from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformEntitlementService } from "../platform-entitlement.service";
import { PlatformAuditService } from "../platform-audit.service";
import { PlatformIdempotencyService } from "../platform-idempotency.service";

const ENTITLEMENT = "platform_loyalty";

export type CreatePromotionInput = {
  code: string;
  name: string;
  discountType: "PERCENT" | "FIXED_AZN";
  discountValue: number;
  validFrom?: string;
  validUntil?: string;
  status?: "ACTIVE" | "DISABLED";
  metadata?: Record<string, unknown>;
};

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: PlatformEntitlementService,
    private readonly audit: PlatformAuditService,
    private readonly idempotency: PlatformIdempotencyService,
  ) {}

  async createPromotion(organizationId: string, body: CreatePromotionInput) {
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);

    const code = body.code?.trim();
    const name = body.name?.trim();
    if (!code || code.length > 64) {
      throw new BadRequestException("code is required (max 64 chars)");
    }
    if (!name) {
      throw new BadRequestException("name is required");
    }

    const discountType =
      body.discountType === "FIXED_AZN"
        ? PlatformPromotionDiscountType.FIXED_AZN
        : PlatformPromotionDiscountType.PERCENT;

    const discountValue = Number(body.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      throw new BadRequestException("discountValue must be positive");
    }
    if (
      discountType === PlatformPromotionDiscountType.PERCENT &&
      discountValue > 100
    ) {
      throw new BadRequestException("percent discount cannot exceed 100");
    }

    const validFrom = body.validFrom ? new Date(body.validFrom) : null;
    const validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (validFrom && Number.isNaN(validFrom.getTime())) {
      throw new BadRequestException("Invalid validFrom");
    }
    if (validUntil && Number.isNaN(validUntil.getTime())) {
      throw new BadRequestException("Invalid validUntil");
    }
    if (validFrom && validUntil && validUntil <= validFrom) {
      throw new BadRequestException("validUntil must be after validFrom");
    }

    const status =
      body.status === "DISABLED"
        ? PlatformPromotionStatus.DISABLED
        : PlatformPromotionStatus.ACTIVE;

    const promotion = await this.prisma.platformPromotion.upsert({
      where: {
        organizationId_code: { organizationId, code },
      },
      create: {
        organizationId,
        code,
        name,
        discountType,
        discountValue: new Prisma.Decimal(discountValue),
        validFrom,
        validUntil,
        status,
        metadata: (body.metadata ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        name,
        discountType,
        discountValue: new Prisma.Decimal(discountValue),
        validFrom,
        validUntil,
        status,
        metadata: (body.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    return {
      id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      discountType: promotion.discountType,
      discountValue: Number(promotion.discountValue),
      validFrom: promotion.validFrom,
      validUntil: promotion.validUntil,
      status: promotion.status,
    };
  }

  async getPromotionByCode(organizationId: string, code: string) {
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);
    const normalized = code?.trim();
    if (!normalized) {
      throw new BadRequestException("code query param required");
    }
    const promotion = await this.prisma.platformPromotion.findUnique({
      where: {
        organizationId_code: { organizationId, code: normalized },
      },
    });
    if (!promotion) {
      throw new NotFoundException("Promotion not found");
    }
    await this.audit.log({
      organizationId,
      addonSlug: ENTITLEMENT,
      action: "promotion.upserted",
      payload: { code: promotion.code },
    });
    return {
      id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      discountType: promotion.discountType,
      discountValue: Number(promotion.discountValue),
      validFrom: promotion.validFrom,
      validUntil: promotion.validUntil,
      status: promotion.status,
      mode: "live",
    };
  }

  async earnPoints(
    organizationId: string,
    customerRef: string,
    points: number,
    reason: string,
  ) {
    this.idempotency.assertLiveMode();
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);
    const row = await this.prisma.platformLoyaltyLedger.create({
      data: { organizationId, customerRef, pointsDelta: points, reason },
    });
    const balance = await this.getPointsBalance(organizationId, customerRef);
    return { entry: row, balance, mode: "live" };
  }

  async burnPromotion(
    organizationId: string,
    customerRef: string,
    code: string,
  ) {
    this.idempotency.assertLiveMode();
    const promotion = await this.getPromotionByCode(organizationId, code);
    if (promotion.status !== "ACTIVE") {
      throw new BadRequestException("Promotion not active");
    }
    const burnPoints =
      promotion.discountType === "PERCENT" ? 0 : Math.ceil(promotion.discountValue);
    await this.prisma.platformLoyaltyLedger.create({
      data: {
        organizationId,
        customerRef,
        pointsDelta: -Math.max(burnPoints, 1),
        reason: "promo_burn",
        promotionCode: code,
      },
    });
    await this.audit.log({
      organizationId,
      addonSlug: ENTITLEMENT,
      action: "promotion.burned",
      payload: { customerRef, code },
    });
    return { promotion, burned: true, mode: "live" };
  }

  async burnPoints(
    organizationId: string,
    customerRef: string,
    points: number,
    idempotencyKey?: string,
    reason = "points_burn",
  ) {
    this.idempotency.assertLiveMode();
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);
    const debit = Math.ceil(Number(points));
    if (!Number.isFinite(debit) || debit <= 0) {
      throw new BadRequestException("points must be positive");
    }
    const balance = await this.getPointsBalance(organizationId, customerRef);
    if (balance < debit) {
      throw new BadRequestException("Insufficient loyalty points");
    }
    const row = await this.prisma.platformLoyaltyLedger.create({
      data: {
        organizationId,
        customerRef,
        pointsDelta: -debit,
        reason: idempotencyKey ? `${reason}:${idempotencyKey}` : reason,
      },
    });
    await this.audit.log({
      organizationId,
      addonSlug: ENTITLEMENT,
      action: "points.burned",
      payload: { customerRef, points: debit, idempotencyKey },
    });
    return {
      entry: row,
      burned: debit,
      balance: balance - debit,
      mode: "live" as const,
    };
  }

  async getPointsBalance(organizationId: string, customerRef: string) {
    const rows = await this.prisma.platformLoyaltyLedger.findMany({
      where: { organizationId, customerRef },
    });
    return rows.reduce((s, r) => s + r.pointsDelta, 0);
  }
}
