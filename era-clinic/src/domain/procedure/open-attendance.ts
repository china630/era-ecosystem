/**
 * CLI-62 — open attendance day-buckets + same-day check-in helpers.
 * ADR: docs/adr/clinic-open-attendance.md
 */
import { prisma } from "@/lib/prisma";
import {
  addBakuDays,
  bakuDateKey,
  bakuDayBounds,
  parseBakuDateTime,
  todayBakuYmd,
} from "@/lib/baku-day";
import { listClinicDays, nextWorkingYmd } from "@/domain/planning/clinic-day";
import { getTenantWorkHours } from "@/domain/settings/scheduling-settings";
import { requestOrganizationId } from "@/lib/request-organization";
import { cabinMatchesGuest } from "@/domain/procedure/resource-sex";
import {
  listPhysicalRequirementResources,
  replaceProcedureAllocations,
} from "@/domain/procedure/procedure-allocation.service";

export type ProcedureSchedulingMode = "FIXED" | "OPEN";
export type ProcedureCheckInWindowMode = "STRICT" | "SAME_DAY";

export function isOpenSchedulingMode(
  mode: string | null | undefined,
): boolean {
  return mode === "OPEN";
}

/** OPEN day-bucket rows burn quota only after attendance. */
export function openAttendanceBurnsQuota(status: string): boolean {
  return status === "CHECKED_IN" || status === "COMPLETED";
}

export async function resolveCheckInWindowSettings(now = new Date()): Promise<{
  mode: ProcedureCheckInWindowMode;
  sameDayUntil: Date | null;
  sameDayActive: boolean;
  dayStartHour: number;
  dayEndHour: number;
}> {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  const mode: ProcedureCheckInWindowMode =
    tenant?.procedureCheckInWindow === "SAME_DAY" ? "SAME_DAY" : "STRICT";
  const sameDayUntil = tenant?.procedureCheckInSameDayUntil ?? null;
  const hours = await getTenantWorkHours();
  const today = todayBakuYmd(now);
  let sameDayActive = mode === "SAME_DAY";
  if (sameDayActive && sameDayUntil) {
    const untilYmd = bakuDateKey(sameDayUntil);
    if (today > untilYmd) sameDayActive = false;
  }
  return {
    mode,
    sameDayUntil,
    sameDayActive,
    dayStartHour: hours.dayStartHour,
    dayEndHour: hours.dayEndHour,
  };
}

/** True when check-in may ignore slot grace and use clinic open hours for this Baku day. */
export function isWithinClinicDayHours(
  now: Date,
  dayStartHour: number,
  dayEndHour: number,
): boolean {
  const ymd = bakuDateKey(now);
  const start = parseBakuDateTime(
    ymd,
    `${String(dayStartHour).padStart(2, "0")}:00`,
  );
  const end = parseBakuDateTime(
    ymd,
    `${String(dayEndHour).padStart(2, "0")}:00`,
  );
  const t = now.getTime();
  return t >= start.getTime() && t < end.getTime();
}

export function orderIsTodayBaku(
  scheduledAt: Date,
  now = new Date(),
): boolean {
  return bakuDateKey(scheduledAt) === todayBakuYmd(now);
}

/**
 * Pin OPEN PROPOSED rows onto consecutive working days without cabin booking.
 */
