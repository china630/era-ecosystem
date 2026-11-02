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
import { packageBlockIsFull } from "@/domain/sanatorium/daily-package-cap";
import {
  loadEpisodeDailyCaps,
  quotaForGuestDay,
  type EpisodeDailyCaps,
} from "@/domain/sanatorium/block-daily-cap";
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

/**
 * OPEN without a cabin is a civil-day pin only (`scheduledAt` = day anchor, not an
 * appointment clock). It must not participate in FIXED wall-clock rest / overlap.
 * After nurse seat (`resourceId` set) it behaves like any timed row.
 */
export function orderCountsForWallClockRest(input: {
  status: string;
  schedulingMode?: string | null;
  resourceId?: string | null;
}): boolean {
  if (input.status === "NO_SHOW" || input.status === "PROPOSED") return false;
  if (isOpenSchedulingMode(input.schedulingMode) && !input.resourceId) return false;
  return true;
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
 * First working day in range where this code is not already pinned.
 * A different code may share the day. An in-package row also stops when its
 * block's distinct-code cap is full. Paid extras ignore that cap.
 * Returns null when nothing is left through horizonEndYmd.
 */
export function pickOpenAttendanceDay(input: {
  procedureCode: string;
  inPackage: boolean;
  quotaKey: string;
  dailyCap: number | null;
  startYmd: string;
  horizonEndYmd: string;
  workingYmds: string[];
  /** Baku YMD → procedure codes already on that day (package and extras). */
  codesOnDay: Map<string, Set<string>>;
  /** Baku YMD → quota block → in-package codes. Extras are not recorded here. */
  packageCodesOnDay: Map<string, Map<string, Set<string>>>;
}): string | null {
  for (const ymd of input.workingYmds) {
    if (ymd < input.startYmd || ymd > input.horizonEndYmd) continue;
    if (input.codesOnDay.get(ymd)?.has(input.procedureCode)) continue;
    const blockCodes = input.packageCodesOnDay.get(ymd)?.get(input.quotaKey);
    if (
      input.inPackage &&
      input.dailyCap != null &&
      packageBlockIsFull({
        slots: [...(blockCodes ?? [])].map((code) => ({
          code,
          start: parseBakuDateTime(ymd, "12:00"),
          inPackage: true,
          quotaKey: input.quotaKey,
        })),
        day: parseBakuDateTime(ymd, "12:00"),
        candidateCode: input.procedureCode,
        quotaKey: input.quotaKey,
        cap: input.dailyCap,
      })
    ) {
      continue;
    }
    return ymd;
  }
  return null;
}

/** Remember a placed code. In-package rows also fill the block-cap set. */
export function noteOpenAttendanceDay(
  codesOnDay: Map<string, Set<string>>,
  packageCodesOnDay: Map<string, Map<string, Set<string>>>,
  ymd: string,
  procedureCode: string,
  inPackage: boolean,
  quotaKey: string,
): void {
  const codes = codesOnDay.get(ymd) ?? new Set<string>();
  codes.add(procedureCode);
  codesOnDay.set(ymd, codes);
  if (!inPackage) return;
  const byQuota = packageCodesOnDay.get(ymd) ?? new Map<string, Set<string>>();
  const block = byQuota.get(quotaKey) ?? new Set<string>();
  block.add(procedureCode);
  byQuota.set(quotaKey, block);
  packageCodesOnDay.set(ymd, byQuota);
}

/**
 * Pin OPEN rows onto working days through the stay. Different codes share a day.
 * The same code goes to the next working day. No cabin.
 * `scheduledAt` is the Baku civil-day anchor only (dayStartHour stamp) — UI hides
 * the clock; planners must use `orderCountsForWallClockRest` so the stamp never
 * blocks FIXED / paid-extra seating the same day.
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
  const workingYmds = clinicDays.filter((day) => day.working).map((day) => day.ymd);
  const codesOnDay = new Map<string, Set<string>>();
  const packageCodesOnDay = new Map<string, Map<string, Set<string>>>();
  const episodeIds = [
    ...new Set(orders.map((row) => row.clinicalEpisodeId).filter((id): id is string => Boolean(id))),
  ];
  const capsByEpisode = new Map<string, EpisodeDailyCaps>();
  for (const episodeId of episodeIds) {
    if (orders.some((row) => row.clinicalEpisodeId === episodeId && row.inPackage)) {
      capsByEpisode.set(episodeId, await loadEpisodeDailyCaps(episodeId));
    }
  }
  if (episodeIds.length > 0) {
    const existing = await prisma.procedureOrder.findMany({
      where: {
        clinicalEpisodeId: { in: episodeIds },
        id: { notIn: orderIds },
        schedulingMode: "OPEN",
        status: { notIn: ["CANCELLED", "NO_SHOW", "UNPAID_MISSED"] },
      },
      select: {
        procedureCode: true,
        scheduledAt: true,
        inPackage: true,
        packageQuotaCode: true,
        clinicalEpisodeId: true,
      },
    });
    for (const row of existing) {
      const ymd = bakuDateKey(row.scheduledAt);
      const quota = quotaForGuestDay(
        row.clinicalEpisodeId ? capsByEpisode.get(row.clinicalEpisodeId) ?? null : null,
        {
          inPackage: row.inPackage,
          packageQuotaCode: row.packageQuotaCode,
          procedureCode: row.procedureCode,
        },
      );
      noteOpenAttendanceDay(
        codesOnDay,
        packageCodesOnDay,
        ymd,
        row.procedureCode,
        row.inPackage,
        quota.quotaKey,
      );
    }
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
    const quota = quotaForGuestDay(
      order.clinicalEpisodeId ? capsByEpisode.get(order.clinicalEpisodeId) ?? null : null,
      {
        inPackage: order.inPackage,
        packageQuotaCode: order.packageQuotaCode,
        procedureCode: order.procedureCode,
      },
    );
    let ymd: string | null = pinned ?? null;
    if (pinned) {
      const day = clinicDays.find((d) => d.ymd === pinned);
      if (!day?.working) {
        ymd = nextWorkingYmd(clinicDays, pinned);
      }
    } else {
      ymd = pickOpenAttendanceDay({
        procedureCode: order.procedureCode,
        inPackage: order.inPackage,
        quotaKey: quota.quotaKey,
        dailyCap: quota.dailyCap,
        startYmd: cursorYmd,
        horizonEndYmd,
        workingYmds,
        codesOnDay,
        packageCodesOnDay,
      });
    }
    if (!ymd || ymd > horizonEndYmd || !clinicDays.some((d) => d.ymd === ymd && d.working)) {
      failures.push({
        orderId: order.id,
        procedureCode: order.procedureCode,
        procedureName: order.procedureName,
        reason: "no_slot",
        ymd: ymd ?? horizonEndYmd,
      });
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
    noteOpenAttendanceDay(
      codesOnDay,
      packageCodesOnDay,
      ymd,
      order.procedureCode,
      order.inPackage,
      quota.quotaKey,
    );
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
