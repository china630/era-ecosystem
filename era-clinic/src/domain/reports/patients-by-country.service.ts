import { prisma } from "@/lib/prisma";
import {
  addBakuDays,
  bakuDateKey,
  bakuMonthBounds,
  todayBakuYmd,
} from "@era/satellite-kit/time";

const PAID_EXTRA_STATUSES = ["SCHEDULED", "CHECKED_IN", "COMPLETED", "NO_SHOW"] as const;

export type CountryReportRow = {
  code: string;
  guests: number;
  nights: number;
  extras: number;
};

function lastDayYmd(periodKey: string): string {
  const [ys, ms] = periodKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ys}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/** Nights slept inside the Baku month. Checkout day and "today" on an open stay are exclusive. */
export function nightsInsideMonth(
  openedAt: Date,
  closedAt: Date | null,
  periodKey: string,
): number {
  const monthStart = `${periodKey}-01`;
  const monthEndExclusive = addBakuDays(lastDayYmd(periodKey), 1);
  const stayStart = bakuDateKey(openedAt);
  const stayEnd = closedAt ? bakuDateKey(closedAt) : todayBakuYmd();
  const from = stayStart > monthStart ? stayStart : monthStart;
  const to = stayEnd < monthEndExclusive ? stayEnd : monthEndExclusive;
  let nights = 0;
  let day = from;
  while (day < to) {
    nights += 1;
    day = addBakuDays(day, 1);
  }
  return nights;
}

export async function patientsByCountryReport(input: {
  organizationId: string;
  periodKey: string;
  origin: "IN_HOUSE" | "WALK_IN";
}): Promise<{ items: CountryReportRow[]; periodKey: string }> {
  const { from, to } = bakuMonthBounds(input.periodKey);
  const episodes = await prisma.clinicalEpisode.findMany({
    where: {
      organizationId: input.organizationId,
      patientOrigin: input.origin,
      openedAt: { lte: to },
      OR: [{ closedAt: null }, { closedAt: { gte: from } }],
      patientRefId: { not: null },
    },
    select: {
      patientRefId: true,
      openedAt: true,
      closedAt: true,
      patientRef: { select: { nationality: true } },
    },
  });

  const byPatient = new Map<
    string,
    { code: string; nights: number }
  >();
  for (const episode of episodes) {
    const patientId = episode.patientRefId;
    if (!patientId) continue;
    const nights =
      input.origin === "WALK_IN"
        ? 0
        : nightsInsideMonth(episode.openedAt, episode.closedAt, input.periodKey);
    const code = episode.patientRef?.nationality?.trim().toUpperCase() || "";
    const prev = byPatient.get(patientId);
    if (!prev) byPatient.set(patientId, { code, nights });
    else prev.nights += nights;
  }

  const patientIds = [...byPatient.keys()];
  const extras = patientIds.length
    ? await prisma.procedureOrder.findMany({
        where: {
          organizationId: input.organizationId,
          patientRefId: { in: patientIds },
          inPackage: false,
          status: { in: [...PAID_EXTRA_STATUSES] },
          scheduledAt: { gte: from, lte: to },
        },
        select: { patientRefId: true, amountNet: true },
      })
    : [];

  const spend = new Map<string, number>();
  for (const row of extras) {
    spend.set(row.patientRefId, (spend.get(row.patientRefId) ?? 0) + Number(row.amountNet));
  }

  const grouped = new Map<string, CountryReportRow>();
  for (const [patientId, info] of byPatient) {
    const row = grouped.get(info.code) ?? {
      code: info.code,
      guests: 0,
      nights: 0,
      extras: 0,
    };
    row.guests += 1;
    row.nights += info.nights;
    row.extras += spend.get(patientId) ?? 0;
    grouped.set(info.code, row);
  }

  const items = [...grouped.values()].sort((a, b) => b.guests - a.guests || a.code.localeCompare(b.code));
  return { items, periodKey: input.periodKey };
}
