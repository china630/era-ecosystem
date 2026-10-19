import { prisma } from "@/lib/prisma";
import { lookupHotelStayWindow } from "@/lib/hotel-stay-person";
import { addBakuDays, bakuDateKey, bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";
import { dayStartInstant, listClinicDays, notBeforeYmdFromStart, stayYmd } from "@/domain/planning/clinic-day";
import {
  bathPolicyFromSettings,
  defaultBathModeFromSettings,
  getSchedulingSettings,
} from "@/domain/settings/scheduling-settings";
import { procedureFitsGuestSex } from "@/domain/procedure/procedure-sex-gate";
import { releaseProcedureOccupancy } from "@/domain/procedure/procedure-allocation.service";
import { planBathSeries, parseBathDayModes, strayBathOrderIds, type KeptCell } from "@/domain/planning/bath-calendar";
import { syncEntitlementUsage } from "@/domain/sanatorium/entitlement-usage.service";

const LOCKED = new Set(["CHECKED_IN", "COMPLETED"]);

export async function getBathCalendar(episodeId: string) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: { programInstance: { select: { startsOn: true, endsOn: true } } },
  });
  let stayFrom = episode?.programInstance?.startsOn ?? null;
  let stayTo = episode?.programInstance?.endsOn ?? null;
  if (episode?.reservationId) {
    const hotel = await lookupHotelStayWindow(episode.reservationId);
    if (hotel) {
      stayFrom = new Date(hotel.checkInDate);
      stayTo = new Date(hotel.checkOutDate);
    }
  }
  if (!episode || !stayFrom || !stayTo || Number.isNaN(stayFrom.getTime()) || Number.isNaN(stayTo.getTime())) {
    return { days: [], series: [], modes: [], orders: [], restByCode: {} };
  }
  const { fromYmd, toYmd } = stayYmd(stayFrom, stayTo);
  const days = await listClinicDays(fromYmd, toYmd);
  const series = await prisma.procedureDaySeries.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: { members: { orderBy: { sortOrder: "asc" } } },
  });
  const codes = series.flatMap((row) => row.members.map((member) => member.procedureCode));
  const orders = codes.length
    ? await prisma.procedureOrder.findMany({
        where: {
          clinicalEpisodeId: episodeId,
          procedureCode: { in: codes },
          status: { in: ["SCHEDULED", "PROPOSED", "CHECKED_IN", "COMPLETED"] },
        },
        select: {
          id: true,
          procedureCode: true,
          status: true,
          scheduledAt: true,
          note: true,
          physioFields: true,
        },
        orderBy: { scheduledAt: "asc" },
      })
    : [];
  const settings = await getSchedulingSettings();
  const stubRests = codes.length
    ? await prisma.procedureOrder.findMany({
        where: {
          clinicalEpisodeId: episodeId,
          procedureCode: { in: codes },
          status: "CANCELLED",
          cancelReason: "bath_rest",
        },
        select: { procedureCode: true, scheduledAt: true },
      })
    : [];
  const restByCode: Record<string, string[]> = {};
  for (const code of codes) {
    const ymds = new Set<string>();
    for (const order of orders) {
      if (order.procedureCode !== code) continue;
      for (const ymd of restYmdsFromFields(order.physioFields)) ymds.add(ymd);
    }
    for (const stub of stubRests) {
      if (stub.procedureCode === code) ymds.add(bakuDateKey(stub.scheduledAt));
    }
    restByCode[code] = [...ymds].sort();
  }
  return {
    days,
    series,
    modes: parseBathDayModes(settings.bathDayModesJson),
    orders: orders.map((order) => ({
      ...order,
      ymd: bakuDateKey(order.scheduledAt),
    })),
    restByCode,
  };
}

async function seatPinnedOrders(
  pins: Record<string, string>,
  startAt?: Date | null,
): Promise<{
  placedIds: string[];
  failures: Array<{
    orderId: string;
    reason: string;
    ymd?: string;
    procedureCode: string;
    procedureName: string;
  }>;
}> {
  const ids = Object.keys(pins);
  if (ids.length === 0) return { placedIds: [], failures: [] };
  const { placeConfirmedProcedures } = await import("@/lib/treatment-planner.service");
  const ymds = Object.values(pins).sort();
  const first = ymds[0]!;
  const last = ymds[ymds.length - 1]!;
  const clock =
    startAt && !Number.isNaN(startAt.getTime())
      ? startAt
      : dayStartInstant(first, (await getSchedulingSettings()).dayStartHour);
  const result = await placeConfirmedProcedures(ids, {
    pinYmdByOrderId: pins,
    startAt: clock,
    scheduleBefore: bakuDayBounds(addBakuDays(last, 1)).start,
  });
  return { placedIds: result.placedIds, failures: result.failures };
}

