import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { lookupHotelStayWindow } from "@/lib/hotel-stay-person";
import { bakuDateKey, bakuHourMinute, todayBakuYmd } from "@/lib/baku-day";
import { dayStartInstant, listClinicDays, stayYmd } from "@/domain/planning/clinic-day";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { allocationOccupiesCandidate } from "@/domain/procedure/resource-occupancy";
import { cabinMatchesGuest } from "@/domain/procedure/resource-sex";
import {
  findSkilledFreePractitioner,
  listPhysicalRequirementResources,
  releaseProcedureOccupancy,
  replaceProcedureAllocations,
  resolveStaffModeForProcedureType,
} from "@/domain/procedure/procedure-allocation.service";
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
    return { days: [], series: [], modes: [], orders: [] };
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
  return {
    days,
    series,
    modes: parseBathDayModes(settings.bathDayModesJson),
    orders: orders.map((order) => ({
      ...order,
      ymd: bakuDateKey(order.scheduledAt),
    })),
  };
}

type CabinSlot = {
  start: Date;
  end: Date;
  resourceId: string;
  role: "LOCATION" | "EQUIPMENT";
};

/** First free cabin inside this day. Saturday and other short days stop at endHour. */
async function findCabinSlotOnDay(input: {
  ymd: string;
  endHour: number;
  procedureTypeId: string;
  excludeOrderId?: string;
  guestSex?: string | null;
}): Promise<CabinSlot | null> {
  const procedureType = await prisma.procedureType.findFirst({
    where: { id: input.procedureTypeId },
    include: { requirements: true },
  });
  if (!procedureType) return null;
  const resources = (await listPhysicalRequirementResources(procedureType)).filter((row) =>
    cabinMatchesGuest(row.sexAudience, input.guestSex),
  );
  if (resources.length === 0) return null;
  const settings = await getSchedulingSettings();
  const durationMin = procedureType.durationMin ?? settings.schedulingSlotMinutes;
  const stepMs = Math.max(5, settings.schedulingSlotMinutes) * 60_000;
  const physicalRole = procedureType.requirements?.find(
    (row) => row.role === "LOCATION" || row.role === "EQUIPMENT",
  )?.role;
  const role: "LOCATION" | "EQUIPMENT" =
    physicalRole === "LOCATION" || procedureType.resourceKind === "ROOM" ? "LOCATION" : "EQUIPMENT";
  const dayStart = dayStartInstant(input.ymd, settings.dayStartHour);
  const dayEnd = dayStartInstant(input.ymd, input.endHour);
  const lookback = new Date(dayStart.getTime() - 240 * 60_000);
  const occupied = await prisma.procedureAllocation.findMany({
    where: {
      role: { in: ["LOCATION", "EQUIPMENT"] },
      resourceId: { in: resources.map((row) => row.id) },
      startsAt: { lt: dayEnd },
      endsAt: { gt: lookback },
      ...(input.excludeOrderId ? { procedureOrderId: { not: input.excludeOrderId } } : {}),
      procedureOrder: { status: { notIn: ["CANCELLED", "NO_SHOW", "PROPOSED"] } },
    },
    select: {
      resourceId: true,
      startsAt: true,
      endsAt: true,
      procedureOrder: { select: { procedureType: { select: { resourceGapMinutes: true } } } },
    },
  });
  let cursor = dayStart;
  for (let attempt = 0; attempt < 240; attempt++) {
    const end = new Date(cursor.getTime() + durationMin * 60_000);
    const endHm = bakuHourMinute(end);
    if (endHm.hour > input.endHour || (endHm.hour === input.endHour && endHm.minute > 0)) break;
    const startHm = bakuHourMinute(cursor);
    if (startHm.hour > input.endHour || (startHm.hour === input.endHour && startHm.minute > 0)) break;
    for (const resource of resources) {
      let used = 0;
      for (const row of occupied) {
        if (row.resourceId !== resource.id) continue;
        const gap = row.procedureOrder.procedureType?.resourceGapMinutes ?? 5;
        if (allocationOccupiesCandidate(row.startsAt, row.endsAt, gap, cursor, end)) used++;
      }
      if (used < resource.capacity) {
        return { start: cursor, end, resourceId: resource.id, role };
      }
    }
    cursor = new Date(cursor.getTime() + stepMs);
  }
  return null;
}

