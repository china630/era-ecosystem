import { BadRequestException, Injectable } from "@nestjs/common";
import { bakuDayBounds } from "@era/satellite-kit/time";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildHybridFoodCostRun,
  type BuffetCostReliability,
  type SkuUsageRowInput,
} from "./buffet-food-cost-run.math";

export const WAREHOUSE_COST_CLASSES = [
  "FOOD",
  "CHEMICAL",
  "CONSUMABLE",
  "TABLEWARE",
  "INVENTORY_GT",
] as const;

/** OUT reasons that count as FOOD consumption (exclude warehouse TRANSFER). */
const USAGE_OUT_REASONS = [
  "SALE",
  "SHIPMENT",
  "ADJUSTMENT",
  "MANUFACTURING",
] as const;

export type BuffetFoodCostRunQuery = {
  fromYmd: string;
  toYmd: string;
  /** Filter FOOD warehouses by F&B outlet code (FIN-INV-SCOPE-01). */
  satelliteOutletCode?: string;
  /** Optional explicit warehouse ids (must be FOOD class). */
  warehouseIds?: string[];
  posSaleAzn?: number;
  posCompAzn?: number;
  staffNetAzn?: number;
  theoreticalAzn?: number;
  warningVarianceLowPct?: number;
  warningVarianceHighPct?: number;
  /** Per-SKU theoretical (TTK/norm) AZN for the period. */
  theoreticalBySku?: Record<string, number>;
};

@Injectable()
export class BuffetFoodCostRunService {
  constructor(private readonly prisma: PrismaService) {}

  async run(organizationId: string, query: BuffetFoodCostRunQuery) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(query.toYmd)) {
      throw new BadRequestException("from/to must be YYYY-MM-DD");
    }
    if (query.fromYmd > query.toYmd) {
      throw new BadRequestException("from must be on or before to");
    }

    const from = bakuDayBounds(query.fromYmd);
    const to = bakuDayBounds(query.toYmd);

    const warehouses = await this.prisma.warehouse.findMany({
      where: {
        organizationId,
        deletedAt: null,
        costClass: "FOOD",
        ...(query.satelliteOutletCode
          ? { satelliteOutletCode: query.satelliteOutletCode.trim() }
          : {}),
        ...(query.warehouseIds?.length
          ? { id: { in: query.warehouseIds } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        costClass: true,
        satelliteOutletCode: true,
      },
      orderBy: { name: "asc" },
    });

    const warehouseIds = warehouses.map((w) => w.id);
    const skuUsage = await this.sumFoodUsageBySku(
      organizationId,
      warehouseIds,
      from.start,
      to.end,
    );

    const foodUsageAzn = money(skuUsage.reduce((s, r) => s + r.usageAzn, 0));

    const reliability = await this.resolveReliability(
      organizationId,
      warehouseIds,
      query.fromYmd,
      query.toYmd,
    );

    const theoMap = query.theoreticalBySku ?? {};
    const skuRows: SkuUsageRowInput[] = skuUsage.map((r) => ({
      sku: r.sku,
      name: r.name,
      usageAzn: r.usageAzn,
      theoreticalAzn:
        theoMap[r.sku] != null && Number.isFinite(theoMap[r.sku])
          ? Number(theoMap[r.sku])
          : null,
    }));

    const theoreticalFromSkus = money(
      skuRows.reduce((s, r) => s + (r.theoreticalAzn ?? 0), 0),
    );
    const theoreticalAzn =
      query.theoreticalAzn != null && Number.isFinite(query.theoreticalAzn)
        ? money(Number(query.theoreticalAzn))
        : theoreticalFromSkus;

    const report = buildHybridFoodCostRun({
      foodUsageAzn,
      posSaleAzn: query.posSaleAzn ?? 0,
      posCompAzn: query.posCompAzn ?? 0,
      staffNetAzn: query.staffNetAzn ?? 0,
      theoreticalAzn,
      warningVarianceLowPct: query.warningVarianceLowPct ?? 70,
      warningVarianceHighPct: query.warningVarianceHighPct ?? 110,
      reliability,
      skuRows,
    });

    const scopeWarnings: string[] = [];
    const outletCode = query.satelliteOutletCode?.trim() || "";
    if (warehouses.length === 0) {
      scopeWarnings.push(
        outletCode
          ? `No FOOD warehouses for outlet code ${outletCode} — set costClass=FOOD + satelliteOutletCode on Inventory settings`
          : "No FOOD warehouses in org — set costClass=FOOD on a warehouse (Inventory settings)",
      );
      if (outletCode) {
        const otherFood = await this.prisma.warehouse.findMany({
          where: {
            organizationId,
            deletedAt: null,
            costClass: "FOOD",
            satelliteOutletCode: { not: null },
          },
          select: { satelliteOutletCode: true },
        });
        const otherCodes = [
          ...new Set(
            otherFood
              .map((w) => w.satelliteOutletCode?.trim())
              .filter((c): c is string => Boolean(c) && c !== outletCode),
          ),
        ];
        if (otherCodes.length > 0) {
          scopeWarnings.push(
            `OUTLET_CODE_MISMATCH: query ${outletCode} vs FOOD WH codes ${otherCodes.join(",")}`,
          );
        }
      }
    }

    return {
      period: { from: query.fromYmd, to: query.toYmd },
      satelliteOutletCode: query.satelliteOutletCode?.trim() || null,
      warehouses,
      warehouseCount: warehouses.length,
      cogsPostingNote:
        "Nafta department à-la-carte still posts via hotel day document; this report is FOOD usage attribution only.",
      ...report,
      warnings: [...scopeWarnings, ...report.warnings],
    };
  }

  private async sumFoodUsageBySku(
    organizationId: string,
    warehouseIds: string[],
    from: Date,
    toExclusive: Date,
  ): Promise<Array<{ sku: string; name: string; usageAzn: number }>> {
    if (warehouseIds.length === 0) return [];

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        warehouseId: { in: warehouseIds },
        type: "OUT",
        reason: { in: [...USAGE_OUT_REASONS] },
        documentDate: { gte: from, lt: toExclusive },
        product: { deletedAt: null },
      },
      select: {
        quantity: true,
        price: true,
        product: { select: { sku: true, name: true } },
      },
    });

    const bySku = new Map<string, { sku: string; name: string; usageAzn: number }>();
    for (const m of movements) {
      const sku = m.product.sku;
      const add = Number(m.quantity) * Number(m.price);
      const prev = bySku.get(sku);
      if (prev) {
        prev.usageAzn = money(prev.usageAzn + add);
      } else {
        bySku.set(sku, {
          sku,
          name: m.product.name,
          usageAzn: money(add),
        });
      }
    }

    return [...bySku.values()]
      .filter((r) => r.usageAzn > 0)
      .sort((a, b) => b.usageAzn - a.usageAzn);
  }

  private async resolveReliability(
    organizationId: string,
    warehouseIds: string[],
    fromYmd: string,
    toYmd: string,
  ): Promise<BuffetCostReliability> {
    if (warehouseIds.length === 0) return "ISSUES_ONLY";
    const fromDate = new Date(`${fromYmd}T00:00:00.000Z`);
    const toDate = new Date(`${toYmd}T00:00:00.000Z`);
    const completed = await this.prisma.inventoryAudit.count({
      where: {
        organizationId,
        warehouseId: { in: warehouseIds },
        status: "COMPLETED",
        deletedAt: null,
        date: { gte: fromDate, lte: toDate },
      },
    });
    return completed > 0 ? "COMPLETE" : "ISSUES_ONLY";
  }
}

function money(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}
