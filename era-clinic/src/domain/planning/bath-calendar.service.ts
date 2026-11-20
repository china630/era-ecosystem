import { prisma } from "@/lib/prisma";
import { lookupHotelStayWindow } from "@/lib/hotel-stay-person";
import { addBakuDays, bakuDateKey, bakuDayBounds, parseBakuDateTime, todayBakuYmd } from "@/lib/baku-day";
import {
  dayStartInstant,
  listClinicDays,
  nextWorkingYmd,
  notBeforeYmdFromStart,
  saxlaFirstClock,
  stayYmd,
} from "@/domain/planning/clinic-day";
import {
  bathPolicyFromSettings,
  defaultBathModeFromSettings,
  getSchedulingSettings,
} from "@/domain/settings/scheduling-settings";
import { procedureFitsGuestSex } from "@/domain/procedure/procedure-sex-gate";
import { releaseProcedureOccupancy } from "@/domain/procedure/procedure-allocation.service";
import {
  clampWeeklyNaftalanCap,
  illegalHardSeriesBathYmds,
  nextLegalSeriesDay,
  planBathSeries,
  parseBathDayModes,
  resolveDefaultBathMode,
  saxlaDayTaken,
  saxlaSameSkuKept,
  saxlaSeatKept,
  strayBathOrderIds,
  type KeptCell,
  type StayDay,
} from "@/domain/planning/bath-calendar";
import { syncEntitlementUsage } from "@/domain/sanatorium/entitlement-usage.service";
import type { CabinScanBag } from "@/lib/treatment-planner.service";
import { PLACE_CONFIRMED_BUDGET_MS } from "@/lib/procedure-slot-scan";

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
    return { days: [], series: [], modes: [], orders: [], restByCode: {}, stayEndsOn: null as Date | null };
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
    stayEndsOn: stayTo,
  };
}

type SeatPinnedOpts = {
  startAt?: Date | null;
  /** Exclusive stay end (checkout). Caps occupancy and legal-day search. */
  scheduleBefore?: Date | null;
  cabinBag?: CabinScanBag;
  clinicDays?: StayDay[];
  modes?: ReturnType<typeof parseBathDayModes>;
  /** orderId → series seating policy */
  seriesByOrderId?: Map<
    string,
    {
      mode: string;
      fillsRestDays: boolean;
      weeklyCap: number;
      afternoonPinRetry: boolean;
      seriesCode: string;
      procedureCode: string;
    }
  >;
};