/**
 * Drop bath days the calendar invented beside the package line.
 * The package day stays. The extra card disappears. The package remainder is unchanged.
 */
export async function foldBathQuotaCards(episodeId: string): Promise<void> {
  const [episode, orders] = await Promise.all([
    prisma.clinicalEpisode.findUnique({
      where: { id: episodeId },
      select: { programInstance: { select: { id: true } } },
    }),
    prisma.procedureOrder.findMany({
      where: {
        clinicalEpisodeId: episodeId,
        inPackage: true,
        status: { in: ["SCHEDULED", "PROPOSED", "CHECKED_IN", "COMPLETED"] },
      },
      select: { id: true, procedureCode: true, packageQuotaCode: true, status: true },
    }),
  ]);
  const strayIds = strayBathOrderIds(orders);
  if (strayIds.length === 0) return;
  await prisma.procedureAllocation.deleteMany({ where: { procedureOrderId: { in: strayIds } } });
  await prisma.resourceBooking.deleteMany({ where: { procedureOrderId: { in: strayIds } } });
  await prisma.procedureOrder.updateMany({
    where: { id: { in: strayIds } },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: "bath_not_in_package",
      resourceId: null,
    },
  });
  const instanceId = episode?.programInstance?.id;
  if (!instanceId) return;
  const quotas = new Set<string>();
  for (const order of orders) {
    if (!strayIds.includes(order.id)) continue;
    const sibling = orders.find(
      (row) =>
        row.procedureCode === order.procedureCode &&
        row.packageQuotaCode &&
        row.packageQuotaCode !== order.procedureCode,
    );
    if (sibling?.packageQuotaCode) quotas.add(sibling.packageQuotaCode);
  }
  for (const quotaCode of quotas) {
    await syncEntitlementUsage({ instanceId, episodeId, quotaCode });
  }
}

function storedMode(fields: unknown): string | null {
  if (!fields || typeof fields !== "object") return null;
  const block = (fields as { dayBlock?: unknown }).dayBlock;
  return block == null ? null : String(block);
}

function restYmdsFromFields(fields: unknown): string[] {
  if (!fields || typeof fields !== "object") return [];
  const raw = (fields as { restYmds?: unknown }).restYmds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is string => typeof row === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row));
}

