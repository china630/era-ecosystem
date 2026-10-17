import { prisma } from "@/lib/prisma";
import { bakuDateKey } from "@/lib/baku-day";
import { dayStartInstant, listClinicDays } from "@/domain/planning/clinic-day";
import { parseBathDayModes, planBathSeries, type KeptCell } from "@/domain/planning/bath-calendar";
import {
  bathPolicyFromSettings,
  defaultBathModeFromSettings,
  getSchedulingSettings,
} from "@/domain/settings/scheduling-settings";
import { releaseProcedureOccupancy } from "@/domain/procedure/procedure-allocation.service";

export type ScheduleMove = {
  orderId: string;
  procedureCode: string;
  fromYmd: string;
  toYmd: string | null;
  reason: string;
};

const LOCKED = new Set(["CHECKED_IN", "COMPLETED"]);

function asMode(value: unknown): string | null {
  const text = String(value ?? "").trim().toUpperCase();
  if (!/^[0-9A-Z_]{1,16}$/.test(text)) return null;
  return text;
}

/**
 * Non-bath orders move when the working set changes.
 * Opening one day shifts the tail backward. Closing one day shifts the tail forward.
 * Opening one day and closing another swaps those two days.
 * A bath series is laid again on the new green days. Past, today, checked-in and completed stay.
 */
export async function previewScheduleRecalc(episodeId?: string): Promise<ScheduleMove[]> {
  const today = bakuDateKey(new Date());
  const settings = await getSchedulingSettings();
  const bathModes = parseBathDayModes(settings.bathDayModesJson);
  const episodes = await prisma.clinicalEpisode.findMany({
    where: {
      status: "OPEN",
      ...(episodeId ? { id: episodeId } : {}),
      programInstance: { isNot: null },
    },
    select: {
      id: true,
      programInstance: { select: { startsOn: true, endsOn: true } },
    },
  });
  const series = await prisma.procedureDaySeries.findMany({
    where: { active: true },
    include: { members: true },
  });
  const memberOf = new Map(series.flatMap((row) => row.members.map((member) => [member.procedureCode, { series: row, member }])));
  const moves: ScheduleMove[] = [];

  for (const episode of episodes) {
    const stay = episode.programInstance;
    if (!stay) continue;
    const fromYmd = bakuDateKey(stay.startsOn);
    const toYmd = bakuDateKey(stay.endsOn);
    const days = await listClinicDays(fromYmd, toYmd);
    const futureWorking = days.filter((day) => day.working && day.ymd > today).map((day) => day.ymd);
    const orders = await prisma.procedureOrder.findMany({
      where: {
        clinicalEpisodeId: episode.id,
        status: { in: ["SCHEDULED", "PROPOSED", "CHECKED_IN", "COMPLETED"] },
        scheduledAt: { gte: stay.startsOn, lt: stay.endsOn },
      },
      select: {
        id: true,
        procedureCode: true,
        status: true,
        scheduledAt: true,
        note: true,
        physioFields: true,
      },
    });

    const bathOrders = orders.filter((order) => memberOf.has(order.procedureCode));
    const other = orders.filter((order) => !memberOf.has(order.procedureCode) && !LOCKED.has(order.status));
    const byDay = new Map<string, typeof other>();
    for (const order of other) {
      const ymd = bakuDateKey(order.scheduledAt);
      if (ymd <= today) continue;
      const list = byDay.get(ymd) ?? [];
      list.push(order);
      byDay.set(ymd, list);
    }
    const oldDays = [...byDay.keys()].sort();
    const closed = oldDays.filter((ymd) => !futureWorking.includes(ymd));
    const opened = futureWorking.filter((ymd) => !oldDays.includes(ymd));
    if (closed.length === 1 && opened.length === 1) {
      swapDay(byDay, closed[0]!, opened[0]!, moves);
    } else if (opened.length === 1 && closed.length === 0) {
      shiftBackward(oldDays, opened[0]!, futureWorking, byDay, toYmd, moves);
    } else if (closed.length === 1 && opened.length === 0) {
      shiftForward(oldDays, closed[0]!, futureWorking, byDay, toYmd, moves);
    }

    const byProcedure = new Map<string, typeof bathOrders>();
    for (const order of bathOrders) {
      const list = byProcedure.get(order.procedureCode) ?? [];
      list.push(order);
      byProcedure.set(order.procedureCode, list);
    }
    const kept: KeptCell[] = [];
    const seriesInputs: Array<{
      seriesCode: string;
      procedureCode: string;
      mark: string;
      mode: string;
      qty: number;
      fillsRestDays: boolean;
    }> = [];
    const automaticByCode = new Map<string, typeof bathOrders>();
    for (const [procedureCode, rows] of byProcedure) {
      const info = memberOf.get(procedureCode);
      if (!info) continue;
      const sample = rows.find((row) => row.physioFields && typeof row.physioFields === "object");
      const fields = (sample?.physioFields ?? {}) as Record<string, unknown>;
      const automatic: typeof bathOrders = [];
      for (const row of rows) {
        const ymd = bakuDateKey(row.scheduledAt);
        const day = days.find((item) => item.ymd === ymd);
        if (LOCKED.has(row.status) || ymd <= today) {
          kept.push({ ymd, procedureCode, locked: true });
          continue;
        }
        const manual = row.note === "bath_manual";
        if (manual && day && !day.working) {
          const replacement = opened[0] ?? futureWorking.find((item) => item > ymd);
          if (replacement) {
            moves.push({
              orderId: row.id,
              procedureCode,
              fromYmd: ymd,
              toYmd: replacement,
              reason: "manual_bath_moved",
            });
            kept.push({ ymd: replacement, procedureCode, locked: true });
          } else {
            moves.push({
              orderId: row.id,
              procedureCode,
              fromYmd: ymd,
              toYmd: null,
              reason: "manual_bath_quota",
            });
          }
          continue;
        }
        if (manual && day?.working) {
          kept.push({ ymd, procedureCode, locked: true });
          continue;
        }
        automatic.push(row);
      }
      automaticByCode.set(procedureCode, automatic);
      seriesInputs.push({
        seriesCode: info.series.code,
        procedureCode,
        mark: info.member.shortMark,
        mode: asMode(fields.dayBlock) ?? defaultBathModeFromSettings(settings),
        qty: kept.filter((cell) => cell.procedureCode === procedureCode).length + automatic.length,
        fillsRestDays: info.series.fillsRestDays,
      });
    }
    if (seriesInputs.length > 0) {
      const planned = planBathSeries({
        days: days.filter((day) => day.ymd > today),
        series: seriesInputs,
        kept,
        modes: bathModes,
        notBeforeYmd: today,
        policy: bathPolicyFromSettings(settings),
      });
      for (const [procedureCode, automatic] of automaticByCode) {
        const plannedDays = planned
          .filter((cell) => cell.procedureCode === procedureCode && !cell.locked)
          .map((cell) => cell.ymd);
        automatic.forEach((row, index) => {
          const target = plannedDays[index] ?? null;
          const fromYmd = bakuDateKey(row.scheduledAt);
          if (target === fromYmd) return;
          moves.push({
            orderId: row.id,
            procedureCode,
            fromYmd,
            toYmd: target,
            reason: target ? "bath_relaid" : "bath_quota",
          });
        });
      }
    }
  }
  return moves;
}