async function seatPinnedOrders(
  pins: Record<string, string>,
  opts?: SeatPinnedOpts | Date | null,
): Promise<{
  placedIds: string[];
  failures: Array<{
    orderId: string;
    reason: string;
    ymd?: string;
    procedureCode: string;
    procedureName: string;
    searchFrom?: string;
    counts?: BathSeatMiss["counts"];
    hitAttemptCap?: boolean;
  }>;
  /** Pin-day refusals kept even after a later day accepts the order. */
  seatMisses: BathSeatMiss[];
}> {
  const seatOpts: SeatPinnedOpts =
    opts && typeof opts === "object" && !(opts instanceof Date)
      ? opts
      : { startAt: (opts as Date | null | undefined) ?? null };
  const ids = Object.keys(pins);
  if (ids.length === 0) return { placedIds: [], failures: [], seatMisses: [] };
  const { placeConfirmedProcedures } = await import("@/lib/treatment-planner.service");
  const settings = await getSchedulingSettings();
  const policy = bathPolicyFromSettings(settings);
  const modes = seatOpts.modes ?? parseBathDayModes(settings.bathDayModesJson);
  const ymds = Object.values(pins).sort();
  const first = ymds[0]!;
  const last = ymds[ymds.length - 1]!;
  const stayEndYmd = seatOpts.scheduleBefore
    ? bakuDateKey(seatOpts.scheduleBefore)
    : null;
  const dayHour = settings.dayStartHour;
  const clock = saxlaFirstClock(seatOpts.startAt, first, dayHour);
  const clinicDays =
    seatOpts.clinicDays ??
    (await listClinicDays(first, stayEndYmd ?? addBakuDays(last, 14)));
  const placedIds: string[] = [];
  const placed = new Set<string>();
  const pinMap = { ...pins };
  const movedTo: Record<string, string> = {};
  type PinFail = {
    orderId: string;
    reason: string;
    ymd?: string;
    procedureCode: string;
    procedureName: string;
    searchFrom?: string;
    hitAttemptCap?: boolean;
    counts?: BathSeatMiss["counts"];
  };
  let failures: PinFail[] = [];
  const mergePlace = (pass: { placedIds: string[]; failures: PinFail[] }) => {
    for (const id of pass.placedIds) {
      placed.add(id);
      placedIds.push(id);
    }
    failures = pass.failures.filter((row) => !placed.has(row.orderId));
  };

  const scheduleBeforeForPins = (pinRecord: Record<string, string>) => {
    const pinYmds = Object.values(pinRecord).sort();
    const pinLast = pinYmds[pinYmds.length - 1] ?? first;
    const end = stayEndYmd && stayEndYmd <= addBakuDays(pinLast, 2) ? stayEndYmd : addBakuDays(pinLast, 2);
    return bakuDayBounds(end).start;
  };

  const pinDeadlineMs = () =>
    seatOpts.cabinBag?.deadlineMs ?? Date.now() + PLACE_CONFIRMED_BUDGET_MS;

  const tryAfternoon = async (pinRecord: Record<string, string>): Promise<boolean> => {
    const afternoonPins: Record<string, string> = {};
    for (const fail of failures) {
      const meta = seatOpts.seriesByOrderId?.get(fail.orderId);
      if (meta && meta.afternoonPinRetry === false) continue;
      const ymd = pinRecord[fail.orderId];
      if (ymd) afternoonPins[fail.orderId] = ymd;
    }
    const afternoonIds = Object.keys(afternoonPins);
    if (afternoonIds.length === 0) return false;
    const afternoonYmd = Object.values(afternoonPins).sort()[0]!;
    const afternoonClock = parseBakuDateTime(
      afternoonYmd,
      `${String(settings.lunchEndHour).padStart(2, "0")}:00`,
    );
    mergePlace(
      await placeConfirmedProcedures(afternoonIds, {
        pinYmdByOrderId: afternoonPins,
        startAt: afternoonClock,
        pinStrict: true,
        scheduleBefore: scheduleBeforeForPins(afternoonPins),
        cabinBag: seatOpts.cabinBag,
        deadlineMs: pinDeadlineMs(),
      }),
    );
    return failures.length === 0;
  };

  mergePlace(
    await placeConfirmedProcedures(ids, {
      pinYmdByOrderId: pinMap,
      startAt: clock,
      pinStrict: true,
      scheduleBefore: scheduleBeforeForPins(pinMap),
      cabinBag: seatOpts.cabinBag,
      deadlineMs: pinDeadlineMs(),
    }),
  );
  const seatMisses: BathSeatMiss[] = failures.map((fail) => ({
    orderId: fail.orderId,
    ymd: pinMap[fail.orderId] ?? fail.ymd ?? "",
    procedureCode: fail.procedureCode,
    procedureName: fail.procedureName,
    reason: fail.reason,
    searchFrom: fail.searchFrom,
    counts: fail.counts,
    ...(fail.hitAttemptCap ? { hitAttemptCap: true } : {}),
  }));
  if (failures.length === 0) return { placedIds, failures: [], seatMisses };
  if (await tryAfternoon(pinMap)) {
    await persistSeatMisses(seatMisses);
    return { placedIds, failures: [], seatMisses };
  }

  // Fact-based replan: legal day (skip rest/cap), then re-lay unplaced pins of that code from the new anchor.
  const { updateProcedureOrderIfPresent } = await import(
    "@/domain/procedure/procedure-order-if-present"
  );
  const failIds = new Set(failures.map((row) => row.orderId));
  const byCode = new Map<string, string[]>();
  for (const id of Object.keys(pinMap)) {
    const code =
      seatOpts.seriesByOrderId?.get(id)?.procedureCode ??
      failures.find((row) => row.orderId === id)?.procedureCode;
    if (!code) continue;
    const list = byCode.get(code) ?? [];
    list.push(id);
    byCode.set(code, list);
  }

  for (const [procedureCode, orderIds] of byCode) {
    const failedHere = orderIds.filter((id) => failIds.has(id)).sort((a, b) =>
      (pinMap[a] ?? "").localeCompare(pinMap[b] ?? ""),
    );
    if (failedHere.length === 0) continue;
    const placedHere = orderIds.filter((id) => placed.has(id));
    const placedYmds = placedHere.map((id) => pinMap[id]!).filter(Boolean).sort();
    const meta =
      seatOpts.seriesByOrderId?.get(failedHere[0]!) ??
      ({
        mode: defaultBathModeFromSettings(settings),
        fillsRestDays: false,
        weeklyCap: clampWeeklyNaftalanCap(settings.weeklyNaftalanCap),
        afternoonPinRetry: true,
        seriesCode: procedureCode,
        procedureCode,
      } as const);

    const usedYmds = new Set(
      Object.entries(pinMap)
        .filter(([id]) => placed.has(id) || !failIds.has(id))
        .map(([, ymd]) => ymd),
    );
    for (const id of placedHere) usedYmds.add(pinMap[id]!);

    const firstFail = failedHere[0]!;
    const fromYmd = addBakuDays(pinMap[firstFail] ?? first, 1);
    const anchorYmd = placedYmds[0] ?? null;
    const weekBathYmds = [...usedYmds];
    const next = nextLegalSeriesDay({
      days: clinicDays,
      fromYmd,
      mode: meta.mode,
      modes,
      policy,
      anchorYmd,
      usedYmds,
      weeklyCap: meta.weeklyCap,
      weekBathYmds,
      fillsRestDays: meta.fillsRestDays,
      stayEndYmd,
    });
    if (!next) continue;

    // Replan remaining failed qty from fact: kept = already seated; continue layout.
    const remainingIds = failedHere;
    const plannedTail = planBathSeries({
      days: clinicDays,
      series: [
        {
          seriesCode: meta.seriesCode,
          procedureCode,
          mark: "·",
          mode: meta.mode,
          qty: placedHere.length + remainingIds.length,
          fillsRestDays: meta.fillsRestDays,
          weeklyCap: meta.weeklyCap,
        },
      ],
      kept: placedYmds.map((ymd) => ({
        ymd,
        procedureCode,
        locked: true,
      })),
      layout: "continue",
      modes,
      notBeforeYmd: next,
      policy: { ...policy, weeklyNaftalanCap: meta.weeklyCap },
    }).filter((cell) => {
      if (placedYmds.includes(cell.ymd)) return false;
      if (meta.fillsRestDays) return true;
      const illegal = illegalHardSeriesBathYmds({
        bathYmds: [...placedYmds, cell.ymd],
        days: clinicDays,
        mode: meta.mode,
        modes,
        policy,
        fillsRestDays: false,
      });
      return !illegal.includes(cell.ymd);
    });

    const shiftPins: Record<string, string> = {};
    for (let i = 0; i < remainingIds.length; i++) {
      const orderId = remainingIds[i]!;
      const ymd = plannedTail[i]?.ymd;
      if (!ymd) continue;
      const moved = await updateProcedureOrderIfPresent(
        orderId,
        { scheduledAt: dayStartInstant(ymd, dayHour) },
        "bath-shift-day",
      );
      if (!moved) continue;
      shiftPins[orderId] = ymd;
      pinMap[orderId] = ymd;
      movedTo[orderId] = ymd;
      usedYmds.add(ymd);
    }
    const shiftIds = Object.keys(shiftPins);
    if (shiftIds.length === 0) continue;
    const shiftFirst = Object.values(shiftPins).sort()[0]!;
    mergePlace(
      await placeConfirmedProcedures(shiftIds, {
        pinYmdByOrderId: shiftPins,
        startAt: dayStartInstant(shiftFirst, dayHour),
        pinStrict: true,
        scheduleBefore: scheduleBeforeForPins(shiftPins),
        cabinBag: seatOpts.cabinBag,
        deadlineMs: pinDeadlineMs(),
      }),
    );
    if (failures.length > 0) await tryAfternoon(shiftPins);
  }

  failures = failures.filter((row) => !placed.has(row.orderId));
  for (const miss of seatMisses) {
    if (!miss.orderId) continue;
    const landing = movedTo[miss.orderId];
    if (landing && placed.has(miss.orderId) && landing !== miss.ymd) miss.movedTo = landing;
  }
  await persistSeatMisses(seatMisses);

  return { placedIds, failures, seatMisses };
}