export async function saveBathCalendar(input: {
  episodeId: string;
  procedureCode: string;
  mode: string;
  qty: number;
  manualRestYmds: string[];
  manualBathYmds: string[];
  bathSequence?: "SITZ_THEN_FULL" | null;
}) {
  await foldBathQuotaCards(input.episodeId);
  const snapshot = await getBathCalendar(input.episodeId);
  const series = snapshot.series.find((row) =>
    row.members.some((member) => member.procedureCode === input.procedureCode),
  );
  const member = series?.members.find((row) => row.procedureCode === input.procedureCode);
  if (!series || !member) {
    throw new Error("Procedure is not in a day series");
  }
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: input.episodeId },
    select: { patientRefId: true, patientOrigin: true, reservationId: true },
  });
  if (!episode?.patientRefId) throw new Error("Episode not found");
  const procedureType = await prisma.procedureType.findFirst({
    where: { code: input.procedureCode },
    select: { id: true, name: true, durationMin: true, bodyPart: true },
  });
  if (!procedureType) throw new Error("Unknown procedure");

  const own = snapshot.orders.filter((order) => order.procedureCode === input.procedureCode);
  const restOrders = await prisma.procedureOrder.findMany({
    where: {
      clinicalEpisodeId: input.episodeId,
      procedureCode: input.procedureCode,
      status: "CANCELLED",
      cancelReason: "bath_rest",
    },
    select: { id: true, scheduledAt: true },
  });
  const today = todayBakuYmd();
  const requestBaths = new Set(input.manualBathYmds.filter((ymd) => ymd >= today));
  const requestRests = new Set(input.manualRestYmds.filter((ymd) => ymd >= today));
  const pinYmds = new Set(
    own
      .filter((order) => order.note === "bath_manual" && !LOCKED.has(order.status) && order.ymd >= today)
      .map((order) => order.ymd),
  );
  for (const ymd of requestBaths) pinYmds.add(ymd);
  for (const ymd of requestRests) pinYmds.delete(ymd);
  const restYmds = new Set(restOrders.map((order) => bakuDateKey(order.scheduledAt)));
  for (const ymd of own.flatMap((order) => restYmdsFromFields(order.physioFields))) restYmds.add(ymd);
  for (const ymd of requestRests) restYmds.add(ymd);
  for (const ymd of requestBaths) restYmds.delete(ymd);
  const previousMode = own.map((order) => storedMode(order.physioFields)).find((mode) => mode);
  const layout = previousMode && previousMode !== input.mode ? "fresh" : "continue";
  const kept: KeptCell[] = [];
  for (const order of snapshot.orders) {
    if (order.procedureCode === input.procedureCode) continue;
    kept.push({ ymd: order.ymd, procedureCode: order.procedureCode, locked: true });
  }
  for (const order of own) {
    if (LOCKED.has(order.status) || order.ymd < today) {
      kept.push({ ymd: order.ymd, procedureCode: input.procedureCode, locked: true });
    }
  }
  for (const ymd of pinYmds) {
    kept.push({ ymd, procedureCode: input.procedureCode, locked: true });
  }
  if (layout === "continue") {
    for (const order of own) {
      if (LOCKED.has(order.status) || pinYmds.has(order.ymd) || restYmds.has(order.ymd)) continue;
      kept.push({ ymd: order.ymd, procedureCode: input.procedureCode, locked: true, anchor: true });
    }
  }
  for (const ymd of restYmds) {
    kept.push({ ymd, procedureCode: input.procedureCode, locked: false, manualRest: true });
  }
  const settings = await getSchedulingSettings();
  const planned = planBathSeries({
    days: snapshot.days,
    series: [
      {
        seriesCode: series.code,
        procedureCode: input.procedureCode,
        mark: member.shortMark,
        mode: input.mode,
        qty: Math.min(input.qty, own.length),
        fillsRestDays: series.fillsRestDays,
        sitzThenFull: input.bathSequence === "SITZ_THEN_FULL",
      },
    ],
    kept,
    layout,
    modes: snapshot.modes,
    notBeforeYmd: today,
    policy: bathPolicyFromSettings(settings),
  }).filter((cell) => cell.procedureCode === input.procedureCode);

  const movable = own.filter((order) => !LOCKED.has(order.status) && order.ymd >= today);
  const used = new Set<string>();
  const pins: Record<string, string> = {};
  let unplaced = 0;
  const unplacedDays: string[] = [];
  for (const cell of planned) {
    const lockedOrder = own.find(
      (order) =>
        order.ymd === cell.ymd && (LOCKED.has(order.status) || order.ymd < today),
    );
    if (lockedOrder) {
      used.add(lockedOrder.id);
      continue;
    }
    const existing = movable.find((order) => order.ymd === cell.ymd && !used.has(order.id))
      ?? movable.find((order) => !used.has(order.id));
    if (!existing) {
      unplaced += 1;
      unplacedDays.push(cell.ymd);
      continue;
    }
    used.add(existing.id);
    await releaseProcedureOccupancy([existing.id]);
    await prisma.procedureOrder.update({
      where: { id: existing.id },
      data: {
        status: "PROPOSED",
        scheduledAt: dayStartInstant(cell.ymd, settings.dayStartHour),
        note: cell.manual ? "bath_manual" : null,
        physioFields: {
          dayBlock: input.mode,
          bathSequence: input.bathSequence ?? null,
          naftalanFill: cell.fill ?? null,
          restYmds: [...restYmds].sort(),
        },
      },
    });
    pins[existing.id] = cell.ymd;
  }
  const seated = await seatPinnedOrders(pins);
  for (const [orderId, ymd] of Object.entries(pins)) {
    if (seated.placedIds.includes(orderId)) continue;
    unplaced += 1;
    unplacedDays.push(ymd);
  }
  const drop = movable.filter((order) => !used.has(order.id));
  const restDrop = drop.filter((order) => restYmds.has(order.ymd));
  const otherDrop = drop.filter((order) => !restYmds.has(order.ymd));
  if (restDrop.length > 0) {
    await prisma.procedureOrder.updateMany({
      where: { id: { in: restDrop.map((order) => order.id) } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "bath_calendar" },
    });
    await releaseProcedureOccupancy(restDrop.map((order) => order.id));
  }
  if (otherDrop.length > 0) {
    await prisma.procedureOrder.updateMany({
      where: { id: { in: otherDrop.map((order) => order.id) } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "bath_calendar" },
    });
    await releaseProcedureOccupancy(otherDrop.map((order) => order.id));
  }
  const leftoverRestIds = restOrders.map((order) => order.id);
  if (leftoverRestIds.length > 0) {
    await prisma.procedureOrder.deleteMany({ where: { id: { in: leftoverRestIds } } });
  }
  const liveAfter = await prisma.procedureOrder.findMany({
    where: {
      clinicalEpisodeId: input.episodeId,
      procedureCode: input.procedureCode,
      status: { in: ["SCHEDULED", "PROPOSED", "CHECKED_IN", "COMPLETED"] },
    },
    select: { id: true, physioFields: true },
  });
  for (const row of liveAfter) {
    const prev = row.physioFields && typeof row.physioFields === "object" ? row.physioFields : {};
    await prisma.procedureOrder.update({
      where: { id: row.id },
      data: {
        physioFields: {
          ...(prev as Record<string, unknown>),
          restYmds: [...restYmds].sort(),
        },
      },
    });
  }
  return {
    planned: planned.length,
    seated: planned.length - unplaced,
    unplaced,
    unplacedDays,
    cancelled: otherDrop.length,
  };
}

