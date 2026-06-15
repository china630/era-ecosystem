import { demandPremiumMultiplier, type CalendarDayType } from "@era/contracts";
import {
  getCalendarDaysRange,
  warmCalendarYear,
} from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/decimal";

const DEFAULT_DEMAND_PREMIUM = Number(
  process.env.HOTEL_AUTO_BAR_DEMAND_PREMIUM ?? "1.5",
);

export type AutoBarPreviewRow = {
  roomTypeId: string;
  roomTypeCode: string;
  date: string;
  baseAmount: number;
  demandPremium: number;
  projectedAmount: number;
  dayType: CalendarDayType;
};

async function resolveBarPlanId(): Promise<string | null> {
  const plan = await prisma.ratePlan.findFirst({
    where: { type: "BASE", code: "BAR", active: true },
    select: { id: true },
  });
  return plan?.id ?? null;
}

export async function previewAutoBar(input: {
  from: Date;
  to: Date;
  roomTypeId?: string;
  baseAmount?: number;
}): Promise<{ rows: AutoBarPreviewRow[] }> {
  const barPlanId = await resolveBarPlanId();
  if (!barPlanId) return { rows: [] };

  const fromIso = input.from.toISOString().slice(0, 10);
  const toIso = input.to.toISOString().slice(0, 10);
  await warmCalendarYear(Number(fromIso.slice(0, 4)));
  const days = await getCalendarDaysRange(fromIso, toIso);

  const roomTypes = await prisma.roomType.findMany({
    where: input.roomTypeId ? { id: input.roomTypeId } : undefined,
    select: { id: true, code: true },
  });

  const existing = await prisma.roomTypeRate.findMany({
    where: {
      ratePlanId: barPlanId,
      date: { gte: input.from, lte: input.to },
      ...(input.roomTypeId ? { roomTypeId: input.roomTypeId } : {}),
    },
    select: { roomTypeId: true, date: true, amount: true, source: true },
  });
  const existingMap = new Map(
    existing.map((r) => [
      `${r.roomTypeId}:${r.date.toISOString().slice(0, 10)}`,
      r,
    ]),
  );

  const rows: AutoBarPreviewRow[] = [];
  for (const rt of roomTypes) {
    for (const day of days) {
      const key = `${rt.id}:${day.date}`;
      const hit = existingMap.get(key);
      const base =
        input.baseAmount ??
        (hit ? Number(hit.amount) : 100);
      const premium = demandPremiumMultiplier(
        day.dayType as CalendarDayType,
        DEFAULT_DEMAND_PREMIUM,
      );
      rows.push({
        roomTypeId: rt.id,
        roomTypeCode: rt.code,
        date: day.date,
        baseAmount: base,
        demandPremium: premium,
        projectedAmount: Math.round(base * premium * 100) / 100,
        dayType: day.dayType as CalendarDayType,
      });
    }
  }
  return { rows };
}

export async function applyAutoBar(input: {
  from: Date;
  to: Date;
  roomTypeId?: string;
  baseAmount?: number;
  dryRun?: boolean;
}): Promise<{ upserted: number; skippedManual: number }> {
  const barPlanId = await resolveBarPlanId();
  if (!barPlanId) return { upserted: 0, skippedManual: 0 };

  const preview = await previewAutoBar(input);
  let upserted = 0;
  let skippedManual = 0;

  if (input.dryRun) {
    return { upserted: preview.rows.length, skippedManual: 0 };
  }

  for (const row of preview.rows) {
    const date = new Date(`${row.date}T12:00:00.000Z`);
    const existing = await prisma.roomTypeRate.findUnique({
      where: {
        ratePlanId_roomTypeId_date: {
          ratePlanId: barPlanId,
          roomTypeId: row.roomTypeId,
          date,
        },
      },
    });
    if (existing?.source === "MANUAL" && existing.lockedAt) {
      skippedManual++;
      continue;
    }
    await prisma.roomTypeRate.upsert({
      where: {
        ratePlanId_roomTypeId_date: {
          ratePlanId: barPlanId,
          roomTypeId: row.roomTypeId,
          date,
        },
      },
      create: {
        ratePlanId: barPlanId,
        roomTypeId: row.roomTypeId,
        date,
        amount: toDecimal(row.projectedAmount),
        currencyCode: "AZN",
        source: "AUTO",
      },
      update: {
        amount: toDecimal(row.projectedAmount),
        source: "AUTO",
      },
    });
    upserted++;
  }
  return { upserted, skippedManual };
}