async function persistSeatMisses(misses: BathSeatMiss[]): Promise<void> {
  for (const miss of misses) {
    const orderId = miss.orderId;
    if (!orderId) continue;
    const order = await prisma.procedureOrder.findUnique({
      where: { id: orderId },
      select: { physioFields: true },
    });
    if (!order) {
      console.warn("procedure-order-missing", { step: "persistSeatMisses", orderId });
      continue;
    }
    const prev =
      order.physioFields && typeof order.physioFields === "object" && !Array.isArray(order.physioFields)
        ? (order.physioFields as Record<string, unknown>)
        : {};
    const { updateProcedureOrderIfPresent } = await import(
      "@/domain/procedure/procedure-order-if-present"
    );
    await updateProcedureOrderIfPresent(
      orderId,
      { physioFields: { ...prev, seatMiss: miss } },
      "persistSeatMisses",
    );
  }
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
  const weeklyCap =
    series.weeklyCap === null || series.weeklyCap === undefined
      ? null
      : clampWeeklyNaftalanCap(series.weeklyCap);
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
        weeklyCap,
        sitzThenFull: input.bathSequence === "SITZ_THEN_FULL",
      },
    ],
    kept,
    layout,
    modes: snapshot.modes,
    notBeforeYmd: today,
    policy: bathPolicyFromSettings(settings),
  }).filter((cell) => {
    if (cell.procedureCode !== input.procedureCode) return false;
    if (series.fillsRestDays || cell.locked) return true;
    const lockedYmds = kept
      .filter((row) => row.procedureCode === input.procedureCode && row.locked && !row.manualRest)
      .map((row) => row.ymd);
    const illegal = illegalHardSeriesBathYmds({
      bathYmds: [...lockedYmds, cell.ymd],
      days: snapshot.days,
      mode: input.mode,
      modes: snapshot.modes,
      policy: bathPolicyFromSettings(settings),
      fillsRestDays: false,
    });
    return !illegal.includes(cell.ymd);
  });

  const movable = own.filter((order) => !LOCKED.has(order.status) && order.ymd >= today);
  const used = new Set<string>();
  const pins: Record<string, string> = {};
  const seriesByOrderId = new Map<
    string,
    {
      mode: string;
      fillsRestDays: boolean;
      weeklyCap: number;
      afternoonPinRetry: boolean;
      seriesCode: string;
      procedureCode: string;
    }
  >();
  const pinWeeklyCap =
    weeklyCap === null ? clampWeeklyNaftalanCap(settings.weeklyNaftalanCap) : weeklyCap;
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
    seriesByOrderId.set(existing.id, {
      mode: input.mode,
      fillsRestDays: series.fillsRestDays,
      weeklyCap: pinWeeklyCap,
      afternoonPinRetry: series.afternoonPinRetry !== false,
      seriesCode: series.code,
      procedureCode: input.procedureCode,
    });
  }
  const seated = await seatPinnedOrders(pins, {
    scheduleBefore: snapshot.stayEndsOn,
    clinicDays: snapshot.days,
    modes: snapshot.modes,
    seriesByOrderId,
  });
  const missedPins: string[] = [];
  for (const [orderId, ymd] of Object.entries(pins)) {
    if (seated.placedIds.includes(orderId)) continue;
    missedPins.push(orderId);
    unplaced += 1;
    unplacedDays.push(ymd);
  }
  const { dropUnseatedInPackageOrders } = await import(
    "@/domain/sanatorium/package-assign.service"
  );
  await dropUnseatedInPackageOrders(missedPins);
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