/** Active day-series member codes (naftalan / vanna). Saxla seats these per modal line. */
export async function bathSeriesProcedureCodes(): Promise<Set<string>> {
  const series = await prisma.procedureDaySeries.findMany({
    where: { active: true },
    select: { members: { select: { procedureCode: true } } },
  });
  return new Set(series.flatMap((row) => row.members.map((member) => member.procedureCode)));
}

export type BathSeatMiss = {
  ymd: string;
  procedureCode: string;
  procedureName?: string;
  reason: "no_cabin" | "cabin_sex" | "no_staff" | "no_day" | "no_mode" | "day_full";
};

function bathModeOf(fields: unknown): string | null {
  const block =
    fields && typeof fields === "object" ? (fields as { dayBlock?: unknown }).dayBlock : null;
  const code = typeof block === "string" ? block.trim().toUpperCase() : "";
  if (!/^[0-9A-Z_]{1,16}$/.test(code)) return null;
  return code;
}

/**
 * Seat package bath orders on stay days from the day series.
 * Days start from Saxla `startAt` (same door as physio). The week rhythm
 * still lays baths then rest. Minutes use the shared placer.
 */
export async function seatBathSeriesOrders(
  orderIds: string[],
  opts?: { startAt?: Date | null },
): Promise<{
  handledIds: string[];
  placedIds: string[];
  missed: BathSeatMiss[];
}> {
  if (orderIds.length === 0) return { handledIds: [], placedIds: [], missed: [] };
  const orders = await prisma.procedureOrder.findMany({
    where: { id: { in: orderIds }, status: "PROPOSED" },
  });
  const series = await prisma.procedureDaySeries.findMany({
    where: { active: true },
    include: { members: true },
  });
  const memberByCode = new Map<
    string,
    { seriesCode: string; mark: string; fillsRestDays: boolean }
  >();
  for (const row of series) {
    for (const member of row.members) {
      memberByCode.set(member.procedureCode, {
        seriesCode: row.code,
        mark: member.shortMark,
        fillsRestDays: row.fillsRestDays,
      });
    }
  }
  const handled = orders.filter((order) => memberByCode.has(order.procedureCode) && order.clinicalEpisodeId);
  if (handled.length === 0) return { handledIds: [], placedIds: [], missed: [] };

  const snapshot = await getBathCalendar(handled[0]!.clinicalEpisodeId!);
  const settings = await getSchedulingSettings();
  const defaultMode = defaultBathModeFromSettings(settings);
  const policy = bathPolicyFromSettings(settings);
  const placedIds: string[] = [];
  const missed: BathSeatMiss[] = [];
  const guest = await prisma.patientRef.findUnique({
    where: { id: handled[0]!.patientRefId },
    select: { sex: true },
  });
  const guestSex = guest?.sex ?? null;
  const byCode = new Map<string, typeof handled>();
  for (const order of handled) {
    const list = byCode.get(order.procedureCode) ?? [];
    list.push(order);
    byCode.set(order.procedureCode, list);
  }

  const today = todayBakuYmd();
  const notBeforeYmd = notBeforeYmdFromStart(opts?.startAt, today);
  const upcoming = snapshot.days.filter((day) => day.ymd >= notBeforeYmd);
  const kept: KeptCell[] = snapshot.orders
    .filter((order) => memberByCode.has(order.procedureCode))
    .map((order) => ({
      ymd: order.ymd,
      procedureCode: order.procedureCode,
      locked: true,
    }));
  const seriesInputs = [...byCode.entries()].map(([procedureCode, group]) => {
    const meta = memberByCode.get(procedureCode)!;
    const already = snapshot.orders.filter((order) => order.procedureCode === procedureCode);
    return {
      seriesCode: meta.seriesCode,
      procedureCode,
      mark: meta.mark,
      mode: bathModeOf(group[0]?.physioFields) ?? defaultMode,
      qty: already.length + group.length,
      fillsRestDays: meta.fillsRestDays,
    };
  });
  const planned =
    upcoming.length === 0
      ? []
      : planBathSeries({
          days: upcoming,
          series: seriesInputs,
          kept,
          layout: "continue",
          modes: snapshot.modes,
          notBeforeYmd,
          policy,
        }).filter(
          (cell) =>
            cell.ymd >= notBeforeYmd &&
            !snapshot.orders.some(
              (order) => order.procedureCode === cell.procedureCode && order.ymd === cell.ymd,
            ),
        );
  const queues = new Map<string, typeof handled>();
  for (const [procedureCode, group] of byCode) {
    queues.set(procedureCode, [...group]);
  }
  const pins: Record<string, string> = {};
  for (const cell of planned) {
    const queue = queues.get(cell.procedureCode);
    const order = queue?.[0];
    if (!queue || !order?.procedureTypeId) continue;
    if (!(await procedureFitsGuestSex(cell.procedureCode, guestSex))) {
      missed.push({
        ymd: cell.ymd,
        procedureCode: cell.procedureCode,
        procedureName: order.procedureName,
        reason: "cabin_sex",
      });
      continue;
    }
    queue.shift();
    const prevFields =
      order.physioFields && typeof order.physioFields === "object" && !Array.isArray(order.physioFields)
        ? (order.physioFields as Record<string, unknown>)
        : {};
    await prisma.procedureOrder.update({
      where: { id: order.id },
      data: {
        scheduledAt: dayStartInstant(cell.ymd, settings.dayStartHour),
        physioFields: {
          ...prevFields,
          dayBlock:
            seriesInputs.find((row) => row.procedureCode === cell.procedureCode)?.mode ?? defaultMode,
        },
      },
    });
    pins[order.id] = cell.ymd;
  }
  const seated = await seatPinnedOrders(pins, opts?.startAt);
  placedIds.push(...seated.placedIds);
  for (const fail of seated.failures) {
    const mapped =
      fail.reason === "cabin_sex" ||
      fail.reason === "no_staff" ||
      fail.reason === "no_cabin" ||
      fail.reason === "day_full"
        ? fail.reason
        : "no_cabin";
    missed.push({
      ymd: fail.ymd ?? pins[fail.orderId] ?? "",
      procedureCode: fail.procedureCode,
      procedureName: fail.procedureName,
      reason: mapped,
    });
  }
  const leftoverYmd =
    upcoming.filter((day) => day.working).at(-1)?.ymd ?? notBeforeYmd;
  for (const group of queues.values()) {
    for (const order of group) {
      missed.push({
        ymd: leftoverYmd,
        procedureCode: order.procedureCode,
        procedureName: order.procedureName,
        reason: "no_day",
      });
    }
  }

  return { handledIds: handled.map((order) => order.id), placedIds, missed };
}
