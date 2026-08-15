import { prisma } from "@/lib/prisma";
import { getTenantWorkHours } from "@/domain/settings/scheduling-settings";
import {
  bakuDayBounds,
  todayBakuYmd,
} from "@/domain/ops/day-summary.service";
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
  // EOD: after clinic dayEndHour on the scheduled calendar day.
  const dayEnd = new Date(order.scheduledAt);
  dayEnd.setHours(dayEndHour, 0, 0, 0);
  return now.getTime() >= dayEnd.getTime();
}

/** Combined day-close: auto-complete elapsed CHECKED_IN then sweep NO_SHOW. */
export async function runProcedureDayClose(now = new Date()) {
  const { autoCompleteElapsedCheckedIn } = await import(
    "@/domain/procedure/procedure-completion.service"
  );
  const completed = await autoCompleteElapsedCheckedIn(now);
  const noShows = await sweepNoShowScheduled(now);
  return { completed, noShows };
}