/** Active day-series member codes. Saxla seats these in one joint calendar pass. */
export async function daySeriesProcedureCodes(): Promise<Set<string>> {
  const series = await prisma.procedureDaySeries.findMany({
    where: { active: true },
    select: { members: { select: { procedureCode: true } } },
  });
  return new Set(series.flatMap((row) => row.members.map((member) => member.procedureCode)));
}

/** @deprecated Use daySeriesProcedureCodes */
export const bathSeriesProcedureCodes = daySeriesProcedureCodes;

export type BathSeatMiss = {
  orderId?: string;
  ymd: string;
  procedureCode: string;
  procedureName?: string;
  reason: string;
  searchFrom?: string;
  hitAttemptCap?: boolean;
  counts?: {
    day_full: number;
    same_day: number;
    no_staff: number;
    closed: number;
    cabin_busy: number;
    staff_busy: number;
    rule: number;
  };
  /** Set when a rejected pin day was seated on another day. */
  movedTo?: string;
};

function bathModeOf(fields: unknown): string | null {
  const block =
    fields && typeof fields === "object" ? (fields as { dayBlock?: unknown }).dayBlock : null;
  const code = typeof block === "string" ? block.trim().toUpperCase() : "";
  if (!/^[0-9A-Z_]{1,16}$/.test(code)) return null;
  return code;
}

