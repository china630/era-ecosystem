import { BadRequestException, Injectable } from "@nestjs/common";
import { bakuDayBounds } from "@era/satellite-kit/time";
import { Prisma } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import {
  NON_FOOD_COST_CLASSES,
  buildOutletBudgetRows,
  type NonFoodCostClass,
} from "./outlet-budget-run.math";

const USAGE_OUT_REASONS = [
  "SALE",
  "SHIPMENT",
  "ADJUSTMENT",
  "MANUFACTURING",
] as const;

type OutletBudgetSettings = {
  planPeriodDays: number;
  /** Plan AZN keyed by outlet code (or `_` for org default) → class. */
  plans: Record<string, Partial<Record<NonFoodCostClass, number>>>;
};

function money(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function periodDayCount(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00.000Z`).getTime();
  const b = new Date(`${toYmd}T00:00:00.000Z`).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

function readBudgetSettings(settingsJson: unknown): OutletBudgetSettings {
  const root =
    settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
      ? (settingsJson as Record<string, unknown>)
      : {};
  const raw = root.outletBudget;
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const planPeriodDays = Math.max(
    1,
    Math.floor(Number(src.planPeriodDays) || 7),
  );
  const plans: OutletBudgetSettings["plans"] = {};
  const plansRaw =
    src.plans && typeof src.plans === "object" && !Array.isArray(src.plans)
      ? (src.plans as Record<string, unknown>)
      : {};
  for (const [code, row] of Object.entries(plansRaw)) {
    if (!code.trim() || !row || typeof row !== "object" || Array.isArray(row)) continue;
    const clsMap: Partial<Record<NonFoodCostClass, number>> = {};
    for (const cls of NON_FOOD_COST_CLASSES) {
      const v = (row as Record<string, unknown>)[cls];
      if (v != null && Number.isFinite(Number(v))) clsMap[cls] = money(Number(v));
    }
    plans[code.trim()] = clsMap;
  }
  return { planPeriodDays, plans };
}

@Injectable()
export class OutletBudgetRunService {
  constructor(private readonly prisma: PrismaService) {}

  async run(
    organizationId: string,
    query: {
      fromYmd: string;
      toYmd: string;
      satelliteOutletCode?: string;
      /** Inline plan override (does not persist). */
      planByClass?: Partial<Record<NonFoodCostClass, number>>;
      planPeriodDays?: number;
    },
  ) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(query.toYmd)) {
      throw new BadRequestException("from/to must be YYYY-MM-DD");
    }
    if (query.fromYmd > query.toYmd) {
      throw new BadRequestException("from must be on or before to");
    }

    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { settings: true },
    });
    if (!org) throw new BadRequestException("Organization not found");

    const stored = readBudgetSettings(org.settings);
    const outletKey = query.satelliteOutletCode?.trim() || "_";
    const storedPlan =
      stored.plans[outletKey] ??
      (outletKey !== "_" ? stored.plans._ : undefined) ??
      {};

    const planByClass: Partial<Record<NonFoodCostClass, number>> = {
      ...storedPlan,
      ...(query.planByClass ?? {}),
    };
    const planPeriodDays = Math.max(
      1,
      Math.floor(query.planPeriodDays ?? stored.planPeriodDays),
    );

    const from = bakuDayBounds(query.fromYmd);
    const to = bakuDayBounds(query.toYmd);

    const warehouses = await this.prisma.warehouse.findMany({
      where: {
        organizationId,
        deletedAt: null,
        costClass: { in: [...NON_FOOD_COST_CLASSES] },
        ...(query.satelliteOutletCode
          ? { satelliteOutletCode: query.satelliteOutletCode.trim() }
          : {}),
      },
      select: { id: true, name: true, costClass: true, satelliteOutletCode: true },
      orderBy: { name: "asc" },
    });

    const warehouseCountByClass: Partial<Record<NonFoodCostClass, number>> = {};
    const idsByClass = new Map<NonFoodCostClass, string[]>();
    for (const cls of NON_FOOD_COST_CLASSES) {
      warehouseCountByClass[cls] = 0;
      idsByClass.set(cls, []);
    }
    for (const w of warehouses) {
      const cls = w.costClass as NonFoodCostClass | null;
      if (!cls || !idsByClass.has(cls)) continue;
      idsByClass.get(cls)!.push(w.id);
      warehouseCountByClass[cls] = (warehouseCountByClass[cls] ?? 0) + 1;
    }

    const factByClass: Partial<Record<NonFoodCostClass, number>> = {};
    for (const cls of NON_FOOD_COST_CLASSES) {
      const ids = idsByClass.get(cls) ?? [];
      factByClass[cls] = await this.sumUsageAzn(
        organizationId,
        ids,
        from.start,
        to.end,
      );
    }

    const periodDays = periodDayCount(query.fromYmd, query.toYmd);
    const rows = buildOutletBudgetRows({
      planByClass,
      factByClass,
      warehouseCountByClass,
      planPeriodDays,
      periodDays,
    });

    const warnings: string[] = [];
    if (warehouses.length === 0) {
      warnings.push(
        query.satelliteOutletCode
          ? `No non-FOOD warehouses for outlet ${query.satelliteOutletCode.trim()} — set costClass CHEMICAL/CONSUMABLE/TABLEWARE/INVENTORY_GT`
          : "No non-FOOD warehouses tagged — set costClass on Inventory settings",
      );
    }
    for (const row of rows) {
      if (row.planAzn === 0 && row.factAzn > 0) {
        warnings.push(`${row.costClass}: fact without plan`);
      }
    }

    const weeklyPlanByClass: Record<NonFoodCostClass, number> = {
      CHEMICAL: money(Number(planByClass.CHEMICAL ?? 0)),
      CONSUMABLE: money(Number(planByClass.CONSUMABLE ?? 0)),
      TABLEWARE: money(Number(planByClass.TABLEWARE ?? 0)),
      INVENTORY_GT: money(Number(planByClass.INVENTORY_GT ?? 0)),
    };

    return {
      period: { from: query.fromYmd, to: query.toYmd, days: periodDays },
      satelliteOutletCode: query.satelliteOutletCode?.trim() || null,
      planPeriodDays,
      weeklyPlanByClass,
      warehouses,
      rows,
      planTotalAzn: money(rows.reduce((s, r) => s + r.planAzn, 0)),
      factTotalAzn: money(rows.reduce((s, r) => s + r.factAzn, 0)),
      varianceTotalAzn: money(rows.reduce((s, r) => s + r.varianceAzn, 0)),
      stocktakeHint:
        "TABLEWARE stocktake default cadence is EVERY_15_DAYS (F&B buffet cost settings).",
      warnings,
    };
  }

  async savePlan(
    organizationId: string,
    args: {
      satelliteOutletCode?: string | null;
      planByClass: Partial<Record<NonFoodCostClass, number>>;
      planPeriodDays?: number;
    },
  ) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true, settings: true },
    });
    if (!org) throw new BadRequestException("Organization not found");

    const current = readBudgetSettings(org.settings);
    const key = args.satelliteOutletCode?.trim() || "_";
    const nextPlans = { ...current.plans };
    const clsMap: Partial<Record<NonFoodCostClass, number>> = {
      ...(nextPlans[key] ?? {}),
    };
    for (const cls of NON_FOOD_COST_CLASSES) {
      if (args.planByClass[cls] !== undefined) {
        clsMap[cls] = money(Number(args.planByClass[cls]));
      }
    }
    nextPlans[key] = clsMap;

    const root =
      org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
        ? { ...(org.settings as Record<string, unknown>) }
        : {};
    root.outletBudget = {
      planPeriodDays: Math.max(
        1,
        Math.floor(args.planPeriodDays ?? current.planPeriodDays),
      ),
      plans: nextPlans,
    };

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: root as Prisma.InputJsonValue },
    });

    return {
      satelliteOutletCode: key === "_" ? null : key,
      planPeriodDays: (root.outletBudget as OutletBudgetSettings).planPeriodDays,
      planByClass: clsMap,
    };
  }

  private async sumUsageAzn(
    organizationId: string,
    warehouseIds: string[],
    from: Date,
    toExclusive: Date,
  ): Promise<number> {
    if (warehouseIds.length === 0) return 0;
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        warehouseId: { in: warehouseIds },
        type: "OUT",
        reason: { in: [...USAGE_OUT_REASONS] },
        documentDate: { gte: from, lt: toExclusive },
        product: { deletedAt: null },
      },
      select: { quantity: true, price: true },
    });
    let sum = 0;
    for (const m of movements) {
      sum += Number(m.quantity) * Number(m.price);
    }
    return money(sum);
  }
}
