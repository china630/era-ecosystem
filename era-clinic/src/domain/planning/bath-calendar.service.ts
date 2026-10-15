import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { lookupHotelStayWindow } from "@/lib/hotel-stay-person";
import { bakuDateKey, bakuHourMinute } from "@/lib/baku-day";
import { dayStartInstant, listClinicDays, stayYmd } from "@/domain/planning/clinic-day";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import {
  countResourceAllocations,
  listPhysicalRequirementResources,
  replaceProcedureAllocations,
} from "@/domain/procedure/procedure-allocation.service";
import { planBathSeries, type BathMode, type KeptCell, type PlannedBath } from "@/domain/planning/bath-calendar";

const LOCKED = new Set(["CHECKED_IN", "COMPLETED"]);

export async function getBathCalendar(episodeId: string) {
  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    include: { programInstance: { select: { startsOn: true, endsOn: true } } },
  });
  let stayFrom = episode?.programInstance?.startsOn ?? null;
  let stayTo = episode?.programInstance?.endsOn ?? null;
  if ((!stayFrom || !stayTo) && episode?.reservationId) {
    const hotel = await lookupHotelStayWindow(episode.reservationId);
    if (hotel) {
      stayFrom = new Date(hotel.checkInDate);
      stayTo = new Date(hotel.checkOutDate);
    }
  }
  if (!episode || !stayFrom || !stayTo || Number.isNaN(stayFrom.getTime()) || Number.isNaN(stayTo.getTime())) {
    return { days: [], series: [], orders: [] };
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
  return {
    days,
    series,
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
}): Promise<CabinSlot | null> {
  const procedureType = await prisma.procedureType.findFirst({
    where: { id: input.procedureTypeId },
    include: { requirements: true },
  });
  if (!procedureType) return null;
  const resources = await listPhysicalRequirementResources(procedureType);
  if (resources.length === 0) return null;
  const settings = await getSchedulingSettings();
  const durationMin = procedureType.durationMin ?? settings.schedulingSlotMinutes;
  const stepMs = Math.max(5, settings.schedulingSlotMinutes) * 60_000;
  const physicalRole = procedureType.requirements?.find(
    (row) => row.role === "LOCATION" || row.role === "EQUIPMENT",
  )?.role;
  const role: "LOCATION" | "EQUIPMENT" =
    physicalRole === "LOCATION" || procedureType.resourceKind === "ROOM" ? "LOCATION" : "EQUIPMENT";
  let cursor = dayStartInstant(input.ymd, settings.dayStartHour);
  for (let attempt = 0; attempt < 240; attempt++) {
    const end = new Date(cursor.getTime() + durationMin * 60_000);
    const endHm = bakuHourMinute(end);
    if (endHm.hour > input.endHour || (endHm.hour === input.endHour && endHm.minute > 0)) break;
    const startHm = bakuHourMinute(cursor);
    if (startHm.hour > input.endHour || (startHm.hour === input.endHour && startHm.minute > 0)) break;
    for (const resource of resources) {
      const used = await countResourceAllocations(resource.id, cursor, end, input.excludeOrderId);
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
  fields: { dayBlock: BathMode; bathSequence: "SITZ_THEN_FULL" | null; naftalanFill: "OTURAQ" | "TAM" | null };
  cell: PlannedBath;
  orgId: string;
  episode: { patientRefId: string | null; patientOrigin: string; reservationId: string | null };
  procedureType: { id: string; name: string; bodyPart: string | null };
  episodeId: string;
  procedureCode: string;
}): Promise<string> {
  const data = {
    scheduledAt: input.slot.start,
    endsAt: input.slot.end,
    resourceId: input.slot.resourceId,
    status: "SCHEDULED" as const,
    note: input.note,
    physioFields: input.fields,
  };
  if (input.existingId) {
    await prisma.procedureOrder.update({ where: { id: input.existingId }, data });
    return input.existingId;
  }
  if (!input.episode.patientRefId) throw new Error("Episode not found");
  const created = await prisma.procedureOrder.create({
    data: {
      ...data,
      organizationId: input.orgId,
      patientRefId: input.episode.patientRefId,
      clinicalEpisodeId: input.episodeId,
      procedureTypeId: input.procedureType.id,
      procedureCode: input.procedureCode,
      procedureName: input.procedureType.name,
      bodyPart: input.procedureType.bodyPart,
      inPackage: true,
      packageQuotaCode: input.procedureCode,
      patientOrigin: input.episode.patientOrigin,
      reservationId: input.episode.reservationId,
      amountNet: 0,
    },
  });
  return created.id;
}

function storedMode(fields: unknown): string | null {
  if (!fields || typeof fields !== "object") return null;
  const block = (fields as { dayBlock?: unknown }).dayBlock;
  return block == null ? null : String(block);
}

export async function saveBathCalendar(input: {
  episodeId: string;
  procedureCode: string;
  mode: BathMode;
  qty: number;
  manualRestYmds: string[];
  manualBathYmds: string[];
  bathSequence?: "SITZ_THEN_FULL" | null;
}) {
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
        qty: input.qty,
        fillsRestDays: series.fillsRestDays,
        sitzThenFull: input.bathSequence === "SITZ_THEN_FULL",
      },
    ],
    kept,
    layout,
  }).filter((cell) => cell.procedureCode === input.procedureCode);

  const movable = own.filter((order) => !LOCKED.has(order.status));
  const orgId = requestOrganizationId();
  const used = new Set<string>();
  let unplaced = 0;
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
    });
    if (!slot) {
      if (existing && existing.ymd === cell.ymd) {
        used.add(existing.id);
        continue;
      }
      unplaced += 1;
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
      cell,
      orgId,
      episode,
      procedureType,
      episodeId: input.episodeId,
      procedureCode: input.procedureCode,
    });
    if (existing) used.add(existing.id);
    await replaceProcedureAllocations(orderId, [
      { role: slot.role, resourceId: slot.resourceId, startsAt: slot.start, endsAt: slot.end },
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
  }
  if (otherDrop.length > 0) {
    await prisma.procedureOrder.updateMany({
      where: { id: { in: otherDrop.map((order) => order.id) } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "bath_calendar" },
    });
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
        packageQuotaCode: input.procedureCode,
        patientOrigin: episode.patientOrigin,
        reservationId: episode.reservationId,
        amountNet: 0,
      },
    });
  }
  return { planned: planned.length, seated: planned.length - unplaced, unplaced, cancelled: otherDrop.length };
}