function swapDay(
  byDay: Map<string, { id: string; procedureCode: string }[]>,
  fromYmd: string,
  toYmd: string,
  moves: ScheduleMove[],
) {
  for (const order of byDay.get(fromYmd) ?? []) {
    moves.push({ orderId: order.id, procedureCode: order.procedureCode, fromYmd, toYmd, reason: "swap_day" });
  }
  for (const order of byDay.get(toYmd) ?? []) {
    moves.push({ orderId: order.id, procedureCode: order.procedureCode, fromYmd: toYmd, toYmd: fromYmd, reason: "swap_day" });
  }
}

function shiftBackward(
  oldDays: string[],
  opened: string,
  futureWorking: string[],
  byDay: Map<string, { id: string; procedureCode: string }[]>,
  stayEnd: string,
  moves: ScheduleMove[],
) {
  const sequence = [...futureWorking].sort();
  const tail = oldDays.filter((ymd) => ymd >= opened).sort();
  tail.forEach((ymd, index) => {
    const target = sequence[sequence.indexOf(opened) + index];
    if (!target || target >= stayEnd || target === ymd) {
      if (!target || target >= stayEnd) {
        for (const order of byDay.get(ymd) ?? []) {
          moves.push({ orderId: order.id, procedureCode: order.procedureCode, fromYmd: ymd, toYmd: null, reason: "past_checkout" });
        }
      }
      return;
    }
    for (const order of byDay.get(ymd) ?? []) {
      moves.push({ orderId: order.id, procedureCode: order.procedureCode, fromYmd: ymd, toYmd: target, reason: "shift_back" });
    }
  });
}

function shiftForward(
  oldDays: string[],
  closed: string,
  futureWorking: string[],
  byDay: Map<string, { id: string; procedureCode: string }[]>,
  stayEnd: string,
  moves: ScheduleMove[],
) {
  const tail = oldDays.filter((ymd) => ymd >= closed).sort();
  const targets = futureWorking.filter((ymd) => ymd > closed);
  tail.forEach((ymd, index) => {
    const target = targets[index];
    if (!target || target >= stayEnd) {
      for (const order of byDay.get(ymd) ?? []) {
        moves.push({ orderId: order.id, procedureCode: order.procedureCode, fromYmd: ymd, toYmd: null, reason: "past_checkout" });
      }
      return;
    }
    if (target === ymd) return;
    for (const order of byDay.get(ymd) ?? []) {
      moves.push({ orderId: order.id, procedureCode: order.procedureCode, fromYmd: ymd, toYmd: target, reason: "shift_forward" });
    }
  });
}

export async function applyScheduleRecalc(episodeId?: string): Promise<ScheduleMove[]> {
  const moves = await previewScheduleRecalc(episodeId);
  for (const move of moves) {
    if (!move.toYmd) {
      await releaseProcedureOccupancy([move.orderId]);
      await prisma.procedureOrder.update({
        where: { id: move.orderId },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: move.reason },
      });
      continue;
    }
    await prisma.procedureOrder.update({
      where: { id: move.orderId },
      data: {
        scheduledAt: dayStartInstant(move.toYmd, 9),
        ...(move.reason === "manual_bath_moved" ? { note: "bath_manual" } : {}),
      },
    });
  }
  return moves;
}
