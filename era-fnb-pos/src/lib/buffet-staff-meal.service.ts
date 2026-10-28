import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { BUFFET_MEALS, type BuffetMealCode } from "@/lib/buffet-planner-math";
import { addDaysYmd, isoWeekdayFromYmd } from "@/lib/buffet-week-calendar";
import {
  getEffectiveBuffetCostForOutlet,
} from "@/lib/buffet-cost-settings.service";
import { buildCostRunAttributionSlices } from "@/lib/staff-buffet-overlap";

const slotInclude = {
  lines: {
    include: {
      menuItem: { select: { id: true, plu: true, name: true } },
    },
    orderBy: [{ sortOrder: "asc" as const }, { station: "asc" as const }],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeSlot(slot: any) {
  return {
    id: slot.id as string,
    weekday: slot.weekday as number,
    meal: slot.meal as string,
    coversStaff: slot.coversStaff as number,
    notes: (slot.notes as string | null) ?? null,
    lines: (slot.lines as Array<Record<string, unknown>>).map((line) => ({
      id: line.id as string,
      menuItemId: line.menuItemId as string,
      station: line.station as string,
      plannedPortions: line.plannedPortions as number,
      wastePct: Number(line.wastePct),
      sortOrder: line.sortOrder as number,
      plu: (line.menuItem as { plu: string }).plu,
      name: (line.menuItem as { name: string }).name,
    })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializePlan(row: any) {
  return {
    id: row.id as string,
    outletId: row.outletId as string,
    outletCode: row.outlet.code as string,
    outletName: row.outlet.name as string,
    name: row.name as string,
    active: row.active as boolean,
    slots: (row.slots as unknown[]).map(serializeSlot),
  };
}

export async function listStaffMealPlans(outletId?: string) {
  const organizationId = requestOrganizationId();
  const rows = await prisma.buffetStaffMealPlan.findMany({
    where: {
      organizationId,
      ...(outletId ? { outletId } : {}),
    },
    include: {
      outlet: { select: { id: true, code: true, name: true } },
      slots: { include: slotInclude, orderBy: [{ weekday: "asc" }, { meal: "asc" }] },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return rows.map(serializePlan);
}

export async function getStaffMealPlan(id: string) {
  const organizationId = requestOrganizationId();
  const row = await prisma.buffetStaffMealPlan.findFirst({
    where: { id, organizationId },
    include: {
      outlet: { select: { id: true, code: true, name: true } },
      slots: { include: slotInclude, orderBy: [{ weekday: "asc" }, { meal: "asc" }] },
    },
  });
  if (!row) {
    throw Object.assign(new Error("STAFF_PLAN_NOT_FOUND"), { code: "STAFF_PLAN_NOT_FOUND" });
  }
  return serializePlan(row);
}

export async function createStaffMealPlan(input: {
  outletId: string;
  name: string;
  active?: boolean;
}) {
  const organizationId = requestOrganizationId();
  const outlet = await prisma.outlet.findFirst({
    where: { id: input.outletId, organizationId },
    select: { id: true },
  });
  if (!outlet) {
    throw Object.assign(new Error("OUTLET_NOT_FOUND"), { code: "OUTLET_NOT_FOUND" });
  }
  const name = input.name.trim() || "Staff meals";
  if (input.active !== false) {
    await prisma.buffetStaffMealPlan.updateMany({
      where: { organizationId, outletId: input.outletId, active: true },
      data: { active: false },
    });
  }
  const row = await prisma.buffetStaffMealPlan.create({
    data: {
      organizationId,
      outletId: input.outletId,
      name,
      active: input.active !== false,
    },
    include: {
      outlet: { select: { id: true, code: true, name: true } },
      slots: { include: slotInclude },
    },
  });
  return serializePlan(row);
}

export async function patchStaffMealPlan(
  id: string,
  input: { name?: string; active?: boolean },
) {
  const organizationId = requestOrganizationId();
  const existing = await prisma.buffetStaffMealPlan.findFirst({
    where: { id, organizationId },
  });
  if (!existing) {
    throw Object.assign(new Error("STAFF_PLAN_NOT_FOUND"), { code: "STAFF_PLAN_NOT_FOUND" });
  }
  if (input.active === true) {
    await prisma.buffetStaffMealPlan.updateMany({
      where: {
        organizationId,
        outletId: existing.outletId,
        active: true,
        id: { not: id },
      },
      data: { active: false },
    });
  }
  await prisma.buffetStaffMealPlan.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() || existing.name } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
  return getStaffMealPlan(id);
}

export type StaffSlotLineInput = {
  menuItemId: string;
  station?: string;
  plannedPortions: number;
  wastePct?: number;
  sortOrder?: number;
};

export async function upsertStaffMealSlot(
  planId: string,
  input: {
    weekday: number;
    meal: BuffetMealCode;
    coversStaff: number;
    notes?: string | null;
    lines?: StaffSlotLineInput[];
  },
) {
  const organizationId = requestOrganizationId();
  if (input.weekday < 1 || input.weekday > 7) {
    throw Object.assign(new Error("INVALID_WEEKDAY"), { code: "INVALID_WEEKDAY" });
  }
  if (!(BUFFET_MEALS as readonly string[]).includes(input.meal)) {
    throw Object.assign(new Error("INVALID_MEAL"), { code: "INVALID_MEAL" });
  }
  const plan = await prisma.buffetStaffMealPlan.findFirst({
    where: { id: planId, organizationId },
  });
  if (!plan) {
    throw Object.assign(new Error("STAFF_PLAN_NOT_FOUND"), { code: "STAFF_PLAN_NOT_FOUND" });
  }

  const lines = input.lines ?? [];
  if (lines.length > 0) {
    const menuIds = [...new Set(lines.map((l) => l.menuItemId))];
    const found = await prisma.menuItem.findMany({
      where: {
        id: { in: menuIds },
        organizationId,
        category: { outletId: plan.outletId },
      },
      select: { id: true },
    });
    if (found.length !== menuIds.length) {
      throw Object.assign(new Error("MENU_ITEM_NOT_FOUND"), { code: "MENU_ITEM_NOT_FOUND" });
    }
  }

  await prisma.$transaction(async (tx) => {
    const slot = await tx.buffetStaffMealPlanSlot.upsert({
      where: {
        planId_weekday_meal: {
          planId,
          weekday: input.weekday,
          meal: input.meal,
        },
      },
      create: {
        organizationId,
        planId,
        weekday: input.weekday,
        meal: input.meal,
        coversStaff: Math.max(0, Math.floor(input.coversStaff)),
        notes: input.notes ?? null,
      },
      update: {
        coversStaff: Math.max(0, Math.floor(input.coversStaff)),
        notes: input.notes !== undefined ? input.notes : undefined,
      },
    });
    if (input.lines !== undefined) {
      await tx.buffetStaffMealPlanLine.deleteMany({ where: { slotId: slot.id } });
      if (lines.length > 0) {
        await tx.buffetStaffMealPlanLine.createMany({
          data: lines.map((line, idx) => ({
            organizationId,
            slotId: slot.id,
            menuItemId: line.menuItemId,
            station: (line.station ?? "MAIN").trim() || "MAIN",
            plannedPortions: Math.max(1, Math.floor(line.plannedPortions)),
            wastePct: line.wastePct ?? 0,
            sortOrder: line.sortOrder ?? idx,
          })),
        });
      }
    }
  });
  return getStaffMealPlan(planId);
}

export async function deleteStaffMealSlot(
  planId: string,
  weekday: number,
  meal: BuffetMealCode,
) {
  const organizationId = requestOrganizationId();
  const plan = await prisma.buffetStaffMealPlan.findFirst({
    where: { id: planId, organizationId },
  });
  if (!plan) {
    throw Object.assign(new Error("STAFF_PLAN_NOT_FOUND"), { code: "STAFF_PLAN_NOT_FOUND" });
  }
  await prisma.buffetStaffMealPlanSlot.deleteMany({
    where: { planId, weekday, meal, organizationId },
  });
  return getStaffMealPlan(planId);
}

/**
 * Sum staff covers across civil days [fromYmd, toYmd] for the active staff plan
 * (each day's ISO weekday × meal slots).
 */
export async function sumStaffCoversForPeriod(args: {
  outletId: string;
  fromYmd: string;
  toYmd: string;
  organizationId?: string;
}): Promise<{ planId: string | null; coversStaffTotal: number }> {
  const organizationId = args.organizationId ?? requestOrganizationId();
  if (args.fromYmd > args.toYmd) {
    throw Object.assign(new Error("INVALID_DATE_RANGE"), { code: "INVALID_DATE_RANGE" });
  }
  const plan = await prisma.buffetStaffMealPlan.findFirst({
    where: { organizationId, outletId: args.outletId, active: true },
    include: { slots: { select: { weekday: true, meal: true, coversStaff: true } } },
  });
  if (!plan) return { planId: null, coversStaffTotal: 0 };

  const byWeekday = new Map<number, number>();
  for (const slot of plan.slots) {
    byWeekday.set(
      slot.weekday,
      (byWeekday.get(slot.weekday) ?? 0) + Math.max(0, slot.coversStaff),
    );
  }

  let total = 0;
  let cursor = args.fromYmd;
  while (cursor <= args.toYmd) {
    const wd = isoWeekdayFromYmd(cursor);
    total += byWeekday.get(wd) ?? 0;
    cursor = addDaysYmd(cursor, 1);
  }
  return { planId: plan.id, coversStaffTotal: total };
}

/** Active staff plan covers for outlet × civil date × meal. */
export async function getStaffCoversForDate(args: {
  outletId: string;
  serviceDateYmd: string;
  meal: BuffetMealCode;
}): Promise<{ planId: string | null; coversStaff: number }> {
  const organizationId = requestOrganizationId();
  const plan = await prisma.buffetStaffMealPlan.findFirst({
    where: { organizationId, outletId: args.outletId, active: true },
    include: {
      slots: {
        where: {
          weekday: isoWeekdayFromYmd(args.serviceDateYmd),
          meal: args.meal,
        },
        take: 1,
      },
    },
  });
  if (!plan) return { planId: null, coversStaff: 0 };
  return {
    planId: plan.id,
    coversStaff: plan.slots[0]?.coversStaff ?? 0,
  };
}

/**
 * Export staff + overlap slice for Finance cost run (Wave 5 consumer).
 * `staffGrossAzn` / usage figures are caller-supplied until Finance prices BOM.
 */
export async function exportStaffCostRunSlice(args: {
  outletId: string;
  foodUsageAzn: number;
  posAttributedAzn: number;
  staffGrossAzn: number;
}) {
  const organizationId = requestOrganizationId();
  const outlet = await prisma.outlet.findFirst({
    where: { id: args.outletId, organizationId },
    select: { id: true, code: true, name: true },
  });
  if (!outlet) {
    throw Object.assign(new Error("OUTLET_NOT_FOUND"), { code: "OUTLET_NOT_FOUND" });
  }
  const effective = await getEffectiveBuffetCostForOutlet(args.outletId, organizationId);
  const slices = buildCostRunAttributionSlices({
    foodUsage: args.foodUsageAzn,
    posAttributed: args.posAttributedAzn,
    staffGross: args.staffGrossAzn,
    mode: effective.staffBuffetOverlap,
    overlapPct: effective.overlapPct,
  });
  const activePlan = await prisma.buffetStaffMealPlan.findFirst({
    where: { organizationId, outletId: args.outletId, active: true },
    select: { id: true, name: true },
  });
  return {
    outletId: outlet.id,
    outletCode: outlet.code,
    outletName: outlet.name,
    staffPlan: activePlan
      ? { id: activePlan.id, name: activePlan.name }
      : null,
    overlapSettings: {
      staffBuffetOverlap: effective.staffBuffetOverlap,
      overlapPct: effective.overlapPct,
    },
    ...slices,
  };
}