export async function pinOpenAttendanceOrders(
  orderIds: string[],
  opts?: {
    confirmedByUserId?: string;
    scheduleBefore?: Date;
    startAt?: Date;
    /** When set (reseat/recalc), pin each order to that Baku YMD instead of consecutive days. */
    pinYmdByOrderId?: Record<string, string>;
  },
): Promise<{
  placed: number;
  placedIds: string[];
  missingCabinNames: string[];
  failures: Array<{
    orderId: string;
    procedureCode: string;
    procedureName: string;
    reason: string;
    ymd?: string;
  }>;
}> {
  if (orderIds.length === 0) {
    return { placed: 0, placedIds: [], missingCabinNames: [], failures: [] };
  }
  const orders = await prisma.procedureOrder.findMany({
    where: { id: { in: orderIds } },
    include: {
      procedureType: { select: { durationMin: true, openAttendance: true } },
      clinicalEpisode: { select: { programInstance: { select: { endsOn: true } } } },
    },
  });
  if (orders.length === 0) {
    return { placed: 0, placedIds: [], missingCabinNames: [], failures: [] };
  }

  const workHours = await getTenantWorkHours();
  const now =
    opts?.startAt && !Number.isNaN(opts.startAt.getTime())
      ? opts.startAt
      : new Date();
  let cursorYmd = bakuDateKey(now);
  let horizonEndYmd = addBakuDays(cursorYmd, 21);
  if (opts?.scheduleBefore && !Number.isNaN(opts.scheduleBefore.getTime())) {
    horizonEndYmd = bakuDateKey(opts.scheduleBefore);
  } else {
    for (const order of orders) {
      const endsOn = order.clinicalEpisode?.programInstance?.endsOn;
      if (endsOn && !Number.isNaN(endsOn.getTime())) {
        const ymd = bakuDateKey(endsOn);
        if (ymd < horizonEndYmd) horizonEndYmd = ymd;
      }
    }
  }
  for (const pin of Object.values(opts?.pinYmdByOrderId ?? {})) {
    if (pin && pin >= horizonEndYmd) horizonEndYmd = addBakuDays(pin, 1);
  }
  const clinicDays = await listClinicDays(cursorYmd, addBakuDays(horizonEndYmd, 7));
  if (!clinicDays.some((d) => d.working && d.ymd === cursorYmd)) {
    const next = nextWorkingYmd(clinicDays, cursorYmd);
    if (next) cursorYmd = next;
  }

  const prescribedByPractitionerId = opts?.confirmedByUserId
    ? (
        await prisma.practitioner.findFirst({
          where: { userId: opts.confirmedByUserId },
          select: { id: true },
        })
      )?.id ?? null
    : null;

  const placedIds: string[] = [];
  const failures: Array<{
    orderId: string;
    procedureCode: string;
    procedureName: string;
    reason: string;
    ymd?: string;
  }> = [];

  // Preserve caller order (modal / prescribe sequence), not DB findMany order.
  const byId = new Map(orders.map((row) => [row.id, row]));
  const ordered = orderIds
    .map((id) => byId.get(id))
    .filter((row): row is (typeof orders)[number] => Boolean(row));

  for (const order of ordered) {
    const pinned = opts?.pinYmdByOrderId?.[order.id];
    let ymd = pinned ?? cursorYmd;
    if (pinned) {
      const day = clinicDays.find((d) => d.ymd === pinned);
      if (!day?.working) {
        const next = nextWorkingYmd(clinicDays, pinned);
        if (next) ymd = next;
      }
    }
    const working = clinicDays.find((d) => d.ymd === ymd && d.working);
    if (!working || ymd > horizonEndYmd) {
      failures.push({
        orderId: order.id,
        procedureCode: order.procedureCode,
        procedureName: order.procedureName,
        reason: "no_slot",
        ymd,
      });
      if (!pinned) {
        const next = nextWorkingYmd(clinicDays, cursorYmd);
        if (next) cursorYmd = next;
      }
      continue;
    }
    const duration = order.procedureType?.durationMin ?? 30;
    const scheduledAt = parseBakuDateTime(
      ymd,
      `${String(workHours.dayStartHour).padStart(2, "0")}:00`,
    );
    const endsAt = new Date(scheduledAt.getTime() + duration * 60_000);
    const accessCode =
      order.accessCode?.trim() ||
      (await generateUniqueAccessCode(order.organizationId));
    await prisma.procedureOrder.update({
      where: { id: order.id },
      data: {
        status: "SCHEDULED",
        schedulingMode: "OPEN",
        scheduledAt,
        endsAt,
        resourceId: null,
        confirmedAt: new Date(),
        confirmedByUserId: opts?.confirmedByUserId,
        prescribedByPractitionerId,
        accessCode,
      },
    });
    placedIds.push(order.id);
    if (!pinned) {
      const next = nextWorkingYmd(clinicDays, addBakuDays(cursorYmd, 1));
      cursorYmd = next ?? addBakuDays(cursorYmd, 1);
    }
  }

  return {
    placed: placedIds.length,
    placedIds,
    missingCabinNames: [],
    failures,
  };
}

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomAccessCode(): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += ACCESS_CODE_ALPHABET[Math.floor(Math.random() * ACCESS_CODE_ALPHABET.length)]!;
  }
  return out;
}

