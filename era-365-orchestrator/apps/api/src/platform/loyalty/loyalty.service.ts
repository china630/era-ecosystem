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
}
