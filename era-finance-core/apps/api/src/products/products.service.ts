import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AccountType, LedgerType } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  listUnitsOfMeasure() {
    return this.prisma.unitOfMeasure.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: {
        code: true,
        nameAz: true,
        nameRu: true,
        nameEn: true,
      },
    });
  }

  async list(
    orgId: string,
    opts?: { isService?: string; search?: string; limit?: number; channel?: string },
  ) {
    const searchTrim = opts?.search?.trim() ?? "";
    const cap = opts?.channel && !searchTrim ? 500 : 50;
    const limit = opts?.limit !== undefined ? Math.min(Math.max(opts.limit, 1), cap) : undefined;
    const take =
      searchTrim.length > 0 ? (limit ?? 20) : limit !== undefined ? limit : undefined;
    const channel = opts?.channel?.trim();
    let channelIds: string[] | undefined;
    if (channel) {
      const lines = await this.prisma.priceListLine.findMany({
        where: {
          organizationId: orgId,
          priceList: { organizationId: orgId, isActive: true, channel },
        },
        select: { productId: true },
      });
      channelIds = [...new Set(lines.map((line) => line.productId))];
    }

    return this.prisma.product.findMany({
      where: {
        organizationId: orgId,
        ...(channelIds ? { id: { in: channelIds } } : {}),
        ...(opts?.isService === "false" ? { isService: false } : {}),
        ...(opts?.isService === "true" ? { isService: true } : {}),
        ...(searchTrim.length > 0
          ? {
              OR: [
                { name: { contains: searchTrim, mode: "insensitive" } },
                { sku: { contains: searchTrim, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      ...(take !== undefined ? { take } : {}),
    });
  }

  async pricesForChannel(orgId: string, channel: string): Promise<Map<string, number>> {
    const lines = await this.prisma.priceListLine.findMany({
      where: {
        organizationId: orgId,
        priceList: { organizationId: orgId, isActive: true, channel },
      },
      select: { productId: true, unitPrice: true },
    });
    const prices = new Map<string, number>();
    for (const line of lines) prices.set(line.productId, Number(line.unitPrice));
    return prices;
  }

  async getOne(orgId: string, id: string) {
    const row = await this.prisma.product.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!row) throw new NotFoundException("Product not found");
    return row;
  }

  private async assertRevenueAccount(
    orgId: string,
    isService: boolean,
    revenueAccountCode: string | null,
  ) {
    if (!revenueAccountCode) {
      if (isService) {
        throw new BadRequestException("revenueAccountCode is required for a service");
      }
      return;
    }
    const account = await this.prisma.account.findFirst({
      where: {
        organizationId: orgId,
        code: revenueAccountCode,
        ledgerType: LedgerType.NAS,
        type: AccountType.REVENUE,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!account) {
      throw new BadRequestException(
        `Revenue account ${revenueAccountCode} was not found on the NAS chart`,
      );
    }
  }

  async create(orgId: string, dto: CreateProductDto) {
    const isService = dto.isService ?? false;
    const sku = (dto.sku ?? "").trim();
    if (!sku) throw new BadRequestException("sku is required");
    const revenueAccountCode = dto.revenueAccountCode?.trim() || null;
    await this.assertRevenueAccount(orgId, isService, revenueAccountCode);

    const unitOfMeasureCode = dto.unitOfMeasureCode?.trim() || null;
    if (unitOfMeasureCode) {
      const uom = await this.prisma.unitOfMeasure.findUnique({
        where: { code: unitOfMeasureCode },
        select: { code: true },
      });
      if (!uom) throw new BadRequestException("Unknown unitOfMeasureCode");
    }

    return this.prisma.product.create({
      data: {
        organizationId: orgId,
        name: dto.name.trim(),
        sku,
        price: dto.price,
        vatRate: dto.vatRate,
        isService,
        unitOfMeasureCode,
        revenueAccountCode,
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Product not found");
    const isService = dto.isService ?? existing.isService;
    const revenueAccountCode =
      dto.revenueAccountCode !== undefined
        ? dto.revenueAccountCode.trim() || null
        : existing.revenueAccountCode;
    await this.assertRevenueAccount(orgId, isService, revenueAccountCode);
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sku !== undefined && { sku: dto.sku.trim() }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.vatRate !== undefined && { vatRate: dto.vatRate }),
        ...(dto.isService !== undefined && { isService: dto.isService }),
        ...(dto.revenueAccountCode !== undefined && { revenueAccountCode }),
        ...(dto.unitOfMeasureCode !== undefined
          ? { unitOfMeasureCode: dto.unitOfMeasureCode?.trim() || null }
          : {}),
      },
    });
  }
}
