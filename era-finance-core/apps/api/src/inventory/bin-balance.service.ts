import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  Prisma,
  StockMovementReason,
  StockMovementType,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";
import { assertWarehouseNotUnderReconciliation } from "./inventory-reconciliation-lock";
import type {
  WmsAdjustBinDto,
  WmsIssueFromBinDto,
  WmsReceiveToBinDto,
  WmsTransferBinDto,
} from "./dto/wms.dto";

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

@Injectable()
export class BinBalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async getBinBalance(organizationId: string, binId: string) {
    const bin = await this.prisma.warehouseBin.findFirst({
      where: { id: binId, organizationId, deletedAt: null },
      include: {
        warehouse: { select: { id: true, name: true } },
        zone: { select: { id: true, code: true, name: true, zoneType: true } },
        binBalances: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, isService: true },
            },
          },
          orderBy: { product: { name: "asc" } },
        },
      },
    });
    if (!bin) {
      throw new NotFoundException("Bin not found");
    }
    return bin;
  }

  async receiveToBin(organizationId: string, dto: WmsReceiveToBinDto) {
    const qty = new Decimal(dto.quantity);
    const unit = new Decimal(dto.unitCost ?? 0);
    const documentDate = dto.date ? new Date(dto.date) : new Date();
    if (Number.isNaN(documentDate.getTime())) {
      throw new BadRequestException("Invalid document date");
    }

    return this.prisma.$transaction(async (tx) => {
      const bin = await this.requireBin(tx, organizationId, dto.binId);
      await this.requireGoodsProduct(tx, organizationId, dto.productId);
      await assertWarehouseNotUnderReconciliation(
        tx,
        organizationId,
        bin.warehouseId,
      );

      await this.upsertBinBalance(tx, {
        organizationId,
        warehouseId: bin.warehouseId,
        binId: dto.binId,
        productId: dto.productId,
        qtyDelta: qty,
        unitCost: unit,
      });

      await this.applyWarehouseStockDelta(tx, organizationId, {
        warehouseId: bin.warehouseId,
        productId: dto.productId,
        qtyDelta: qty,
        unitCost: unit,
      });

      await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId: bin.warehouseId,
          productId: dto.productId,
          binId: dto.binId,
          type: StockMovementType.IN,
          reason: StockMovementReason.RECEIPT,
          quantity: qty,
          price: unit,
          note: dto.note ? `WMS_RECEIVE|${dto.note}` : "WMS_RECEIVE",
          documentDate,
        },
      });

      return this.getBinBalanceInTx(tx, organizationId, dto.binId);
    });
  }

  async issueFromBin(organizationId: string, dto: WmsIssueFromBinDto) {
    const qty = new Decimal(dto.quantity);
    const documentDate = dto.date ? new Date(dto.date) : new Date();
    if (Number.isNaN(documentDate.getTime())) {
      throw new BadRequestException("Invalid document date");
    }

    return this.prisma.$transaction(async (tx) => {
      const bin = await this.requireBin(tx, organizationId, dto.binId);
      await this.requireGoodsProduct(tx, organizationId, dto.productId);
      await assertWarehouseNotUnderReconciliation(
        tx,
        organizationId,
        bin.warehouseId,
      );

      const balance = await tx.binBalance.findUnique({
        where: {
          binId_productId: { binId: dto.binId, productId: dto.productId },
        },
      });
      const avail = balance?.quantity ?? new Decimal(0);
      if (avail.lt(qty)) {
        throw new BadRequestException("Insufficient bin quantity");
      }

      const stockItem = await tx.stockItem.findUnique({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: bin.warehouseId,
            productId: dto.productId,
          },
        },
      });
      const avg = stockItem?.averageCost ?? new Decimal(0);
      const unitCost = await this.stock.computeIssueUnitCost(
        tx,
        organizationId,
        bin.warehouseId,
        dto.productId,
        qty,
        avg,
        avg,
      );

      await this.upsertBinBalance(tx, {
        organizationId,
        warehouseId: bin.warehouseId,
        binId: dto.binId,
        productId: dto.productId,
        qtyDelta: qty.neg(),
        unitCost: balance?.averageCost ?? avg,
      });

      await this.applyWarehouseStockDelta(tx, organizationId, {
        warehouseId: bin.warehouseId,
        productId: dto.productId,
        qtyDelta: qty.neg(),
        unitCost,
      });

      await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId: bin.warehouseId,
          productId: dto.productId,
          binId: dto.binId,
          type: StockMovementType.OUT,
          reason: StockMovementReason.SHIPMENT,
          quantity: qty,
          price: unitCost,
          note: dto.note ? `WMS_ISSUE|${dto.note}` : "WMS_ISSUE",
          documentDate,
        },
      });

      return this.getBinBalanceInTx(tx, organizationId, dto.binId);
    });
  }

  async transferBin(organizationId: string, dto: WmsTransferBinDto) {
    if (dto.sourceBinId === dto.targetBinId) {
      throw new BadRequestException("Source and target bins must differ");
    }
    const qty = new Decimal(dto.quantity);
    const documentDate = dto.date ? new Date(dto.date) : new Date();
    if (Number.isNaN(documentDate.getTime())) {
      throw new BadRequestException("Invalid document date");
    }

    return this.prisma.$transaction(async (tx) => {
      const source = await this.requireBin(tx, organizationId, dto.sourceBinId);
      const target = await this.requireBin(tx, organizationId, dto.targetBinId);
      if (source.warehouseId !== target.warehouseId) {
        throw new BadRequestException(
          "Cross-warehouse bin transfer is not supported in mobile WMS",
        );
      }
      await this.requireGoodsProduct(tx, organizationId, dto.productId);
      await assertWarehouseNotUnderReconciliation(
        tx,
        organizationId,
        source.warehouseId,
      );

      const balance = await tx.binBalance.findUnique({
        where: {
          binId_productId: {
            binId: dto.sourceBinId,
            productId: dto.productId,
          },
        },
      });
      const avail = balance?.quantity ?? new Decimal(0);
      if (avail.lt(qty)) {
        throw new BadRequestException("Insufficient source bin quantity");
      }
      const unitCost = balance?.averageCost ?? new Decimal(0);

      await this.upsertBinBalance(tx, {
        organizationId,
        warehouseId: source.warehouseId,
        binId: dto.sourceBinId,
        productId: dto.productId,
        qtyDelta: qty.neg(),
        unitCost,
      });
      await this.upsertBinBalance(tx, {
        organizationId,
        warehouseId: target.warehouseId,
        binId: dto.targetBinId,
        productId: dto.productId,
        qtyDelta: qty,
        unitCost,
      });

      const batch = randomUUID();
      const note = dto.note ? `WMS_TRANSFER|${dto.note}` : "WMS_TRANSFER";
      await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId: source.warehouseId,
          productId: dto.productId,
          binId: dto.sourceBinId,
          type: StockMovementType.OUT,
          reason: StockMovementReason.TRANSFER,
          quantity: qty,
          price: unitCost,
          transferBatchId: batch,
          note,
          documentDate,
        },
      });
      await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId: target.warehouseId,
          productId: dto.productId,
          binId: dto.targetBinId,
          type: StockMovementType.IN,
          reason: StockMovementReason.TRANSFER,
          quantity: qty,
          price: unitCost,
          transferBatchId: batch,
          note,
          documentDate,
        },
      });

      return {
        source: await this.getBinBalanceInTx(tx, organizationId, dto.sourceBinId),
        target: await this.getBinBalanceInTx(tx, organizationId, dto.targetBinId),
      };
    });
  }

  async adjustBin(organizationId: string, dto: WmsAdjustBinDto) {
    const delta = new Decimal(dto.quantityDelta);
    if (delta.eq(0)) {
      throw new BadRequestException("quantityDelta must be non-zero");
    }
    const documentDate = dto.date ? new Date(dto.date) : new Date();
    if (Number.isNaN(documentDate.getTime())) {
      throw new BadRequestException("Invalid document date");
    }

    return this.prisma.$transaction(async (tx) => {
      const bin = await this.requireBin(tx, organizationId, dto.binId);
      await this.requireGoodsProduct(tx, organizationId, dto.productId);
      await assertWarehouseNotUnderReconciliation(
        tx,
        organizationId,
        bin.warehouseId,
      );

      const balance = await tx.binBalance.findUnique({
        where: {
          binId_productId: { binId: dto.binId, productId: dto.productId },
        },
      });
      const avail = balance?.quantity ?? new Decimal(0);
      if (delta.lt(0) && avail.lt(delta.abs())) {
        throw new BadRequestException("Adjustment would make bin quantity negative");
      }

      const stockItem = await tx.stockItem.findUnique({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId: bin.warehouseId,
            productId: dto.productId,
          },
        },
      });
      const avg = balance?.averageCost ?? stockItem?.averageCost ?? new Decimal(0);

      await this.upsertBinBalance(tx, {
        organizationId,
        warehouseId: bin.warehouseId,
        binId: dto.binId,
        productId: dto.productId,
        qtyDelta: delta,
        unitCost: avg,
      });

      await this.applyWarehouseStockDelta(tx, organizationId, {
        warehouseId: bin.warehouseId,
        productId: dto.productId,
        qtyDelta: delta,
        unitCost: avg,
      });

      const movementType =
        delta.gt(0) ? StockMovementType.IN : StockMovementType.OUT;
      await tx.stockMovement.create({
        data: {
          organizationId,
          warehouseId: bin.warehouseId,
          productId: dto.productId,
          binId: dto.binId,
          type: movementType,
          reason: StockMovementReason.ADJUSTMENT,
          quantity: delta.abs(),
          price: avg,
          note: dto.note ? `WMS_ADJUST|${dto.note}` : "WMS_ADJUST",
          documentDate,
        },
      });

      return this.getBinBalanceInTx(tx, organizationId, dto.binId);
    });
  }

  private async requireBin(
    tx: Prisma.TransactionClient,
    organizationId: string,
    binId: string,
  ) {
    const bin = await tx.warehouseBin.findFirst({
      where: { id: binId, organizationId, deletedAt: null },
      select: { id: true, warehouseId: true },
    });
    if (!bin) {
      throw new NotFoundException("Bin not found");
    }
    return bin;
  }

  private async requireGoodsProduct(
    tx: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
  ) {
    const product = await tx.product.findFirst({
      where: { id: productId, organizationId },
      select: { isService: true },
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    if (product.isService) {
      throw new BadRequestException("Service products cannot be stored in bins");
    }
  }

  private async upsertBinBalance(
    tx: Prisma.TransactionClient,
    args: {
      organizationId: string;
      warehouseId: string;
      binId: string;
      productId: string;
      qtyDelta: Decimal;
      unitCost: Decimal;
    },
  ) {
    const existing = await tx.binBalance.findUnique({
      where: {
        binId_productId: {
          binId: args.binId,
          productId: args.productId,
        },
      },
    });
    const q0 = existing?.quantity ?? new Decimal(0);
    const c0 = existing?.averageCost ?? new Decimal(0);
    const q1 = q0.add(args.qtyDelta);
    if (q1.lt(0)) {
      throw new BadRequestException("Bin quantity cannot be negative");
    }
    const c1 =
      args.qtyDelta.gt(0) && q1.gt(0)
        ? q0.lte(0)
          ? args.unitCost
          : q0.mul(c0).add(args.qtyDelta.mul(args.unitCost)).div(q1)
        : q1.lte(0)
          ? new Decimal(0)
          : c0;

    if (existing) {
      if (q1.eq(0)) {
        await tx.binBalance.delete({ where: { id: existing.id } });
        return;
      }
      await tx.binBalance.update({
        where: { id: existing.id },
        data: { quantity: q1, averageCost: c1 },
      });
      return;
    }

    if (q1.lte(0)) {
      return;
    }
    await tx.binBalance.create({
      data: {
        organizationId: args.organizationId,
        warehouseId: args.warehouseId,
        binId: args.binId,
        productId: args.productId,
        quantity: q1,
        averageCost: c1,
      },
    });
  }

  private async applyWarehouseStockDelta(
    tx: Prisma.TransactionClient,
    organizationId: string,
    args: {
      warehouseId: string;
      productId: string;
      qtyDelta: Decimal;
      unitCost: Decimal;
    },
  ) {
    const existing = await tx.stockItem.findUnique({
      where: {
        organizationId_warehouseId_productId: {
          organizationId,
          warehouseId: args.warehouseId,
          productId: args.productId,
        },
      },
    });
    const q0 = existing?.quantity ?? new Decimal(0);
    const c0 = existing?.averageCost ?? new Decimal(0);
    const q1 = q0.add(args.qtyDelta);
    if (q1.lt(0)) {
      throw new BadRequestException("Warehouse stock cannot be negative");
    }
    const c1 =
      args.qtyDelta.gt(0) && q1.gt(0)
        ? q0.lte(0)
          ? args.unitCost
          : q0.mul(c0).add(args.qtyDelta.mul(args.unitCost)).div(q1)
        : q1.lte(0)
          ? new Decimal(0)
          : c0;

    await tx.stockItem.upsert({
      where: {
        organizationId_warehouseId_productId: {
          organizationId,
          warehouseId: args.warehouseId,
          productId: args.productId,
        },
      },
      create: {
        organizationId,
        warehouseId: args.warehouseId,
        productId: args.productId,
        quantity: q1,
        averageCost: c1,
      },
      update: {
        quantity: q1,
        averageCost: c1,
      },
    });
  }

  private async getBinBalanceInTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    binId: string,
  ) {
    const bin = await tx.warehouseBin.findFirst({
      where: { id: binId, organizationId, deletedAt: null },
      include: {
        warehouse: { select: { id: true, name: true } },
        zone: { select: { id: true, code: true, name: true, zoneType: true } },
        binBalances: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, isService: true },
            },
          },
          orderBy: { product: { name: "asc" } },
        },
      },
    });
    if (!bin) {
      throw new NotFoundException("Bin not found");
    }
    return bin;
  }
}
