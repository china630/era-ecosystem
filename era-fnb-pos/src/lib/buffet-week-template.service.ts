import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuCivilUtcDate } from "@era/satellite-kit/time";
import { BUFFET_MEALS, type BuffetMealCode } from "@/lib/buffet-planner-math";
import { ymdForWeekday, mondayOfWeekYmd } from "@/lib/buffet-week-calendar";
import { getBuffetPlan } from "@/lib/buffet-planner";

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
    coversAdult: slot.coversAdult as number,
    coversChild: slot.coversChild as number,
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
function serializeTemplate(row: any) {
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

export async function listWeekTemplates(outletId?: string) {
  const organizationId = requestOrganizationId();
  const rows = await prisma.buffetWeekTemplate.findMany({
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
  return rows.map(serializeTemplate);
}

export async function getWeekTemplate(id: string) {
  const organizationId = requestOrganizationId();
  const row = await prisma.buffetWeekTemplate.findFirst({
    where: { id, organizationId },
    include: {
      outlet: { select: { id: true, code: true, name: true } },
      slots: { include: slotInclude, orderBy: [{ weekday: "asc" }, { meal: "asc" }] },
    },
  });
  if (!row) {
    throw Object.assign(new Error("TEMPLATE_NOT_FOUND"), { code: "TEMPLATE_NOT_FOUND" });
  }
  return serializeTemplate(row);
}

export async function createWeekTemplate(input: {
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
  const name = input.name.trim() || "Weekly buffet";
  if (input.active !== false) {
    await prisma.buffetWeekTemplate.updateMany({
      where: { organizationId, outletId: input.outletId, active: true },
      data: { active: false },
    });
  }
  const row = await prisma.buffetWeekTemplate.create({
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
  return serializeTemplate(row);
}

export async function patchWeekTemplate(
  id: string,
  input: { name?: string; active?: boolean },
) {
  const organizationId = requestOrganizationId();
  const existing = await prisma.buffetWeekTemplate.findFirst({
    where: { id, organizationId },
  });
  if (!existing) {
    throw Object.assign(new Error("TEMPLATE_NOT_FOUND"), { code: "TEMPLATE_NOT_FOUND" });
  }
  if (input.active === true) {
    await prisma.buffetWeekTemplate.updateMany({
      where: {
        organizationId,
        outletId: existing.outletId,
        active: true,
        id: { not: id },
      },
      data: { active: false },
    });
  }
  await prisma.buffetWeekTemplate.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() || existing.name } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
  });
  return getWeekTemplate(id);
}

export type TemplateSlotLineInput = {
  menuItemId: string;
  station?: string;
  plannedPortions: number;
  wastePct?: number;
  sortOrder?: number;
};

export async function upsertWeekTemplateSlot(
  templateId: string,
  input: {
    weekday: number;
    meal: BuffetMealCode;
    coversAdult: number;
    coversChild: number;
    notes?: string | null;
    lines?: TemplateSlotLineInput[];
  },
) {
  const organizationId = requestOrganizationId();
  if (input.weekday < 1 || input.weekday > 7) {
    throw Object.assign(new Error("INVALID_WEEKDAY"), { code: "INVALID_WEEKDAY" });
  }
  if (!(BUFFET_MEALS as readonly string[]).includes(input.meal)) {
    throw Object.assign(new Error("INVALID_MEAL"), { code: "INVALID_MEAL" });
  }
  const template = await prisma.buffetWeekTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
  if (!template) {
    throw Object.assign(new Error("TEMPLATE_NOT_FOUND"), { code: "TEMPLATE_NOT_FOUND" });
  }

  const lines = input.lines ?? [];
  if (lines.length > 0) {
    const menuIds = [...new Set(lines.map((l) => l.menuItemId))];
    const found = await prisma.menuItem.findMany({
      where: {
        id: { in: menuIds },
        organizationId,
        category: { outletId: template.outletId },
      },
      select: { id: true },
    });
    if (found.length !== menuIds.length) {
      throw Object.assign(new Error("MENU_ITEM_NOT_FOUND"), { code: "MENU_ITEM_NOT_FOUND" });
    }
  }

  await prisma.$transaction(async (tx) => {
    const slot = await tx.buffetWeekTemplateSlot.upsert({
      where: {
        templateId_weekday_meal: {
          templateId,
          weekday: input.weekday,
          meal: input.meal,
        },
      },
      create: {
        organizationId,
        templateId,
        weekday: input.weekday,
        meal: input.meal,
        coversAdult: input.coversAdult,
        coversChild: input.coversChild,
        notes: input.notes ?? null,
      },
      update: {
        coversAdult: input.coversAdult,
        coversChild: input.coversChild,
        notes: input.notes !== undefined ? input.notes : undefined,
      },
    });
    if (input.lines !== undefined) {
      await tx.buffetWeekTemplateLine.deleteMany({ where: { slotId: slot.id } });
      if (lines.length > 0) {
        await tx.buffetWeekTemplateLine.createMany({
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
  return getWeekTemplate(templateId);
}

/** Copy a daily plan's covers + lines into a template slot. */
export async function captureSlotFromPlan(
  templateId: string,
  planId: string,
  weekday: number,
) {
  const organizationId = requestOrganizationId();
  const template = await prisma.buffetWeekTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
  if (!template) {
    throw Object.assign(new Error("TEMPLATE_NOT_FOUND"), { code: "TEMPLATE_NOT_FOUND" });
  }
  const plan = await prisma.buffetPlan.findFirst({
    where: { id: planId, organizationId, outletId: template.outletId },
    include: { lines: true },
  });
  if (!plan) {
    throw Object.assign(new Error("PLAN_NOT_FOUND"), { code: "PLAN_NOT_FOUND" });
  }
  return upsertWeekTemplateSlot(templateId, {
    weekday,
    meal: plan.meal as BuffetMealCode,
    coversAdult: plan.coversAdult,
    coversChild: plan.coversChild,
    notes: plan.notes,
    lines: plan.lines.map((line) => ({
      menuItemId: line.menuItemId,
      station: line.station,
      plannedPortions: line.plannedPortions,
      wastePct: Number(line.wastePct),
      sortOrder: line.sortOrder,
    })),
  });
}

export async function deleteWeekTemplateSlot(
  templateId: string,
  weekday: number,
  meal: BuffetMealCode,
) {
  const organizationId = requestOrganizationId();
  const template = await prisma.buffetWeekTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
  if (!template) {
    throw Object.assign(new Error("TEMPLATE_NOT_FOUND"), { code: "TEMPLATE_NOT_FOUND" });
  }
  await prisma.buffetWeekTemplateSlot.deleteMany({
    where: { templateId, weekday, meal, organizationId },
  });
  return getWeekTemplate(templateId);
}

/**
 * Spawn DRAFT BuffetPlan rows for each template slot in the week of `weekStart`
 * (normalized to Monday). Existing slots are skipped when skipExisting=true.
 */
export async function spawnWeekFromTemplate(
  templateId: string,
  weekStartYmd: string,
  opts?: { skipExisting?: boolean },
) {
  const organizationId = requestOrganizationId();
  const skipExisting = opts?.skipExisting !== false;
  const weekMonday = mondayOfWeekYmd(weekStartYmd);
  const template = await prisma.buffetWeekTemplate.findFirst({
    where: { id: templateId, organizationId },
    include: { slots: { include: { lines: true } } },
  });
  if (!template) {
    throw Object.assign(new Error("TEMPLATE_NOT_FOUND"), { code: "TEMPLATE_NOT_FOUND" });
  }
  if (template.slots.length === 0) {
    throw Object.assign(new Error("TEMPLATE_EMPTY"), { code: "TEMPLATE_EMPTY" });
  }

  const createdIds: string[] = [];
  const skipped: Array<{ weekday: number; meal: string; serviceDate: string }> = [];

  for (const slot of template.slots) {
    const serviceDateYmd = ymdForWeekday(weekMonday, slot.weekday);
    const serviceDate = bakuCivilUtcDate(serviceDateYmd);
    const clash = await prisma.buffetPlan.findFirst({
      where: {
        outletId: template.outletId,
        serviceDate,
        meal: slot.meal,
      },
      select: { id: true },
    });
    if (clash) {
      if (skipExisting) {
        skipped.push({
          weekday: slot.weekday,
          meal: slot.meal,
          serviceDate: serviceDateYmd,
        });
        continue;
      }
      throw Object.assign(new Error("PLAN_SLOT_TAKEN"), {
        code: "PLAN_SLOT_TAKEN",
        serviceDate: serviceDateYmd,
        meal: slot.meal,
      });
    }
    const id = await prisma.$transaction(async (tx) => {
      const plan = await tx.buffetPlan.create({
        data: {
          organizationId,
          outletId: template.outletId,
          serviceDate,
          meal: slot.meal,
          status: "DRAFT",
          coversAdult: slot.coversAdult,
          coversChild: slot.coversChild,
          coversSource: "MANUAL",
          notes: slot.notes,
        },
      });
      if (slot.lines.length > 0) {
        await tx.buffetPlanLine.createMany({
          data: slot.lines.map((line) => ({
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
    createdIds.push(id);
  }

  const plans = [];
  for (const id of createdIds) {
    plans.push(await getBuffetPlan(id));
  }
  return {
    weekMonday,
    created: plans,
    skipped,
  };
}
