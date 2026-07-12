import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Decimal, type Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateDiscountRuleDto,
  CreatePriceListDto,
  UpdateDiscountRuleDto,
  UpdatePriceListDto,
} from "./dto/price-list.dto";

export type ResolvedPrice = {
  unitPrice: Decimal;
  discountApplied: Decimal;
  priceListId: string | null;
  baseUnitPrice: Decimal;
};

@Injectable()
export class PriceListsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string, opts?: { isActive?: boolean }) {
    return this.prisma.priceList.findMany({
      where: {
        organizationId,
        ...(opts?.isActive !== undefined ? { isActive: opts.isActive } : {}),
      },
      orderBy: [{ validFrom: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { lines: true, discountRules: true } },
      },
    });
  }

  async getOne(organizationId: string, id: string) {
    const row = await this.prisma.priceList.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          orderBy: { createdAt: "asc" },
          include: {
            product: { select: { id: true, name: true, sku: true, price: true } },
          },
        },
        discountRules: { orderBy: { validFrom: "desc" } },
      },
    });
    if (!row) throw new NotFoundException("Price list not found");
    return row;
  }

  async create(organizationId: string, dto: CreatePriceListDto) {
    return this.prisma.$transaction(async (tx) => {
      const list = await tx.priceList.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          currencyCode: (dto.currencyCode ?? "AZN").trim().toUpperCase(),
          validFrom: parseYmd(dto.validFrom),
          validTo: dto.validTo ? parseYmd(dto.validTo) : null,
          channel: dto.channel?.trim() || null,
          segment: dto.segment?.trim() || null,
        },
      });
      if (dto.lines?.length) {
        await this.replaceLinesTx(tx, organizationId, list.id, dto.lines);
      }
      return tx.priceList.findUniqueOrThrow({
        where: { id: list.id },
        include: { lines: true },
      });
    });
  }

  async update(organizationId: string, id: string, dto: UpdatePriceListDto) {
    const existing = await this.prisma.priceList.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Price list not found");

    return this.prisma.$transaction(async (tx) => {
      await tx.priceList.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.currencyCode !== undefined && {
            currencyCode: dto.currencyCode.trim().toUpperCase(),
          }),
          ...(dto.validFrom !== undefined && { validFrom: parseYmd(dto.validFrom) }),
          ...(dto.validTo !== undefined && {
            validTo: dto.validTo ? parseYmd(dto.validTo) : null,
          }),
          ...(dto.channel !== undefined && { channel: dto.channel?.trim() || null }),
          ...(dto.segment !== undefined && { segment: dto.segment?.trim() || null }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
      if (dto.lines) {
        await this.replaceLinesTx(tx, organizationId, id, dto.lines);
      }
      return tx.priceList.findUniqueOrThrow({
        where: { id },
        include: { lines: { include: { product: { select: { id: true, name: true, sku: true } } } } },
      });
    });
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.prisma.priceList.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Price list not found");
    await this.prisma.priceList.update({
      where: { id },
      data: { isActive: false },
    });
    return { ok: true };
  }

  listDiscountRules(organizationId: string, priceListId?: string) {
    return this.prisma.discountRule.findMany({
      where: {
        organizationId,
        ...(priceListId ? { priceListId } : {}),
      },
      orderBy: [{ validFrom: "desc" }, { name: "asc" }],
    });
  }

  async createDiscountRule(organizationId: string, dto: CreateDiscountRuleDto) {
    this.assertDiscountShape(dto.percentOff, dto.amountOff);
    if (dto.priceListId) {
      await this.assertPriceList(organizationId, dto.priceListId);
    }
    if (dto.counterpartyId) {
      await this.assertCounterparty(organizationId, dto.counterpartyId);
    }
    return this.prisma.discountRule.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        counterpartyId: dto.counterpartyId ?? null,
        priceListId: dto.priceListId ?? null,
        channel: dto.channel?.trim() || null,
        minQty: dto.minQty != null ? new Decimal(dto.minQty) : null,
        percentOff: dto.percentOff != null ? new Decimal(dto.percentOff) : null,
        amountOff: dto.amountOff != null ? new Decimal(dto.amountOff) : null,
        validFrom: parseYmd(dto.validFrom),
        validTo: dto.validTo ? parseYmd(dto.validTo) : null,
      },
    });
  }

  async updateDiscountRule(
    organizationId: string,
    id: string,
    dto: UpdateDiscountRuleDto,
  ) {
    const existing = await this.prisma.discountRule.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Discount rule not found");
    if (dto.percentOff !== undefined || dto.amountOff !== undefined) {
      this.assertDiscountShape(
        dto.percentOff ?? existing.percentOff?.toNumber(),
        dto.amountOff ?? existing.amountOff?.toNumber(),
      );
    }
    if (dto.priceListId) await this.assertPriceList(organizationId, dto.priceListId);
    if (dto.counterpartyId) await this.assertCounterparty(organizationId, dto.counterpartyId);

    return this.prisma.discountRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.code !== undefined && { code: dto.code?.trim() || null }),
        ...(dto.counterpartyId !== undefined && { counterpartyId: dto.counterpartyId }),
        ...(dto.priceListId !== undefined && { priceListId: dto.priceListId }),
        ...(dto.channel !== undefined && { channel: dto.channel?.trim() || null }),
        ...(dto.minQty !== undefined && {
          minQty: dto.minQty != null ? new Decimal(dto.minQty) : null,
        }),
        ...(dto.percentOff !== undefined && {
          percentOff: dto.percentOff != null ? new Decimal(dto.percentOff) : null,
        }),
        ...(dto.amountOff !== undefined && {
          amountOff: dto.amountOff != null ? new Decimal(dto.amountOff) : null,
        }),
        ...(dto.validFrom !== undefined && { validFrom: parseYmd(dto.validFrom) }),
        ...(dto.validTo !== undefined && {
          validTo: dto.validTo ? parseYmd(dto.validTo) : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async removeDiscountRule(organizationId: string, id: string) {
    const existing = await this.prisma.discountRule.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException("Discount rule not found");
    await this.prisma.discountRule.update({
      where: { id },
      data: { isActive: false },
    });
    return { ok: true };
  }

  async resolvePrice(
    organizationId: string,
    input: {
      productId: string;
      counterpartyId?: string;
      channel?: string;
      qty?: number;
      asOfDate?: Date | string;
    },
  ): Promise<ResolvedPrice> {
    const asOf =
      input.asOfDate instanceof Date
        ? input.asOfDate
        : input.asOfDate
          ? parseYmd(String(input.asOfDate).slice(0, 10))
          : new Date();

    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, organizationId },
    });
    if (!product) throw new NotFoundException(`Product ${input.productId} not found`);

    const qty = new Decimal(input.qty ?? 1);
    const channel = input.channel?.trim() || undefined;

    const lists = await this.prisma.priceList.findMany({
      where: {
        organizationId,
        isActive: true,
        validFrom: { lte: asOf },
        AND: [
          { OR: [{ validTo: null }, { validTo: { gte: asOf } }] },
          ...(channel ? [{ OR: [{ channel }, { channel: null }] }] : []),
        ],
      },
      orderBy: [{ channel: "desc" }, { validFrom: "desc" }],
      include: {
        lines: { where: { productId: input.productId }, take: 1 },
      },
    });

    let baseUnitPrice = new Decimal(product.price);
    let priceListId: string | null = null;

    for (const list of lists) {
      const line = list.lines[0];
      if (line) {
        baseUnitPrice = new Decimal(line.unitPrice);
        priceListId = list.id;
        break;
      }
    }

    const rules = await this.prisma.discountRule.findMany({
      where: {
        organizationId,
        isActive: true,
        validFrom: { lte: asOf },
        OR: [{ validTo: null }, { validTo: { gte: asOf } }],
        AND: [
          {
            OR: [
              { counterpartyId: input.counterpartyId ?? undefined },
              { counterpartyId: null },
            ],
          },
          ...(channel
            ? [{ OR: [{ channel }, { channel: null }] }]
            : [{ OR: [{ channel: null }, { channel: { not: null } }] }]),
          {
            OR: [{ priceListId: priceListId ?? undefined }, { priceListId: null }],
          },
        ],
      },
    });

    let bestDiscount = new Decimal(0);
    for (const rule of rules) {
      if (rule.counterpartyId && rule.counterpartyId !== input.counterpartyId) continue;
      if (rule.channel && channel && rule.channel !== channel) continue;
      if (rule.priceListId && rule.priceListId !== priceListId) continue;
      const minQty = rule.minQty ?? new Decimal(0);
      if (qty.lt(minQty)) continue;

      let discount = new Decimal(0);
      if (rule.percentOff && rule.percentOff.gt(0)) {
        discount = baseUnitPrice.mul(rule.percentOff).div(100);
      } else if (rule.amountOff && rule.amountOff.gt(0)) {
        discount = new Decimal(rule.amountOff);
      }
      if (discount.gt(bestDiscount)) bestDiscount = discount;
    }

    const unitPrice = Decimal.max(baseUnitPrice.sub(bestDiscount), new Decimal(0));
    return {
      unitPrice,
      discountApplied: bestDiscount,
      priceListId,
      baseUnitPrice,
    };
  }

  private async replaceLinesTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    priceListId: string,
    lines: Array<{ productId: string; unitPrice: number }>,
  ) {
    const productIds = [...new Set(lines.map((l) => l.productId))];
    const found = await tx.product.count({
      where: { organizationId, id: { in: productIds } },
    });
    if (found !== productIds.length) {
      throw new BadRequestException("One or more products not found in organization");
    }

    await tx.priceListLine.deleteMany({ where: { priceListId, organizationId } });
    for (const line of lines) {
      await tx.priceListLine.create({
        data: {
          organizationId,
          priceListId,
          productId: line.productId,
          unitPrice: new Decimal(line.unitPrice),
        },
      });
    }
  }

  private assertDiscountShape(percentOff?: number | null, amountOff?: number | null) {
    const hasPct = percentOff != null && percentOff > 0;
    const hasAmt = amountOff != null && amountOff > 0;
    if (!hasPct && !hasAmt) {
      throw new BadRequestException("Discount rule requires percentOff or amountOff");
    }
  }

  private async assertPriceList(organizationId: string, id: string) {
    const row = await this.prisma.priceList.findFirst({ where: { id, organizationId } });
    if (!row) throw new BadRequestException("Price list not found");
  }

  private async assertCounterparty(organizationId: string, id: string) {
    const row = await this.prisma.counterparty.findFirst({ where: { id, organizationId } });
    if (!row) throw new BadRequestException("Counterparty not found");
  }
}

function parseYmd(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T12:00:00.000Z`);
}