async function writeSeatedOrder(input: {
  existingId?: string;
  slot: CabinSlot;
  note: string | null;
  fields: { dayBlock: string; bathSequence: "SITZ_THEN_FULL" | null; naftalanFill: "OTURAQ" | "TAM" | null };
}): Promise<string | null> {
  const data = {
    scheduledAt: input.slot.start,
    endsAt: input.slot.end,
    resourceId: input.slot.resourceId,
    status: "SCHEDULED" as const,
    note: input.note,
    physioFields: input.fields,
  };
  if (!input.existingId) return null;
  await prisma.procedureOrder.update({ where: { id: input.existingId }, data });
  return input.existingId;
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
  const patient = await prisma.patientRef.findUnique({
    where: { id: episode.patientRefId },
    select: { sex: true },
  });
  const guestSex = patient?.sex ?? null;
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
  const requestBaths = new Set(input.manualBathYmds);
  const requestRests = new Set(input.manualRestYmds);
  const pinYmds = new Set(
    own.filter((order) => order.note === "bath_manual" && !LOCKED.has(order.status)).map((order) => order.ymd),
  );
  for (const ymd of requestBaths) pinYmds.add(ymd);
  for (const ymd of requestRests) pinYmds.delete(ymd);
  const restYmds = new Set(restOrders.map((order) => bakuDateKey(order.scheduledAt)));
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
    if (LOCKED.has(order.status)) {
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
  }).filter((cell) => cell.procedureCode === input.procedureCode);

  const movable = own.filter((order) => !LOCKED.has(order.status));
  const orgId = requestOrganizationId();
  const staffMode = await resolveStaffModeForProcedureType(procedureType.id);
  const used = new Set<string>();
  let unplaced = 0;
  const unplacedDays: string[] = [];
  for (const cell of planned) {
    const lockedOrder = own.find((order) => LOCKED.has(order.status) && order.ymd === cell.ymd);
    if (lockedOrder) {
      used.add(lockedOrder.id);
      continue;
    }
    const day = snapshot.days.find((row) => row.ymd === cell.ymd);
    const existing = movable.find((order) => order.ymd === cell.ymd && !used.has(order.id))
      ?? movable.find((order) => !used.has(order.id));
    const slot = await findCabinSlotOnDay({
      ymd: cell.ymd,
      endHour: day?.endHour ?? 17,
      procedureTypeId: procedureType.id,
      excludeOrderId: existing?.id,
      guestSex,
    });
    if (!slot) {
      if (existing && existing.ymd === cell.ymd) {
        used.add(existing.id);
        continue;
      }
      unplaced += 1;
      unplacedDays.push(cell.ymd);
      continue;
    }
    const staff = await findSkilledFreePractitioner({
      procedureTypeId: procedureType.id,
      startsAt: slot.start,
      endsAt: slot.end,
      staffMode,
      skillWhenUnposted: true,
    });
    if (!staff) {
      unplaced += 1;
      unplacedDays.push(cell.ymd);
      if (existing) used.add(existing.id);
      continue;
    }
    const note = cell.manual ? "bath_manual" : null;
    const fields = {
      dayBlock: input.mode,
      bathSequence: input.bathSequence ?? null,
      naftalanFill: cell.fill ?? null,
    };
    const orderId = await writeSeatedOrder({
      existingId: existing?.id,
      slot,
      note,
      fields,
    });
    if (!orderId) {
      unplaced += 1;
      unplacedDays.push(cell.ymd);
      continue;
    }
    if (existing) used.add(existing.id);
    await replaceProcedureAllocations(orderId, [
      { role: slot.role, resourceId: slot.resourceId, startsAt: slot.start, endsAt: slot.end },
      { role: "STAFF", practitionerId: staff.id, startsAt: slot.start, endsAt: slot.end },
    ]);
  }
  const drop = movable.filter((order) => !used.has(order.id));
  const restDrop = drop.filter((order) => restYmds.has(order.ymd));
  const otherDrop = drop.filter((order) => !restYmds.has(order.ymd));
  if (restDrop.length > 0) {
    await prisma.procedureOrder.updateMany({
      where: { id: { in: restDrop.map((order) => order.id) } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "bath_rest" },
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
  const bathYmds = new Set(planned.map((cell) => cell.ymd));
  const staleRests = restOrders.filter((order) => bathYmds.has(bakuDateKey(order.scheduledAt)));
  if (staleRests.length > 0) {
    await prisma.procedureOrder.deleteMany({ where: { id: { in: staleRests.map((order) => order.id) } } });
  }
  const markedRests = new Set([
    ...restOrders.map((order) => bakuDateKey(order.scheduledAt)),
    ...restDrop.map((order) => order.ymd),
  ]);
  for (const ymd of restYmds) {
    if (bathYmds.has(ymd) || markedRests.has(ymd)) continue;
    const when = dayStartInstant(ymd, 9);
    const sibling = await prisma.procedureOrder.findFirst({
      where: {
        clinicalEpisodeId: input.episodeId,
        procedureCode: input.procedureCode,
        inPackage: true,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        NOT: { packageQuotaCode: input.procedureCode },
      },
      select: { packageQuotaCode: true },
    });
    await prisma.procedureOrder.create({
      data: {
        organizationId: orgId,
        patientRefId: episode.patientRefId,
        clinicalEpisodeId: input.episodeId,
        procedureTypeId: procedureType.id,
        procedureCode: input.procedureCode,
        procedureName: procedureType.name,
        scheduledAt: when,
        endsAt: when,
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: "bath_rest",
        bodyPart: procedureType.bodyPart,
        inPackage: true,
        packageQuotaCode: sibling?.packageQuotaCode || input.procedureCode,
        patientOrigin: episode.patientOrigin,
        reservationId: episode.reservationId,
        amountNet: 0,
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

export type BathSeatMiss = {
  ymd: string;
  procedureCode: string;
  reason: "no_cabin" | "no_staff" | "no_day" | "no_mode";
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
 * One session per planned day, into a free cabin and a free attendant.
 * A day that cannot take the session is reported. Already seated orders stay.
 */
export async function seatBathSeriesOrders(orderIds: string[]): Promise<{
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

  for (const [procedureCode, group] of byCode) {
    const meta = memberByCode.get(procedureCode)!;
    const mode = bathModeOf(group[0]?.physioFields);
    if (!mode) {
      for (const order of group) {
        missed.push({ ymd: "", procedureCode: order.procedureCode, reason: "no_mode" });
      }
      continue;
    }
    const already = snapshot.orders.filter((order) => order.procedureCode === procedureCode);
    const kept: KeptCell[] = already.map((order) => ({
      ymd: order.ymd,
      procedureCode,
      locked: true,
    }));
    const today = todayBakuYmd();
    const upcoming = snapshot.days.filter((day) => day.ymd >= today);
    const planned =
      upcoming.length === 0
        ? []
        : planBathSeries({
            days: upcoming,
            series: [
              {
                seriesCode: meta.seriesCode,
                procedureCode,
                mark: meta.mark,
                mode,
                qty: already.length + group.length,
                fillsRestDays: meta.fillsRestDays,
              },
            ],
            kept,
            layout: "continue",
            modes: snapshot.modes,
          }).filter(
            (cell) =>
              cell.procedureCode === procedureCode &&
              cell.ymd >= today &&
              !already.some((order) => order.ymd === cell.ymd),
          );
    const queue = [...group];
    for (const cell of planned) {
      const order = queue[0];
      if (!order?.procedureTypeId) break;
      const day = snapshot.days.find((row) => row.ymd === cell.ymd);
      const slot = await findCabinSlotOnDay({
        ymd: cell.ymd,
        endHour: day?.endHour ?? 17,
        procedureTypeId: order.procedureTypeId,
        excludeOrderId: order.id,
        guestSex,
      });
      if (!slot) {
        missed.push({ ymd: cell.ymd, procedureCode, reason: "no_cabin" });
        continue;
      }
      const staffMode = await resolveStaffModeForProcedureType(order.procedureTypeId);
      const staff = await findSkilledFreePractitioner({
        procedureTypeId: order.procedureTypeId,
        startsAt: slot.start,
        endsAt: slot.end,
        staffMode,
        skillWhenUnposted: true,
      });
      if (!staff) {
        missed.push({ ymd: cell.ymd, procedureCode, reason: "no_staff" });
        continue;
      }
      queue.shift();
      await prisma.procedureOrder.update({
        where: { id: order.id },
        data: {
          status: "SCHEDULED",
          scheduledAt: slot.start,
          endsAt: slot.end,
          resourceId: slot.resourceId,
          confirmedAt: new Date(),
        },
      });
      await replaceProcedureAllocations(order.id, [
        { role: slot.role, resourceId: slot.resourceId, startsAt: slot.start, endsAt: slot.end },
        { role: "STAFF", practitionerId: staff.id, startsAt: slot.start, endsAt: slot.end },
      ]);
      placedIds.push(order.id);
    }
    for (const order of queue) {
      missed.push({ ymd: "", procedureCode: order.procedureCode, reason: "no_day" });
    }
  }

  return { handledIds: handled.map((order) => order.id), placedIds, missed };
}