async function generateUniqueAccessCode(organizationId: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = randomAccessCode();
    const exists = await prisma.procedureOrder.findFirst({
      where: { organizationId, accessCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error("Unable to generate unique procedure access code");
}

async function pickStaffForSeat(procedureTypeId: string): Promise<string | null> {
  const skill = await prisma.practitionerSkill.findFirst({
    where: { procedureTypeId, practitioner: { active: true } },
    select: { practitionerId: true },
    orderBy: { practitionerId: "asc" },
  });
  return skill?.practitionerId ?? null;
}

async function applyOccupancyNow(input: {
  orderId: string;
  resourceId: string;
  durationMin: number;
  physicalRole: "LOCATION" | "EQUIPMENT";
  procedureTypeId: string | null;
  /** When true, also move scheduledAt (OPEN seat). FIXED SAME_DAY keeps plan clock. */
  moveScheduledAt: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const endsAt = new Date(now.getTime() + input.durationMin * 60_000);
  const staffId = input.procedureTypeId
    ? await pickStaffForSeat(input.procedureTypeId)
    : null;
  await prisma.procedureOrder.update({
    where: { id: input.orderId },
    data: {
      ...(input.moveScheduledAt ? { scheduledAt: now } : {}),
      endsAt,
      resourceId: input.resourceId,
      manuallyAdjusted: true,
    },
  });
  await replaceProcedureAllocations(input.orderId, [
    {
      role: input.physicalRole,
      resourceId: input.resourceId,
      startsAt: now,
      endsAt,
    },
    ...(staffId
      ? [
          {
            role: "STAFF" as const,
            practitionerId: staffId,
            startsAt: now,
            endsAt,
          },
        ]
      : []),
  ]);
  return { id: input.orderId, scheduledAt: now, endsAt, resourceId: input.resourceId };
}

/**
 * Seat an OPEN unseated order onto a free matching cabin starting now.
 */
export async function seatOpenAttendanceNow(orderId: string, now = new Date()) {
  const order = await prisma.procedureOrder.findUnique({
    where: { id: orderId },
    include: {
      procedureType: { include: { requirements: true } },
      patientRef: { select: { sex: true } },
    },
  });
  if (!order) throw new Error("Procedure not found");
  const pt = order.procedureType;
  if (!pt) throw new Error("Procedure type missing");
  const duration = pt.durationMin ?? 30;
  const physicalReq = pt.requirements?.find(
    (req) => req.role === "LOCATION" || req.role === "EQUIPMENT",
  );
  const physicalRole: "LOCATION" | "EQUIPMENT" =
    physicalReq?.role === "LOCATION"
      ? "LOCATION"
      : physicalReq?.role === "EQUIPMENT"
        ? "EQUIPMENT"
        : pt.resourceKind === "ROOM"
          ? "LOCATION"
          : "EQUIPMENT";

  let chosen = order.resourceId;
  if (!chosen) {
    const candidates = await listPhysicalRequirementResources(pt);
    const guestSex = order.patientRef?.sex ?? null;
    const matching = candidates.filter((row) =>
      cabinMatchesGuest(row.sexAudience, guestSex),
    );
    if (matching.length === 0) {
      throw new Error("No matching cabin for open attendance seat");
    }
    for (const resource of matching) {
      const busy = await prisma.procedureOrder.count({
        where: { resourceId: resource.id, status: "CHECKED_IN" },
      });
      if (busy >= (resource.capacity ?? 1)) continue;
      const overlap = await prisma.resourceBooking.findFirst({
        where: {
          resourceId: resource.id,
          startsAt: { lt: new Date(now.getTime() + duration * 60_000) },
          endsAt: { gt: now },
          procedureOrder: {
            status: { notIn: ["CANCELLED", "NO_SHOW", "UNPAID_MISSED", "PROPOSED"] },
            id: { not: orderId },
          },
        },
        select: { id: true },
      });
      if (overlap) continue;
      chosen = resource.id;
      break;
    }
  }
  if (!chosen) throw new Error("All matching cabins are busy");
  void requestOrganizationId;
  return applyOccupancyNow({
    orderId,
    resourceId: chosen,
    durationMin: duration,
    physicalRole,
    procedureTypeId: pt.id,
    moveScheduledAt: true,
    now,
  });
}

/** Rebase FIXED occupancy to now on the same cabin; keep scheduledAt as plan clock. */
export async function rebaseFixedOccupancyToNow(
  orderId: string,
  resourceId: string,
  now = new Date(),
) {
  const order = await prisma.procedureOrder.findUnique({
    where: { id: orderId },
    include: { procedureType: { include: { requirements: true } } },
  });
  if (!order) throw new Error("Procedure not found");
  const pt = order.procedureType;
  const duration =
    pt?.durationMin ??
    (order.endsAt
      ? Math.max(
          5,
          Math.round((order.endsAt.getTime() - order.scheduledAt.getTime()) / 60_000),
        )
      : 30);
  const physicalReq = pt?.requirements?.find(
    (req) => req.role === "LOCATION" || req.role === "EQUIPMENT",
  );
  const physicalRole: "LOCATION" | "EQUIPMENT" =
    physicalReq?.role === "LOCATION"
      ? "LOCATION"
      : physicalReq?.role === "EQUIPMENT"
        ? "EQUIPMENT"
        : pt?.resourceKind === "ROOM"
          ? "LOCATION"
          : "EQUIPMENT";
  return applyOccupancyNow({
    orderId,
    resourceId,
    durationMin: duration,
    physicalRole,
    procedureTypeId: pt?.id ?? null,
    moveScheduledAt: false,
    now,
  });
}

export async function loadOpenAttendanceForesight(date: Date): Promise<{
  waiting: number;
  inCabin: number;
  capacity: number;
  rows: Array<{
    id: string;
    procedureCode: string;
    procedureName: string;
    patientRefId: string;
    status: string;
    resourceId: string | null;
  }>;
}> {
  const ymd = bakuDateKey(date);
  const { start, end } = bakuDayBounds(ymd);
  const rows = await prisma.procedureOrder.findMany({
    where: {
      schedulingMode: "OPEN",
      scheduledAt: { gte: start, lt: end },
      status: { in: ["SCHEDULED", "CHECKED_IN"] },
    },
    select: {
      id: true,
      procedureCode: true,
      procedureName: true,
      patientRefId: true,
      status: true,
      resourceId: true,
      procedureTypeId: true,
    },
    orderBy: { scheduledAt: "asc" },
    take: 500,
  });
  const waiting = rows.filter((r) => r.status === "SCHEDULED" && !r.resourceId).length;
  const inCabin = rows.filter((r) => r.status === "CHECKED_IN").length;
  const typeIds = [
    ...new Set(rows.map((r) => r.procedureTypeId).filter((id): id is string => Boolean(id))),
  ];
  let capacity = 0;
  if (typeIds.length > 0) {
    const types = await prisma.procedureType.findMany({
      where: { id: { in: typeIds } },
      include: { requirements: true },
    });
    const codes = new Set<string>();
    for (const pt of types) {
      for (const req of pt.requirements) {
        if (
          (req.role === "LOCATION" || req.role === "EQUIPMENT") &&
          req.resourceCode
        ) {
          codes.add(req.resourceCode);
        }
      }
      if (pt.resourceCode) codes.add(pt.resourceCode);
    }
    if (codes.size > 0) {
      const resources = await prisma.resource.findMany({
        where: { code: { in: [...codes] } },
        select: { capacity: true },
      });
      capacity = resources.reduce((sum, r) => sum + (r.capacity ?? 1), 0);
    }
  }
  return {
    waiting,
    inCabin,
    capacity,
    rows: rows.map((r) => ({
      id: r.id,
      procedureCode: r.procedureCode,
      procedureName: r.procedureName,
      patientRefId: r.patientRefId,
      status: r.status,
      resourceId: r.resourceId,
    })),
  };
}
