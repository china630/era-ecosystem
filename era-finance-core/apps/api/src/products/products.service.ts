import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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

  list(
    orgId: string,
    opts?: { isService?: string; search?: string; limit?: number },
  ) {
    const searchTrim = opts?.search?.trim() ?? "";
    const limit = opts?.limit !== undefined ? Math.min(Math.max(opts.limit, 1), 50) : undefined;
    const take =
      searchTrim.length > 0 ? (limit ?? 20) : limit !== undefined ? limit : undefined;

    return this.prisma.product.findMany({
      where: {
        organizationId: orgId,
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

  async getOne(orgId: string, id: string) {
    const row = await this.prisma.product.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!row) throw new NotFoundException("Product not found");
    return row;
  }

  async create(orgId: string, dto: CreateProductDto) {
    const isService = dto.isService ?? false;
    let sku = (dto.sku ?? "").trim();
    if (!isService) {
      if (!sku) throw new BadRequestException("sku is required for goods");
    } else if (!sku) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const candidate = `SVC-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
        const clash = await this.prisma.product.findFirst({
          where: { organizationId: orgId, sku: candidate },
          select: { id: true },
        });
        if (!clash) {
          sku = candidate;
          break;
        }
      }
      if (!sku) {
        throw new BadRequestException("Could not allocate internal SKU for service");
      }
    }

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
      },
    });
  }

  async update(orgId: string, id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Product not found");
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.vatRate !== undefined && { vatRate: dto.vatRate }),
        ...(dto.isService !== undefined && { isService: dto.isService }),
        ...(dto.unitOfMeasureCode !== undefined
          ? { unitOfMeasureCode: dto.unitOfMeasureCode?.trim() || null }
          : {}),
      },
    });
  }
}
