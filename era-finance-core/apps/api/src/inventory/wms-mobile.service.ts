import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PickListStatus, Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { BinBalanceService } from "./bin-balance.service";
import type {
  ConfirmPickLineDto,
  CreatePickListDto,
  CreateWarehouseZoneDto,
  UpdateWarehouseZoneDto,
} from "./dto/wms.dto";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

@Injectable()
export class WmsMobileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bins: BinBalanceService,
  ) {}

  async scanByBarcode(
    organizationId: string,
    barcode: string,
    warehouseId?: string,
  ) {
    const trimmed = barcode.trim();
    if (!trimmed) {
      throw new BadRequestException("barcode is required");
    }
    const bin = await this.prisma.warehouseBin.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [{ barcode: trimmed }, { code: trimmed }],
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        zone: { select: { id: true, code: true, name: true, zoneType: true } },
        binBalances: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
          orderBy: { product: { name: "asc" } },
        },
      },
    });
    if (!bin) {
      throw new NotFoundException("Bin not found for barcode");
    }
    return bin;
  }

  async listZones(organizationId: string, warehouseId: string) {
    await this.requireWarehouse(organizationId, warehouseId);
    return this.prisma.warehouseZone.findMany({
      where: { organizationId, warehouseId },
      orderBy: [{ code: "asc" }],
      include: {
        _count: { select: { bins: true } },
      },
    });
  }

  async createZone(organizationId: string, dto: CreateWarehouseZoneDto) {
    await this.requireWarehouse(organizationId, dto.warehouseId);
    try {
      return await this.prisma.warehouseZone.create({
        data: {
          organizationId,
          warehouseId: dto.warehouseId,
          code: dto.code.trim(),
          name: dto.name.trim(),
          zoneType: dto.zoneType?.trim() ?? null,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new BadRequestException("Zone code already exists for warehouse");
      }
      throw e;
    }
  }

  async updateZone(
    organizationId: string,
    zoneId: string,
    dto: UpdateWarehouseZoneDto,
  ) {
    const zone = await this.prisma.warehouseZone.findFirst({
      where: { id: zoneId, organizationId },
    });
    if (!zone) {
      throw new NotFoundException("Zone not found");
    }
    try {
      return await this.prisma.warehouseZone.update({
        where: { id: zoneId },
        data: {
          ...(dto.code != null ? { code: dto.code.trim() } : {}),
          ...(dto.name != null ? { name: dto.name.trim() } : {}),
          ...(dto.zoneType !== undefined
            ? { zoneType: dto.zoneType?.trim() ?? null }
            : {}),
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new BadRequestException("Zone code already exists for warehouse");
      }
      throw e;
    }
  }

  async deleteZone(organizationId: string, zoneId: string) {
    const zone = await this.prisma.warehouseZone.findFirst({
      where: { id: zoneId, organizationId },
      include: { _count: { select: { bins: true } } },
    });
    if (!zone) {
      throw new NotFoundException("Zone not found");
    }
    if (zone._count.bins > 0) {
      throw new BadRequestException("Zone has bins; reassign bins before delete");
    }
    await this.prisma.warehouseZone.delete({ where: { id: zoneId } });
    return { deleted: true };
  }

  async suggestPutAway(
    organizationId: string,
    warehouseId: string,
    productId: string,
  ) {
    await this.requireWarehouse(organizationId, warehouseId);
    const zones = await this.prisma.warehouseZone.findMany({
      where: {
        organizationId,
        warehouseId,
        OR: [{ zoneType: "STORAGE" }, { zoneType: null }],
      },
      orderBy: { code: "asc" },
      include: {
        bins: {
          where: { deletedAt: null },
          orderBy: { code: "asc" },
          include: {
            binBalances: true,
          },
        },
      },
    });

    for (const zone of zones) {
      if (zone.zoneType && zone.zoneType !== "STORAGE") continue;
      for (const bin of zone.bins) {
        if (bin.binBalances.length === 0) {
          return { bin, reason: "EMPTY" as const };
        }
        if (
          bin.binBalances.length === 1 &&
          bin.binBalances[0].productId === productId
        ) {
          return { bin, reason: "SAME_PRODUCT" as const };
        }
      }
    }
    return { bin: null, reason: "NONE" as const };
  }

  async listPickLists(organizationId: string, warehouseId?: string) {
    return this.prisma.pickList.findMany({
      where: {
        organizationId,
        ...(warehouseId ? { warehouseId } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        warehouse: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  async getPickList(organizationId: string, pickListId: string) {
    const pick = await this.prisma.pickList.findFirst({
      where: { id: pickListId, organizationId },
      include: {
        warehouse: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
        lines: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            bin: { select: { id: true, code: true, barcode: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!pick) {
      throw new NotFoundException("Pick list not found");
    }
    return pick;
  }

  async createPickList(organizationId: string, dto: CreatePickListDto) {
    await this.requireWarehouse(organizationId, dto.warehouseId);
    if (dto.invoiceId) {
      return this.createPickListFromInvoice(
        organizationId,
        dto.warehouseId,
        dto.invoiceId,
      );
    }
    return this.prisma.pickList.create({
      data: {
        organizationId,
        warehouseId: dto.warehouseId,
        status: PickListStatus.DRAFT,
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        lines: true,
      },
    });
  }

  async createPickListFromInvoice(
    organizationId: string,
    warehouseId: string,
    invoiceId: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: {
        items: {
          include: { product: { select: { id: true, isService: true } } },
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }

    const goodsByProduct = new Map<string, Decimal>();
    for (const item of invoice.items) {
      if (!item.productId || item.product?.isService) continue;
      const prev = goodsByProduct.get(item.productId) ?? new Decimal(0);
      goodsByProduct.set(item.productId, prev.add(item.quantity));
    }
    if (goodsByProduct.size === 0) {
      throw new BadRequestException("Invoice has no goods lines to pick");
    }

    const existing = await this.prisma.pickList.findFirst({
      where: {
        organizationId,
        invoiceId,
        status: { not: PickListStatus.CANCELLED },
      },
    });
    if (existing) {
      throw new BadRequestException("Active pick list already exists for invoice");
    }

    return this.prisma.$transaction(async (tx) => {
      const pick = await tx.pickList.create({
        data: {
          organizationId,
          warehouseId,
          invoiceId,
          status: PickListStatus.DRAFT,
        },
      });

      for (const [productId, need] of goodsByProduct) {
        let remaining = need;
        const balances = await tx.binBalance.findMany({
          where: {
            organizationId,
            warehouseId,
            productId,
            quantity: { gt: 0 },
          },
          orderBy: [{ createdAt: "asc" }],
        });

        for (const bal of balances) {
          if (remaining.lte(0)) break;
          const take = Decimal.min(remaining, bal.quantity);
          if (take.lte(0)) continue;
          await tx.pickListLine.create({
            data: {
              organizationId,
              pickListId: pick.id,
              productId,
              binId: bal.binId,
              quantityRequested: take,
            },
          });
          remaining = remaining.sub(take);
        }

        if (remaining.gt(0)) {
          await tx.pickListLine.create({
            data: {
              organizationId,
              pickListId: pick.id,
              productId,
              binId: null,
              quantityRequested: remaining,
            },
          });
        }
      }

      return this.getPickListInTx(tx, organizationId, pick.id);
    });
  }

  async confirmPickLine(
    organizationId: string,
    pickListId: string,
    dto: ConfirmPickLineDto,
  ) {
    const pick = await this.getPickList(organizationId, pickListId);
    if (pick.status === PickListStatus.DONE || pick.status === PickListStatus.CANCELLED) {
      throw new BadRequestException("Pick list is closed");
    }

    const line = pick.lines.find((l) => l.id === dto.lineId);
    if (!line) {
      throw new NotFoundException("Pick line not found");
    }

    let binId = line.binId;
    if (dto.binBarcode?.trim()) {
      const scanned = await this.scanByBarcode(
        organizationId,
        dto.binBarcode,
        pick.warehouseId,
      );
      if (line.binId && line.binId !== scanned.id) {
        throw new BadRequestException("Scanned bin does not match allocated bin");
      }
      binId = scanned.id;
    } else if (!binId) {
      throw new BadRequestException("binBarcode is required for unallocated line");
    }

    const remaining = new Decimal(line.quantityRequested).sub(
      line.quantityPicked,
    );
    const pickQty = dto.quantity != null ? new Decimal(dto.quantity) : remaining;
    if (pickQty.lte(0) || pickQty.gt(remaining)) {
      throw new BadRequestException("Invalid pick quantity");
    }

    await this.bins.issueFromBin(organizationId, {
      binId: binId!,
      productId: line.productId,
      quantity: Number(pickQty.toString()),
      note: `PICK_LIST:${pickListId}`,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.pickListLine.update({
        where: { id: line.id },
        data: {
          quantityPicked: new Decimal(line.quantityPicked).add(pickQty),
          ...(line.binId == null ? { binId } : {}),
        },
      });

      const lines = await tx.pickListLine.findMany({
        where: { pickListId },
      });
      const allDone = lines.every((l) =>
        new Decimal(l.quantityPicked).gte(l.quantityRequested),
      );
      const anyPicked = lines.some((l) =>
        new Decimal(l.quantityPicked).gt(0),
      );

      await tx.pickList.update({
        where: { id: pickListId },
        data: {
          status: allDone
            ? PickListStatus.DONE
            : anyPicked
              ? PickListStatus.IN_PROGRESS
              : PickListStatus.DRAFT,
        },
      });
    });

    return this.getPickList(organizationId, pickListId);
  }

  async cancelPickList(organizationId: string, pickListId: string) {
    const pick = await this.getPickList(organizationId, pickListId);
    if (pick.status === PickListStatus.DONE) {
      throw new BadRequestException("Completed pick list cannot be cancelled");
    }
    return this.prisma.pickList.update({
      where: { id: pickListId },
      data: { status: PickListStatus.CANCELLED },
    });
  }

  private async requireWarehouse(organizationId: string, warehouseId: string) {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId },
      select: { id: true },
    });
    if (!wh) {
      throw new NotFoundException("Warehouse not found");
    }
  }

  private async getPickListInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    pickListId: string,
  ) {
    const pick = await tx.pickList.findFirst({
      where: { id: pickListId, organizationId },
      include: {
        warehouse: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
        lines: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            bin: { select: { id: true, code: true, barcode: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!pick) {
      throw new NotFoundException("Pick list not found");
    }
    return pick;
  }
}
