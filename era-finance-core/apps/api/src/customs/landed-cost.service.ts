import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  StockMovementReason,
  StockMovementType,
} from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import type { LandedCostAllocationMethod } from "./dto/landed-cost.dto";

export type LandedCostItemResult = {
  itemId: string;
  sequenceNumber: number;
  productId: string;
  quantity: string;
  invoiceValueAzn: string;
  allocatedChargesAzn: string;
  unitLandedCost: string;
  batchId: string;
};

export type LandedCostAllocateResult = {
  declarationId: string;
  bgdNumber: string;
  method: LandedCostAllocationMethod;
  totalChargesAzn: string;
  items: LandedCostItemResult[];
  stockMovementsUpdated: number;
};

@Injectable()
export class LandedCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async allocate(
    organizationId: string,
    declarationId: string,
    method: LandedCostAllocationMethod = "STAT_VALUE",
  ): Promise<LandedCostAllocateResult> {
    const declaration = await this.prisma.customsDeclaration.findFirst({
      where: { id: declarationId, organizationId, deletedAt: null },
      include: {
        items: { orderBy: { sequenceNumber: "asc" } },
      },
    });
    if (!declaration) {
      throw new NotFoundException("Customs declaration not found");
    }
    if (declaration.items.length === 0) {
      throw new BadRequestException("Declaration has no line items");
    }

    const fxRate =
      declaration.currencyRate != null && declaration.currencyRate.gt(0)
        ? declaration.currencyRate
        : new Prisma.Decimal(1);

    let totalCharges = new Prisma.Decimal(declaration.feesAzn);
    for (const it of declaration.items) {
      totalCharges = totalCharges
        .add(it.calculatedDutyAzn)
        .add(it.calculatedExciseAzn);
    }

    const basisOf = (it: (typeof declaration.items)[number]): Prisma.Decimal => {
      if (method === "WEIGHT") {
        return it.weightNetKg.gt(0) ? it.weightNetKg : new Prisma.Decimal(0);
      }
      if (method === "QUANTITY") {
        return it.quantity.gt(0) ? it.quantity : new Prisma.Decimal(0);
      }
      return it.statisticalValueAzn.gt(0)
        ? it.statisticalValueAzn
        : new Prisma.Decimal(0);
    };

    const bases = declaration.items.map((it) => basisOf(it));
    const totalBasis = bases.reduce(
      (s, b) => s.add(b),
      new Prisma.Decimal(0),
    );

    const warehouseId = await this.inventory.resolveDefaultWarehouseId(organizationId);
    if (!warehouseId) {
      throw new BadRequestException(
        "Default warehouse is required for inventory batch landed-cost allocation",
      );
    }

    const purchaseId = declaration.linkedPurchaseTransactionId;

    return this.prisma.$transaction(async (tx) => {
      const results: LandedCostItemResult[] = [];
      let stockMovementsUpdated = 0;

      for (let idx = 0; idx < declaration.items.length; idx++) {
        const it = declaration.items[idx]!;
        if (!it.productId) {
          continue;
        }
        const qty = it.quantity;
        if (qty.lte(0)) {
          continue;
        }

        const basis = bases[idx] ?? new Prisma.Decimal(0);
        const share = totalBasis.gt(0)
          ? basis.div(totalBasis)
          : new Prisma.Decimal(1).div(declaration.items.length);
        const allocatedCharges = totalCharges.mul(share);

        const invoiceValueAzn =
          declaration.currency.trim().toUpperCase() === "AZN"
            ? it.invoiceValue
            : it.invoiceValue.mul(fxRate);

        const lineTotalAzn = invoiceValueAzn.add(allocatedCharges);
        const unitLandedCost = lineTotalAzn.div(qty);

        const batchCode = `${declaration.bgdNumber}-${it.sequenceNumber}`;

        const existingBatch = await tx.inventoryBatch.findFirst({
          where: {
            organizationId,
            customsItemId: it.id,
          },
        });

        const batch = existingBatch
          ? await tx.inventoryBatch.update({
              where: { id: existingBatch.id },
              data: {
                productId: it.productId,
                warehouseId,
                batchCode,
                quantity: qty,
                unitLandedCost,
                purchaseId,
              },
            })
          : await tx.inventoryBatch.create({
              data: {
                organizationId,
                productId: it.productId,
                warehouseId,
                batchCode,
                quantity: qty,
                unitLandedCost,
                customsItemId: it.id,
                purchaseId,
              },
            });

        stockMovementsUpdated += await this.applyUnitCostToStock(
          tx,
          organizationId,
          it.productId,
          warehouseId,
          qty,
          unitLandedCost,
          purchaseId,
        );

        results.push({
          itemId: it.id,
          sequenceNumber: it.sequenceNumber,
          productId: it.productId,
          quantity: qty.toString(),
          invoiceValueAzn: invoiceValueAzn.toFixed(4),
          allocatedChargesAzn: allocatedCharges.toFixed(4),
          unitLandedCost: unitLandedCost.toFixed(4),
          batchId: batch.id,
        });
      }

      if (results.length === 0) {
        throw new BadRequestException(
          "Link catalog products to declaration lines before landed-cost allocation",
        );
      }

      return {
        declarationId: declaration.id,
        bgdNumber: declaration.bgdNumber,
        method,
        totalChargesAzn: totalCharges.toFixed(4),
        items: results,
        stockMovementsUpdated,
      };
    });
  }

  /**
   * After BGD attach — apply batches / unit costs when allocation already exists or auto-allocate.
   */
  async applyOnAttach(
    organizationId: string,
    declarationId: string,
    method: LandedCostAllocationMethod = "STAT_VALUE",
  ): Promise<LandedCostAllocateResult | { skipped: true; reason: string }> {
    const declaration = await this.prisma.customsDeclaration.findFirst({
      where: { id: declarationId, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!declaration) {
      return { skipped: true, reason: "declaration_not_found" };
    }

    const linkedProducts = declaration.items.filter((it) => it.productId);
    if (linkedProducts.length === 0) {
      return { skipped: true, reason: "no_product_links" };
    }

    const existingBatch = await this.prisma.inventoryBatch.findFirst({
      where: {
        organizationId,
        customsItemId: { in: linkedProducts.map((it) => it.id) },
      },
    });
    if (existingBatch) {
      return this.allocate(organizationId, declarationId, method);
    }

    return this.allocate(organizationId, declarationId, method);
  }

  private async applyUnitCostToStock(
    tx: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
    warehouseId: string,
    receiptQty: Prisma.Decimal,
    unitLandedCost: Prisma.Decimal,
    purchaseTransactionId: string | null,
  ): Promise<number> {
    let updated = 0;

    const movementWhere: Prisma.StockMovementWhereInput = {
      organizationId,
      productId,
      warehouseId,
      type: StockMovementType.IN,
      reason: StockMovementReason.RECEIPT,
    };
    if (purchaseTransactionId) {
      movementWhere.note = { contains: `BASIS_TX:${purchaseTransactionId}` };
    }

    const movements = await tx.stockMovement.findMany({
      where: movementWhere,
      orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }],
      take: 3,
    });

    for (const m of movements) {
      await tx.stockMovement.update({
        where: { id: m.id },
        data: { price: unitLandedCost },
      });
      updated += 1;
    }

    const existing = await tx.stockItem.findUnique({
      where: {
        organizationId_warehouseId_productId: {
          organizationId,
          warehouseId,
          productId,
        },
      },
    });

    if (!existing) {
      return updated;
    }

    const q0 = existing.quantity;
    if (q0.lte(0)) {
      return updated;
    }

    if (movements.length > 0) {
      let costSum = new Prisma.Decimal(0);
      for (const m of movements) {
        costSum = costSum.add(m.quantity.mul(unitLandedCost));
      }
      const otherQty = q0.sub(
        movements.reduce(
          (s, m) => s.add(m.quantity),
          new Prisma.Decimal(0),
        ),
      );
      const c0 = existing.averageCost;
      const c1 = otherQty.lte(0)
        ? unitLandedCost
        : otherQty.mul(c0).add(costSum).div(q0);
      await tx.stockItem.update({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId,
            productId,
          },
        },
        data: { averageCost: c1 },
      });
    } else if (receiptQty.gt(0)) {
      const c0 = existing.averageCost;
      const c1 = q0.lte(receiptQty)
        ? unitLandedCost
        : q0.sub(receiptQty).mul(c0).add(receiptQty.mul(unitLandedCost)).div(q0);
      await tx.stockItem.update({
        where: {
          organizationId_warehouseId_productId: {
            organizationId,
            warehouseId,
            productId,
          },
        },
        data: { averageCost: c1 },
      });
    }

    return updated;
  }
}
