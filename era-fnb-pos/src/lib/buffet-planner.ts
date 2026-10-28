import { Prisma } from "@prisma/client";
import { bakuCivilUtcDate, todayBakuYmd } from "@era/satellite-kit/time";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  BUFFET_MEALS,
  BUFFET_STATUSES,
  effectiveBuffetPortions,
  planListAggregates,
  type BuffetMealCode,
} from "@/lib/buffet-planner-math";

export {
  BUFFET_MEALS,
  BUFFET_STATUSES,
  effectiveBuffetPortions,
  planListAggregates,
  type BuffetMealCode,
} from "@/lib/buffet-planner-math";

const planInclude = {
  outlet: { select: { id: true, code: true, name: true } },
  lines: {
    include: {
      menuItem: {
        select: {
          id: true,
          plu: true,
          name: true,
          recipeSku: true,
          financeSku: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" as const }, { station: "asc" as const }],
  },
};

export function serializePlan(
  plan: Prisma.BuffetPlanGetPayload<{ include: typeof planInclude }>,
) {
  const lines = plan.lines.map((line) => ({
    id: line.id,
    menuItemId: line.menuItemId,
    station: line.station,
    plannedPortions: line.plannedPortions,
    wastePct: Number(line.wastePct),
    sortOrder: line.sortOrder,
    plu: line.menuItem.plu,
    name: line.menuItem.name,
    recipeSku: line.menuItem.recipeSku,
    financeSku: line.menuItem.financeSku,
    categoryName: line.menuItem.category.name,
  }));
  const agg = planListAggregates(lines);
  return {
    id: plan.id,
    outletId: plan.outletId,
    outletCode: plan.outlet.code,
    outletName: plan.outlet.name,
    serviceDate: plan.serviceDate.toISOString().slice(0, 10),
    meal: plan.meal,
    status: plan.status,
    coversAdult: plan.coversAdult,
    coversChild: plan.coversChild,
    coversTotal: plan.coversAdult + plan.coversChild,
    coversSource: plan.coversSource,
    notes: plan.notes,
    lineCount: lines.length,
    portionsSum: agg.portionsSum,
    stations: agg.stations,
    missingBomCount: agg.missingBomCount,
    lines,
  };
}

export async function listBuffetPlans(args: {
  outletId?: string;
  fromYmd?: string;
  toYmd?: string;
  status?: (typeof BUFFET_STATUSES)[number];
}) {
  const organizationId = requestOrganizationId();
  const where: Prisma.BuffetPlanWhereInput = { organizationId };
  if (args.outletId) where.outletId = args.outletId;
  if (args.status) where.status = args.status;
  if (args.fromYmd || args.toYmd) {
    where.serviceDate = {};
    if (args.fromYmd) where.serviceDate.gte = bakuCivilUtcDate(args.fromYmd);
    if (args.toYmd) where.serviceDate.lte = bakuCivilUtcDate(args.toYmd);
  }
  const rows = await prisma.buffetPlan.findMany({
    where,
    include: planInclude,
    orderBy: [{ serviceDate: "asc" }, { meal: "asc" }],
  });
  return rows.map(serializePlan);
}

export async function getBuffetPlan(id: string) {
  const organizationId = requestOrganizationId();
  const plan = await prisma.buffetPlan.findFirst({
    where: { id, organizationId },
    include: planInclude,
  });
  return plan ? serializePlan(plan) : null;
}

export async function upsertBuffetPlan(input: {
  outletId: string;
  serviceDateYmd: string;
  meal: BuffetMealCode;
  coversAdult: number;
  coversChild: number;
  coversSource?: "MANUAL" | "HOTEL" | "MIXED";
  notes?: string | null;
}) {
  const organizationId = requestOrganizationId();
  const outlet = await prisma.outlet.findFirst({
    where: { id: input.outletId, organizationId, active: true },
  });
  if (!outlet) throw Object.assign(new Error("OUTLET_NOT_FOUND"), { code: "OUTLET_NOT_FOUND", status: 404 });
  const serviceDate = bakuCivilUtcDate(input.serviceDateYmd);
  const plan = await prisma.buffetPlan.upsert({
    where: {
      outletId_serviceDate_meal: {
        outletId: outlet.id,
        serviceDate,
        meal: input.meal,
      },
    },
    create: {
      organizationId,
      outletId: outlet.id,
      serviceDate,
      meal: input.meal,
      coversAdult: input.coversAdult,
      coversChild: input.coversChild,
      coversSource: input.coversSource ?? "MANUAL",
      notes: input.notes ?? null,
    },
    update: {
      coversAdult: input.coversAdult,
      coversChild: input.coversChild,
      coversSource: input.coversSource ?? "MANUAL",
      notes: input.notes ?? null,
    },
    include: planInclude,
  });
  return serializePlan(plan);
}

export async function setBuffetPlanStatus(id: string, status: (typeof BUFFET_STATUSES)[number]) {
  const organizationId = requestOrganizationId();
  const existing = await prisma.buffetPlan.findFirst({ where: { id, organizationId } });
  if (!existing) return null;
  if (existing.status === "CLOSED" && status !== "CLOSED") {
    throw Object.assign(new Error("PLAN_CLOSED"), { code: "PLAN_CLOSED", status: 409 });
  }
  const plan = await prisma.buffetPlan.update({
    where: { id },
    data: { status },
    include: planInclude,
  });
  return serializePlan(plan);
}

export async function updateBuffetPlan(
  id: string,
  input: {
    serviceDateYmd?: string;
    meal?: BuffetMealCode;
    coversAdult?: number;
    coversChild?: number;
    coversSource?: "MANUAL" | "HOTEL" | "MIXED";
    notes?: string | null;
  },
) {
  const organizationId = requestOrganizationId();
  const existing = await prisma.buffetPlan.findFirst({ where: { id, organizationId } });
  if (!existing) return null;
  const serviceDateYmd = input.serviceDateYmd ?? existing.serviceDate.toISOString().slice(0, 10);
  const meal = input.meal ?? (existing.meal as BuffetMealCode);
  const serviceDate = bakuCivilUtcDate(serviceDateYmd);
  const slotChanged =
    serviceDate.getTime() !== existing.serviceDate.getTime() || meal !== existing.meal;
  if (slotChanged) {
    const clash = await prisma.buffetPlan.findFirst({
      where: {
        outletId: existing.outletId,
        serviceDate,
        meal,
        NOT: { id },
      },
      select: { id: true },
    });
    if (clash) {
      throw Object.assign(new Error("PLAN_SLOT_TAKEN"), { code: "PLAN_SLOT_TAKEN", status: 409 });
    }
  }
  const plan = await prisma.buffetPlan.update({
    where: { id },
    data: {
      serviceDate,
      meal,
      coversAdult: input.coversAdult ?? existing.coversAdult,
      coversChild: input.coversChild ?? existing.coversChild,
      coversSource: input.coversSource ?? existing.coversSource,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    },
    include: planInclude,
  });
  return serializePlan(plan);
}

export async function copyBuffetPlan(id: string, serviceDateYmd?: string) {
  const organizationId = requestOrganizationId();
  const source = await prisma.buffetPlan.findFirst({
    where: { id, organizationId },
    include: { lines: true },
  });
  if (!source) {
    throw Object.assign(new Error("PLAN_NOT_FOUND"), { code: "PLAN_NOT_FOUND", status: 404 });
  }
  const targetYmd = serviceDateYmd?.trim() || todayBakuYmd();
  const serviceDate = bakuCivilUtcDate(targetYmd);
  const clash = await prisma.buffetPlan.findFirst({
    where: {
      outletId: source.outletId,
      serviceDate,
      meal: source.meal,
    },
    select: { id: true },
  });
  if (clash) {
    throw Object.assign(new Error("PLAN_SLOT_TAKEN"), { code: "PLAN_SLOT_TAKEN", status: 409 });
  }
  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.buffetPlan.create({
      data: {
        organizationId,
        outletId: source.outletId,
        serviceDate,
        meal: source.meal,
        status: "DRAFT",
        coversAdult: source.coversAdult,
        coversChild: source.coversChild,
        coversSource: source.coversSource,
        notes: source.notes,
      },
    });
    if (source.lines.length > 0) {
      await tx.buffetPlanLine.createMany({
        data: source.lines.map((line) => ({
          organizationId,
          planId: plan.id,
          menuItemId: line.menuItemId,
          station: line.station,
          plannedPortions: line.plannedPortions,
          wastePct: line.wastePct,
          sortOrder: line.sortOrder,
        })),
      });
    }
    return plan.id;
  });
  return getBuffetPlan(created);
}

/** Copy dish lines from the latest same-outlet/meal plan onto a DRAFT plan. */
export async function copyLinesFromLastSameMeal(planId: string) {
  const organizationId = requestOrganizationId();
  const plan = await prisma.buffetPlan.findFirst({
    where: { id: planId, organizationId },
  });
  if (!plan) {
    throw Object.assign(new Error("PLAN_NOT_FOUND"), { code: "PLAN_NOT_FOUND", status: 404 });
  }
  if (plan.status !== "DRAFT") {
    throw Object.assign(new Error("PLAN_NOT_DRAFT"), { code: "PLAN_NOT_DRAFT", status: 409 });
  }
  const source = await prisma.buffetPlan.findFirst({
    where: {
      organizationId,
      outletId: plan.outletId,
      meal: plan.meal,
      id: { not: plan.id },
      lines: { some: {} },
    },
    include: { lines: true },
    orderBy: [{ serviceDate: "desc" }, { updatedAt: "desc" }],
  });
  if (!source || source.lines.length === 0) {
    throw Object.assign(new Error("NO_SOURCE_PLAN"), { code: "NO_SOURCE_PLAN", status: 404 });
  }
  await prisma.$transaction(async (tx) => {
    await tx.buffetPlanLine.deleteMany({ where: { planId: plan.id } });
    await tx.buffetPlanLine.createMany({
      data: source.lines.map((line) => ({
        organizationId,
        planId: plan.id,
        menuItemId: line.menuItemId,
        station: line.station,
        plannedPortions: line.plannedPortions,
        wastePct: line.wastePct,
        sortOrder: line.sortOrder,
      })),
    });
  });
  return getBuffetPlan(plan.id);
}

export async function upsertBuffetLine(input: {
  planId: string;
  menuItemId: string;
  station: string;
  plannedPortions: number;
  wastePct: number;
  sortOrder?: number;
}) {
  const organizationId = requestOrganizationId();
  const plan = await prisma.buffetPlan.findFirst({ where: { id: input.planId, organizationId } });
  if (!plan) throw Object.assign(new Error("PLAN_NOT_FOUND"), { code: "PLAN_NOT_FOUND", status: 404 });
  if (plan.status !== "DRAFT") {
    throw Object.assign(new Error("PLAN_NOT_DRAFT"), { code: "PLAN_NOT_DRAFT", status: 409 });
  }
  const menuItem = await prisma.menuItem.findFirst({
    where: {
      id: input.menuItemId,
      organizationId,
      category: { outletId: plan.outletId },
      active: true,
    },
  });
  if (!menuItem) {
    throw Object.assign(new Error("MENU_ITEM_NOT_FOUND"), { code: "MENU_ITEM_NOT_FOUND", status: 404 });
  }
  const station = input.station.trim() || "MAIN";
  await prisma.buffetPlanLine.upsert({
    where: {
      planId_menuItemId_station: {
        planId: plan.id,
        menuItemId: menuItem.id,
        station,
      },
    },
    create: {
      organizationId,
      planId: plan.id,
      menuItemId: menuItem.id,
      station,
      plannedPortions: input.plannedPortions,
      wastePct: new Prisma.Decimal(input.wastePct),
      sortOrder: input.sortOrder ?? 0,
    },
    update: {
      plannedPortions: input.plannedPortions,
      wastePct: new Prisma.Decimal(input.wastePct),
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return getBuffetPlan(plan.id);
}

export async function deleteBuffetLine(lineId: string) {
  const organizationId = requestOrganizationId();
  const line = await prisma.buffetPlanLine.findFirst({
    where: { id: lineId, organizationId },
    include: { plan: true },
  });
  if (!line) return null;
  if (line.plan.status !== "DRAFT") {
    throw Object.assign(new Error("PLAN_NOT_DRAFT"), { code: "PLAN_NOT_DRAFT", status: 409 });
  }
  await prisma.buffetPlanLine.delete({ where: { id: lineId } });
  return getBuffetPlan(line.planId);
}

/** Materials preview — BOM explode lives in Finance; here we surface SKU readiness per line. */
export async function materialsPreview(planId: string) {
  const plan = await getBuffetPlan(planId);
  if (!plan) return null;
  const rows = plan.lines.map((line) => {
    const effectivePortions = effectiveBuffetPortions(line.plannedPortions, line.wastePct);
    const sku = line.recipeSku?.trim() || line.financeSku?.trim() || null;
    return {
      lineId: line.id,
      menuItemId: line.menuItemId,
      name: line.name,
      station: line.station,
      plannedPortions: line.plannedPortions,
      wastePct: line.wastePct,
      effectivePortions,
      recipeSku: sku,
      bomReady: Boolean(sku),
      warning: sku ? null : "RECIPE_SKU_MISSING",
    };
  });
  return {
    planId: plan.id,
    outletCode: plan.outletCode,
    serviceDate: plan.serviceDate,
    meal: plan.meal,
    coversTotal: plan.coversTotal,
    rows,
    missingBomCount: rows.filter((r) => !r.bomReady).length,
  };
}

/**
 * Merge plan dishes onto the outlet daily board for that date.
 * Does not wipe other meals' dishes (breakfast publish must not erase lunch board rows).
 */
export async function publishPlanToDailyMenu(planId: string) {
  const organizationId = requestOrganizationId();
  const plan = await prisma.buffetPlan.findFirst({
    where: { id: planId, organizationId },
    include: { lines: true },
  });
  if (!plan) return null;
  if (plan.lines.length === 0) {
    throw Object.assign(new Error("PLAN_EMPTY"), { code: "PLAN_EMPTY", status: 400 });
  }
  const boardDate = plan.serviceDate;
  const menuItemIds = [...new Set(plan.lines.map((l) => l.menuItemId))];
  const existingCount = await prisma.dailyMenuEntry.count({
    where: { outletId: plan.outletId, boardDate },
  });
  await prisma.$transaction(
    menuItemIds.map((menuItemId, idx) =>
      prisma.dailyMenuEntry.upsert({
        where: {
          outletId_menuItemId_boardDate: {
            outletId: plan.outletId,
            menuItemId,
            boardDate,
          },
        },
        create: {
          organizationId,
          outletId: plan.outletId,
          menuItemId,
          boardDate,
          sortOrder: existingCount + idx,
        },
        update: {},
      }),
    ),
  );
  const after = await prisma.dailyMenuEntry.count({
    where: { outletId: plan.outletId, boardDate },
  });
  return {
    outletId: plan.outletId,
    date: boardDate.toISOString().slice(0, 10),
    count: menuItemIds.length,
    added: Math.max(0, after - existingCount),
  };
}

export async function menuItemsForOutlet(outletId: string) {
  const organizationId = requestOrganizationId();
  const items = await prisma.menuItem.findMany({
    where: {
      organizationId,
      active: true,
      category: { outletId },
    },
    select: {
      id: true,
      plu: true,
      name: true,
      recipeSku: true,
      financeSku: true,
      category: { select: { name: true } },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
  return items.map((item) => ({
    id: item.id,
    plu: item.plu,
    name: item.name,
    recipeSku: item.recipeSku,
    financeSku: item.financeSku,
    categoryName: item.category.name,
    label: `${item.category.name} · ${item.name}`,
  }));
}
