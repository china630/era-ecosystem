import { prisma } from "@/lib/prisma";
import { getTenantWorkHours } from "@/domain/settings/scheduling-settings";
import {
  bakuDayBounds,
  todayBakuYmd,
} from "@/domain/ops/day-summary.service";
import { bakuDateKey, parseBakuDateTime } from "@/lib/baku-day";
import {
  markProcedureNoShow,
  SYSTEM_ATTENDANCE_ACTOR,
  addMinutes,
} from "@/domain/procedure/procedure-attendance.service";

/**
 * End-of-day (or optional autoNoShowAfterMin) sweep for the **current Baku day only**:
 * SCHEDULED orders that never checked in → NO_SHOW (burns quota + may charge).
 * Keeps ResourceBooking so the matrix still shows the no-show bar.
 */
export async function sweepNoShowScheduled(now = new Date()): Promise<{
  marked: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}> {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  const autoAfter = tenant?.autoNoShowAfterMin ?? null;
  const hours = await getTenantWorkHours();
  const { start, end } = bakuDayBounds(todayBakuYmd(now));

  const candidates = await prisma.procedureOrder.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gte: start, lt: end },
    },
    select: { id: true, scheduledAt: true, endsAt: true },
    take: 500,
    orderBy: { scheduledAt: "asc" },
  });

  let marked = 0;
  let failed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const order of candidates) {
    const due = isNoShowDue(order, now, autoAfter, hours.dayEndHour);
    if (!due) continue;
    try {
      await markProcedureNoShow(order.id, SYSTEM_ATTENDANCE_ACTOR);
      marked += 1;
    } catch (err) {
      failed += 1;
      errors.push({
        id: order.id,
        error: err instanceof Error ? err.message : "no-show sweep failed",
      });
    }
  }

  return { marked, failed, errors };
}

function isNoShowDue(
  order: { scheduledAt: Date; endsAt: Date | null },
  now: Date,
  autoAfterMin: number | null,
  dayEndHour: number,
): boolean {
  if (autoAfterMin != null && autoAfterMin > 0) {
    return addMinutes(order.scheduledAt, autoAfterMin).getTime() < now.getTime();
  }
  // EOD: after clinic dayEndHour on the scheduled Baku calendar day.
  const dayEnd = parseBakuDateTime(
    bakuDateKey(order.scheduledAt),
    `${String(dayEndHour).padStart(2, "0")}:00`,
  );
  return now.getTime() >= dayEnd.getTime();
}

/** Combined day-close: auto-complete elapsed CHECKED_IN then sweep NO_SHOW. */
export async function runProcedureDayClose(now = new Date()) {
  const { autoCompleteElapsedCheckedIn } = await import(
    "@/domain/procedure/procedure-completion.service"
  );
  const completed = await autoCompleteElapsedCheckedIn(now);
  const noShows = await sweepNoShowScheduled(now);
  const unpaidMissed = await sweepUnpaidMissed(now);
  return { completed, noShows, unpaidMissed };
}

/**
 * After the clinic day ends, unpaid extras leave the cheque list and free any
 * cabin. Passes (ADR clinic-extra-procedure-route):
 * 1) today's seated rows
 * 2) any row with scheduledAt before today (seated or not)
 * 3) unseated rows created before today (schema requires scheduledAt; UI "—"
 *    was no cabin — HOLD_UNTIL_PAY / failed seat leftovers)
 * Future-dated seated rows stay. Checkout still closes the whole episode. Not NO_SHOW.
 */
export type UnpaidMissedPass = {
  reason: "unpaid_missed" | "unpaid_missed_overdue" | "unpaid_missed_unseated";
  where: {
    resourceId?: { not: null } | null;
    scheduledAt?: { gte: Date; lt: Date } | { lt: Date };
    createdAt?: { lt: Date };
  };
};

/** Pure scopes for day-end unpaid extras. Empty when before dayEndHour. */
export function unpaidMissedSweepPasses(
  now: Date,
  dayStart: Date,
  dayEnd: Date,
  dayEndHourBoundary: Date,
): UnpaidMissedPass[] {
  if (now.getTime() < dayEndHourBoundary.getTime()) return [];
  return [
    {
      reason: "unpaid_missed",
      where: {
        resourceId: { not: null },
        scheduledAt: { gte: dayStart, lt: dayEnd },
      },
    },
    {
      reason: "unpaid_missed_overdue",
      where: { scheduledAt: { lt: dayStart } },
    },
    {
      reason: "unpaid_missed_unseated",
      where: { resourceId: null, createdAt: { lt: dayStart } },
    },
  ];
}

export async function sweepUnpaidMissed(now = new Date()): Promise<{
  marked: number;
  byPass: Record<string, number>;
}> {
  const hours = await getTenantWorkHours();
  const ymd = todayBakuYmd(now);
  const dayEndHourBoundary = parseBakuDateTime(
    ymd,
    `${String(hours.dayEndHour).padStart(2, "0")}:00`,
  );
  const { start, end } = bakuDayBounds(ymd);
  const passes = unpaidMissedSweepPasses(now, start, end, dayEndHourBoundary);
  if (passes.length === 0) return { marked: 0, byPass: {} };

  const { closeUnpaidExtras } = await import("@/domain/sanatorium/extras-assign.service");
  const byPass: Record<string, number> = {};
  let marked = 0;
  for (const pass of passes) {
    const n = await closeUnpaidExtras(pass.where, pass.reason);
    byPass[pass.reason] = n;
    marked += n;
  }
  return { marked, byPass };
}