export type SeatDaySeriesOpts = {
  startAt?: Date | null;
  scheduleBefore?: Date | null;
  cabinBag?: CabinScanBag;
};

/**
 * Seat package day-series orders jointly: one calendar for all series SKUs,
 * then cabin pins. PROPOSED rows in this batch do not occupy days / continue streak.
 */
export async function seatDaySeriesOrders(
  orderIds: string[],
  opts?: SeatDaySeriesOpts,
): Promise<{
  handledIds: string[];
  placedIds: string[];
  missed: BathSeatMiss[];
  seatMisses: BathSeatMiss[];
}> {
  if (orderIds.length === 0) return { handledIds: [], placedIds: [], missed: [], seatMisses: [] };
  const orders = await prisma.procedureOrder.findMany({
    where: { id: { in: orderIds }, status: "PROPOSED" },
  });
  const series = await prisma.procedureDaySeries.findMany({
    where: { active: true },
    include: { members: true },
  });
  const memberByCode = new Map<
    string,
    {
      seriesCode: string;
      mark: string;
      fillsRestDays: boolean;
      modeCode: string | null;
      weeklyCap: number | null;
      afternoonPinRetry: boolean;
    }
  >();
  for (const row of series) {
    for (const member of row.members) {
      memberByCode.set(member.procedureCode, {
        seriesCode: row.code,
        mark: member.shortMark,
        fillsRestDays: row.fillsRestDays,
        modeCode: row.modeCode ?? null,
        weeklyCap: row.weeklyCap ?? null,
        afternoonPinRetry: row.afternoonPinRetry !== false,
      });
    }
  }
  const handled = orders.filter((order) => memberByCode.has(order.procedureCode) && order.clinicalEpisodeId);
  if (handled.length === 0) return { handledIds: [], placedIds: [], missed: [], seatMisses: [] };

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
  const startFloor = notBeforeYmdFromStart(opts?.startAt, today);
  const notBeforeYmd = nextWorkingYmd(snapshot.days, startFloor) ?? startFloor;
  const seatingIds = new Set(handled.map((order) => order.id));
  const seatingCodes = new Set(byCode.keys());
  /** Other-series occupy dates; same-SKU live rows are locked kept (count in qty + streak). */
  const kept: KeptCell[] = [
    ...saxlaSeatKept(snapshot.orders, seatingIds, seatingCodes),
    ...saxlaSameSkuKept(snapshot.orders, seatingIds, seatingCodes),
  ];
  for (const order of snapshot.orders) {
    if (seatingIds.has(order.id) || !seatingCodes.has(order.procedureCode)) continue;
    for (const ymd of restYmdsFromFields(order.physioFields)) {
      kept.push({ ymd, procedureCode: order.procedureCode, locked: false, manualRest: true });
    }
  }
  const sameSkuKeptCount = (procedureCode: string) =>
    kept.filter((cell) => cell.procedureCode === procedureCode && cell.locked && !cell.manualRest)
      .length;
  const resolveMode = (procedureCode: string, fields: unknown) => {
    const meta = memberByCode.get(procedureCode)!;
    return (
      bathModeOf(fields) ??
      (meta.modeCode ? resolveDefaultBathMode(meta.modeCode, snapshot.modes) : null) ??
      defaultMode
    );
  };
  const seriesInputs = [...byCode.entries()].map(([procedureCode, group]) => {
    const meta = memberByCode.get(procedureCode)!;
    const sampleFields =
      group[0]?.physioFields ??
      snapshot.orders.find((row) => row.procedureCode === procedureCode)?.physioFields;
    return {
      seriesCode: meta.seriesCode,
      procedureCode,
      mark: meta.mark,
      qty: sameSkuKeptCount(procedureCode) + group.length,
      mode: resolveMode(procedureCode, sampleFields),
      fillsRestDays: meta.fillsRestDays,
      weeklyCap: meta.weeklyCap,
    };
  });
  /**
   * continue + same-SKU kept: new qty only after the last kept bath (no hole-fill).
   * qty includes kept so mode rest/streak continues from the seated block.
   */
  const plannedRaw =
    snapshot.days.length === 0
      ? []
      : planBathSeries({
          days: snapshot.days,
          series: seriesInputs,
          kept,
          layout: "continue",
          modes: snapshot.modes,
          notBeforeYmd,
          policy,
        });
  /** New pins only — locked kept stay on their orders. Drop mode-illegal days. */
  const planned = plannedRaw.filter((cell) => {
    if (cell.locked || cell.ymd < notBeforeYmd) return false;
    if (saxlaDayTaken(snapshot.orders, seatingIds, cell.procedureCode, cell.ymd)) return false;
    const meta = memberByCode.get(cell.procedureCode);
    if (!meta || meta.fillsRestDays) return true;
    const mode =
      seriesInputs.find((row) => row.procedureCode === cell.procedureCode)?.mode ?? defaultMode;
    const existing = kept
      .filter((row) => row.procedureCode === cell.procedureCode && row.locked && !row.manualRest)
      .map((row) => row.ymd);
    const illegal = new Set(
      illegalHardSeriesBathYmds({
        bathYmds: [...existing, cell.ymd],
        days: snapshot.days,
        mode,
        modes: snapshot.modes,
        policy,
        fillsRestDays: false,
      }),
    );
    return !illegal.has(cell.ymd);
  });
  const queues = new Map<string, typeof handled>();
  for (const [procedureCode, group] of byCode) {
    queues.set(procedureCode, [...group]);
  }
  const pins: Record<string, string> = {};
  const seriesByOrderId = new Map<
    string,
    {
      mode: string;
      fillsRestDays: boolean;
      weeklyCap: number;
      afternoonPinRetry: boolean;
      seriesCode: string;
      procedureCode: string;
    }
  >();
  let firstNew = true;
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
    const meta = memberByCode.get(cell.procedureCode)!;
    const mode =
      seriesInputs.find((row) => row.procedureCode === cell.procedureCode)?.mode ?? defaultMode;
    const weeklyCap =
      meta.weeklyCap === null || meta.weeklyCap === undefined
        ? clampWeeklyNaftalanCap(settings.weeklyNaftalanCap)
        : clampWeeklyNaftalanCap(meta.weeklyCap);
    const prevFields =
      order.physioFields && typeof order.physioFields === "object" && !Array.isArray(order.physioFields)
        ? (order.physioFields as Record<string, unknown>)
        : {};
    await prisma.procedureOrder.update({
      where: { id: order.id },
      data: {
        scheduledAt: firstNew
          ? saxlaFirstClock(opts?.startAt, cell.ymd, settings.dayStartHour)
          : dayStartInstant(cell.ymd, settings.dayStartHour),
        physioFields: {
          ...prevFields,
          dayBlock: mode,
        },
      },
    });
    pins[order.id] = cell.ymd;
    seriesByOrderId.set(order.id, {
      mode,
      fillsRestDays: meta.fillsRestDays,
      weeklyCap,
      afternoonPinRetry: meta.afternoonPinRetry,
      seriesCode: meta.seriesCode,
      procedureCode: cell.procedureCode,
    });
    firstNew = false;
  }
  const seated = await seatPinnedOrders(pins, {
    startAt: opts?.startAt,
    scheduleBefore: opts?.scheduleBefore ?? snapshot.stayEndsOn,
    cabinBag: opts?.cabinBag,
    clinicDays: snapshot.days,
    modes: snapshot.modes,
    seriesByOrderId,
  });
  placedIds.push(...seated.placedIds);
  for (const fail of seated.failures) {
    missed.push({
      orderId: fail.orderId,
      ymd: fail.ymd ?? pins[fail.orderId] ?? "",
      procedureCode: fail.procedureCode,
      procedureName: fail.procedureName,
      reason: fail.reason,
      searchFrom: fail.searchFrom,
      counts: fail.counts,
      ...(fail.hitAttemptCap ? { hitAttemptCap: true } : {}),
    });
  }
  const seatMisses = seated.seatMisses;
  const lastCellYmd = planned.map((cell) => cell.ymd).sort().at(-1);
  const leftoverYmd = lastCellYmd
    ? nextWorkingYmd(snapshot.days, addBakuDays(lastCellYmd, 1)) ?? lastCellYmd
    : notBeforeYmd;
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

  return { handledIds: handled.map((order) => order.id), placedIds, missed, seatMisses };
}

/** @deprecated Use seatDaySeriesOrders */
export const seatBathSeriesOrders = seatDaySeriesOrders;
