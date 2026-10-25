import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { listClinicDays, nextWorkingYmd } from "@/domain/planning/clinic-day";
import {
  addBakuDays,
  bakuDateKey,
  bakuDayBounds,
  bakuHourMinute,
  parseBakuDateTime,
} from "@/lib/baku-day";
import { loadEpisodeDailyCaps, quotaForGuestDay } from "@/domain/sanatorium/block-daily-cap";
import {
  DEFAULT_WORK_HOURS,
  alignDurationToSlotMinutes,
  getSchedulingSettings,
  getTenantWorkHours,
  resolveEffectiveDayEndHour,
  type TenantWorkHours,
} from "@/domain/settings/scheduling-settings";
import { cabinMatchesGuest } from "@/domain/procedure/resource-sex";
import { replaceProcedureAllocations } from "@/domain/procedure/procedure-allocation.service";
import { isAbsentOnYmd, resolveDutyCandidates } from "@/domain/staff/staff-kind";
import type { RotationContextSlot } from "@/lib/procedure-rotation.service";
import {
  nextSearchStart,
  scanProcedureSlots,
  type PlacementFailure,
  type ScanAllocation,
  type ScanOrder,
  type ScanStaff,
} from "@/lib/procedure-slot-scan";
import { resolveProcedureSubstitution } from "@/lib/procedure-substitution.service";
import { sortLinesExamPrefixFirst } from "@/lib/sanatorium-day1";

type PlannedSlot = {
  procedureCode: string;
  procedureName: string;
  durationMin: number;
  resourceCode?: string | null;
  resourceKind?: "ROOM" | "EQUIPMENT" | null;
  procedureTypeId?: string;
  physicalRole: "LOCATION" | "EQUIPMENT";
  bodyPart?: string | null;
  afterLunchAllowed: boolean;
  beforeLunchAllowed: boolean;
  minGapMinutes: number;
  sequenceIndex: number;
  extendedEndHour?: number | null;
  dayStartHour?: number | null;
  dayEndHour?: number | null;
};

function bakuWallTime(ref: Date, hour: number, minute = 0): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return parseBakuDateTime(bakuDateKey(ref), `${hh}:${mm}`);
}

import { effectivePatientRestMinutes } from "@/domain/procedure/resource-occupancy";

/** @internal exported for unit tests — patient rest layer (not cabin idle). */
export function effectiveProcedureGapMinutes(
  templateGap: number | null | undefined,
  patientRestMinutes: number,
): number {
  return effectivePatientRestMinutes(templateGap, patientRestMinutes);
}

/**
 * Validates minimum gap between consecutive same-day patient procedures.
 * Required rest = preceding procedure's patientRestMinutes (layer 3).
 */
export async function validatePatientConsecutiveGap(input: {
  patientRefId: string;
  startAt: Date;
  endAt: Date;
  excludeOrderId?: string;
  /** Rest after the candidate itself when it becomes previous for a later slot (unused for pair check). */
  candidatePatientRestMinutes?: number;
}): Promise<string | null> {
  const { start, end } = bakuDayBounds(bakuDateKey(input.startAt));
  const orders = await prisma.procedureOrder.findMany({
    where: {
      patientRefId: input.patientRefId,
      scheduledAt: { gte: start, lt: end },
      AND: [
        { status: { notIn: ["CANCELLED", "NO_SHOW", "PROPOSED", "UNPAID_MISSED"] } },
        {
          OR: [{ status: { not: "PENDING_PAY" } }, { resourceId: { not: null } }],
        },
      ],
      ...(input.excludeOrderId ? { id: { not: input.excludeOrderId } } : {}),
    },
    select: {
      scheduledAt: true,
      endsAt: true,
      procedureType: { select: { patientRestMinutes: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  type Slot = { start: Date; end: Date; restAfter: number };
  const timeline: Slot[] = [
    ...orders.map((o) => ({
      start: o.scheduledAt,
      end: o.endsAt ?? o.scheduledAt,
      restAfter: o.procedureType?.patientRestMinutes ?? 15,
    })),
    {
      start: input.startAt,
      end: input.endAt,
      restAfter: input.candidatePatientRestMinutes ?? 15,
    },
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1]!;
    const curr = timeline[i]!;
    const need = Math.max(0, prev.restAfter);
    if (need <= 0) continue;
    const gapMs = curr.start.getTime() - prev.end.getTime();
    if (gapMs < need * 60_000) {
      return `Minimum ${need} min patient rest required between consecutive procedures`;
    }
  }
  return null;
}

/** @internal exported for unit tests */
export async function hasProcedureSameDay(
  patientRefId: string,
  procedureCode: string,
  day: Date,
  excludeOrderId?: string,
): Promise<boolean> {
  const { start, end } = bakuDayBounds(bakuDateKey(day));
  const count = await prisma.procedureOrder.count({
    where: {
      patientRefId,
      procedureCode,
      scheduledAt: { gte: start, lt: end },
      OR: [
        { status: { notIn: ["CANCELLED", "PROPOSED", "PENDING_PAY", "UNPAID_MISSED"] } },
        { status: "PENDING_PAY", resourceId: { not: null } },
      ],
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
  });
  return count > 0;
}

/** @internal exported for unit tests */
export function skipLunch(slot: Date, hours: TenantWorkHours = DEFAULT_WORK_HOURS): Date {
  const { hour: h } = bakuHourMinute(slot);
  if (h >= hours.lunchStartHour && h < hours.lunchEndHour) {
    return bakuWallTime(slot, hours.lunchEndHour);
  }
  return slot;
}

/**
 * A procedure must finish before lunch OR start after it. If the [start, start+duration)
 * window would overlap the lunch break, push the start to lunch end.
 * @internal exported for unit tests
 */
export function avoidLunchOverlap(
  start: Date,
  durationMin: number,
  hours: TenantWorkHours = DEFAULT_WORK_HOURS,
): Date {
  const s = skipLunch(start, hours);
  const lunchStart = bakuWallTime(s, hours.lunchStartHour);
  const lunchEnd = bakuWallTime(s, hours.lunchEndHour);
  const end = new Date(s.getTime() + durationMin * 60_000);
  if (s.getTime() < lunchEnd.getTime() && end.getTime() > lunchStart.getTime()) {
    return bakuWallTime(s, hours.lunchEndHour);
  }
  return s;
}

/** @internal exported for unit tests */
export async function nextWorkSlot(
  cursor: Date,
  hours: TenantWorkHours = DEFAULT_WORK_HOURS,
  dayEndHour?: number,
): Promise<Date> {
  const endHour = dayEndHour ?? hours.dayEndHour;
  let d = new Date(cursor);
  d = skipLunch(d, hours);
  if (bakuHourMinute(d).hour >= endHour) {
    const nextYmd = addBakuDays(bakuDateKey(d), 1);
    d = bakuWallTime(bakuDayBounds(nextYmd).start, hours.dayStartHour);
  }
  if (bakuHourMinute(d).hour < hours.dayStartHour) {
    d = bakuWallTime(d, hours.dayStartHour);
  }
  const ymd = bakuDateKey(d);
  const days = await listClinicDays(ymd, addBakuDays(ymd, 21));
  const work = nextWorkingYmd(days, ymd);
  if (work && work !== ymd) {
    return bakuWallTime(bakuDayBounds(work).start, hours.dayStartHour);
  }
  return d;
}

async function expandProposedSlots(instanceId: string): Promise<{
  patientRefId: string;
  patientOrigin: "WALK_IN" | "IN_HOUSE";
  reservationId: string | null;
  clinicalEpisodeId: string | null;
  startsOn: Date;
  slots: PlannedSlot[];
}> {
  const settings = await getSchedulingSettings();
  const { schedulingSlotMinutes: slotMinutes } = settings;
  const instance = await prisma.programInstance.findUnique({
    where: { id: instanceId },
    include: {
      procedureLines: true,
      episode: { include: { patientRef: true } },
      template: { include: { procedures: true } },
    },
  });
  if (!instance?.episode?.patientRefId) {
    return {
      patientRefId: "",
      patientOrigin: "WALK_IN",
      reservationId: null,
      clinicalEpisodeId: null,
      startsOn: new Date(),
      slots: [],
    };
  }

  const patientRefId = instance.episode.patientRefId;
  const clinicalEpisodeId = instance.episodeId;
  const contraindications = await prisma.patientContraindication.findMany({
    where: { episodeId: clinicalEpisodeId },
  });
  const blockedParts = new Set(contraindications.map((c) => c.bodyPart));

  const types = await prisma.procedureType.findMany({
    include: { requirements: true },
  });
  const typeByCode = new Map(types.map((t) => [t.code, t]));

  /** Wave C: exam/intake codes get lowest sequenceIndex so doctor can confirm first 2–3. */
  const sortedLines = sortLinesExamPrefixFirst(instance.procedureLines);

  const planned: PlannedSlot[] = [];
  let seq = 0;
  for (const line of sortedLines) {
    const meta = instance.template.procedures.find(
      (p: { procedureCode: string }) => p.procedureCode === line.procedureCode,
    );
    let code = line.procedureCode;
    let pt = typeByCode.get(code);

    const sub = await resolveProcedureSubstitution({
      procedureCode: code,
      bodyPart: pt?.bodyPart ?? null,
      blockedParts,
    });
    if (sub.substituted) {
      code = sub.procedureCode;
      pt = typeByCode.get(code);
    } else if (pt?.bodyPart && blockedParts.has(pt.bodyPart)) {
      continue;
    }
    if (!pt) continue;

    const physicalReq = pt.requirements.find(
      (r) => r.role === "LOCATION" || r.role === "EQUIPMENT",
    );
    const physicalRole: "LOCATION" | "EQUIPMENT" =
      physicalReq?.role === "LOCATION"
        ? "LOCATION"
        : physicalReq?.role === "EQUIPMENT"
          ? "EQUIPMENT"
          : pt.resourceKind === "ROOM"
            ? "LOCATION"
            : "EQUIPMENT";

    for (let i = 0; i < line.quotaTotal; i++) {
      planned.push({
        procedureCode: code,
        procedureName: meta?.procedureName ?? pt.name ?? code,
        durationMin: alignDurationToSlotMinutes(pt.durationMin ?? slotMinutes, slotMinutes),
        resourceCode: physicalReq?.resourceCode ?? pt.resourceCode,
        resourceKind: physicalReq?.resourceKind ?? pt.resourceKind ?? null,
        procedureTypeId: pt.id,
        physicalRole,
        bodyPart: pt.bodyPart ?? null,
        afterLunchAllowed: pt.afterLunchAllowed ?? true,
        beforeLunchAllowed: pt.beforeLunchAllowed ?? true,
        minGapMinutes: effectiveProcedureGapMinutes(
          meta?.minGapMinutes,
          pt.patientRestMinutes ?? 15,
        ),
        sequenceIndex: seq++,
        extendedEndHour: pt.extendedEndHour,
        dayStartHour: pt.dayStartHour,
        dayEndHour: pt.dayEndHour,
      });
    }
  }

  return {
    patientRefId,
    patientOrigin: instance.episode.patientOrigin,
    reservationId: instance.reservationId,
    clinicalEpisodeId,
    startsOn: instance.startsOn,
    slots: planned,
  };
}

/**
 * @deprecated CLI-57 — do not pre-expand package into PROPOSED. Use package-assign API.
 * Returns 0 and does not create orders.
 */
export async function buildProposedPlan(_instanceId: string): Promise<number> {
  console.warn(
    "[clinic] buildProposedPlan is deprecated (CLI-57); use package-assign instead",
  );
  return 0;
}

/**
 * @deprecated CLI-57 — alias of buildProposedPlan no-op.
 */
export async function planProgramFifo(
  instanceId: string,
  _startsOn: Date,
): Promise<number> {
  return buildProposedPlan(instanceId);
}

/**
 * Place confirmed PROPOSED orders onto resources (FIFO).
 * Reads already-placed patient orders as rotation/compat context; does not move them.
 */
export type PlaceConfirmedResult = {
  placed: number;
  placedIds: string[];
  /** Procedure names whose type has no resolvable LOCATION/EQUIPMENT resource. */
  missingCabinNames: string[];
  failures: PlacementFailure[];
};

export async function placeConfirmedProcedures(
  orderIds: string[],
  opts?: {
    confirmedByUserId?: string;
    atomic?: boolean;
    scheduleBefore?: Date | null;
    startAt?: Date | null;
    pinYmdByOrderId?: Record<string, string>;
    /** When true, a pin on a closed day is a miss — do not remap to the next working day. */
    pinStrict?: boolean;
  },
): Promise<PlaceConfirmedResult> {
  if (orderIds.length === 0) return { placed: 0, placedIds: [], missingCabinNames: [], failures: [] };

  const settings = await getSchedulingSettings();
  const { schedulingSlotMinutes: slotMinutes } = settings;
  const workHours = await getTenantWorkHours();

  const orders = await prisma.procedureOrder.findMany({
    where: { id: { in: orderIds }, status: "PROPOSED" },
    include: { procedureType: { include: { requirements: true } } },
    orderBy: [{ sequenceIndex: "asc" }, { scheduledAt: "asc" }],
  });
  if (orders.length === 0) return { placed: 0, placedIds: [], missingCabinNames: [], failures: [] };

  const patient = await prisma.patientRef.findUnique({
    where: { id: orders[0].patientRefId },
    select: { sex: true },
  });
  const guestSex = patient?.sex ?? null;

  const patientRefId = orders[0].patientRefId;
  const episodeId = orders[0].clinicalEpisodeId;
  const dailyCaps = episodeId ? await loadEpisodeDailyCaps(episodeId) : null;
  if (episodeId) {
    const episode = await prisma.clinicalEpisode.findUnique({
      where: { id: episodeId },
      select: { anamnesisText: true },
    });
    const { episodeAnamnesisDenied, ANAMNESIS_REQUIRED } = await import(
      "@/domain/sanatorium/episode-gates"
    );
    const denied = episodeAnamnesisDenied(episode?.anamnesisText);
    if (denied) {
      const err = new Error(denied);
      (err as Error & { code?: string }).code = ANAMNESIS_REQUIRED;
      throw err;
    }
  }
  const rules = await prisma.procedureRule.findMany();
  const types = await prisma.procedureType.findMany({
    include: { requirements: true },
  });
  const typeByCode = new Map(types.map((t) => [t.code, t]));

  const existing = await prisma.procedureOrder.findMany({
    where: {
      patientRefId,
      OR: [
        { status: { notIn: ["CANCELLED", "PROPOSED", "PENDING_PAY", "UNPAID_MISSED"] } },
        { status: "PENDING_PAY", resourceId: { not: null } },
      ],
    },
    select: {
      status: true,
      procedureCode: true,
      bodyPart: true,
      scheduledAt: true,
      endsAt: true,
      inPackage: true,
      packageQuotaCode: true,
      resourceId: true,
      procedureType: { select: { patientRestMinutes: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const patientSlots = existing.map((row) => {
    const quota = quotaForGuestDay(dailyCaps, {
      inPackage: row.inPackage === true,
      packageQuotaCode: row.packageQuotaCode,
      procedureCode: row.procedureCode,
    });
    return {
      code: row.procedureCode,
      bodyPart: row.bodyPart,
      start: row.scheduledAt,
      end: row.endsAt ?? row.scheduledAt,
      patientRestMinutes: row.procedureType?.patientRestMinutes ?? 15,
      inPackage: row.inPackage === true,
      quotaKey: quota.quotaKey,
      countsForRest: row.status !== "NO_SHOW",
      holdsGuestDay: row.inPackage !== true && Boolean(row.resourceId),
    };
  });
  const rotationContext: RotationContextSlot[] = existing
    .filter((row) => row.status !== "NO_SHOW")
    .map((row) => ({
      procedureCode: row.procedureCode,
      bodyPart: row.bodyPart,
      startAt: row.scheduledAt,
      endAt: row.endsAt ?? row.scheduledAt,
    }));

  const now =
    opts?.startAt && !Number.isNaN(opts.startAt.getTime())
      ? opts.startAt
      : nextSearchStart(new Date(), workHours.dayStartHour, workHours.dayEndHour);
  const today = bakuDateKey(now);
  let horizonEndYmd = addBakuDays(today, 21);
  if (opts?.scheduleBefore && !Number.isNaN(opts.scheduleBefore.getTime())) {
    horizonEndYmd = bakuDateKey(opts.scheduleBefore);
  }
  const pinYmdByOrderId = { ...(opts?.pinYmdByOrderId ?? {}) };
  for (const pin of Object.values(pinYmdByOrderId)) {
    if (pin && pin >= horizonEndYmd) horizonEndYmd = addBakuDays(pin, 1);
  }
  const clinicDays = await listClinicDays(today, addBakuDays(horizonEndYmd, 7));
  const closedYmds = new Set(clinicDays.filter((day) => !day.working).map((day) => day.ymd));
  if (!opts?.pinStrict) {
    for (const [orderId, pin] of Object.entries(pinYmdByOrderId)) {
      if (!pin || !closedYmds.has(pin)) continue;
      const next = nextWorkingYmd(clinicDays, pin);
      if (next) pinYmdByOrderId[orderId] = next;
    }
  }
  for (const pin of Object.values(pinYmdByOrderId)) {
    if (pin && pin >= horizonEndYmd) horizonEndYmd = addBakuDays(pin, 1);
  }

  const [rotationRules, compatibilityRules] = await Promise.all([
    prisma.procedureRotationRule.findMany({ where: { active: true } }),
    prisma.procedureCompatibilityRule.findMany({ where: { active: true } }),
  ]);

  const untyped: PlacementFailure[] = [];
  const scanOrders: Array<
    ScanOrder & { resourceCodeList: string[]; extendedEndHour: number | null }
  > = [];
  const resourceCodes = new Set<string>();
  for (const order of orders) {
    const pt = order.procedureType ?? typeByCode.get(order.procedureCode);
    if (!pt) {
      untyped.push({
        orderId: order.id,
        procedureCode: order.procedureCode,
        procedureName: order.procedureName?.trim() || order.procedureCode,
        reason: "no_slot",
        ymd: order.scheduledAt ? bakuDateKey(order.scheduledAt) : undefined,
      });
      continue;
    }
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
    const codes = new Set<string>();
    for (const req of pt.requirements ?? []) {
      if (req.role !== "LOCATION" && req.role !== "EQUIPMENT") continue;
      const code = req.resourceCode?.trim();
      if (code) codes.add(code);
    }
    if (codes.size === 0 && pt.resourceCode?.trim()) codes.add(pt.resourceCode.trim());
    for (const code of codes) resourceCodes.add(code);
    const staffReq =
      pt.requirements?.find((req) => req.role === "STAFF" && req.staffMode === "SOFT") ??
      pt.requirements?.find((req) => req.role === "STAFF");
    const typeHours = {
      ...workHours,
      dayStartHour: pt.dayStartHour ?? workHours.dayStartHour,
      dayEndHour: pt.dayEndHour ?? workHours.dayEndHour,
    };
    scanOrders.push({
      id: order.id,
      organizationId: order.organizationId,
      procedureCode: order.procedureCode,
      procedureName: order.procedureName?.trim() || order.procedureCode,
      bodyPart: order.bodyPart ?? pt.bodyPart ?? null,
      inPackage: order.inPackage === true,
      ...(() => {
        const quota = quotaForGuestDay(dailyCaps, {
          inPackage: order.inPackage === true,
          packageQuotaCode: order.packageQuotaCode,
          procedureCode: order.procedureCode,
        });
        return {
          quotaKey: quota.quotaKey,
          dailyCap: order.inPackage ? quota.dailyCap : quota.shareGuestDayCap ? quota.dailyCap : null,
          shareGuestDayCap: quota.shareGuestDayCap,
        };
      })(),
      durationMin: alignDurationToSlotMinutes(pt.durationMin ?? slotMinutes, slotMinutes),
      dayEndHour: 0,
      patientRestMinutes: pt.patientRestMinutes ?? 15,
      resourceGapMinutes: pt.resourceGapMinutes ?? 5,
      afterLunchAllowed: pt.afterLunchAllowed ?? true,
      beforeLunchAllowed: pt.beforeLunchAllowed ?? true,
      typeHours,
      physicalRole,
      resources: [],
      staffMode: staffReq?.staffMode === "SOFT" ? "SOFT" : "HARD",
      procedureTypeId: pt.id,
      resourceCodeList: [...codes].sort(),
      extendedEndHour: pt.extendedEndHour,
      pinYmd: pinYmdByOrderId[order.id],
    });
  }

  const resourceRows = resourceCodes.size
    ? await prisma.resource.findMany({ where: { code: { in: [...resourceCodes] } } })
    : [];
  const resourceByCode = new Map(resourceRows.map((row) => [row.code, row]));
  const sexFailures: PlacementFailure[] = [];
  for (const order of scanOrders) {
    const listed = order.resourceCodeList
      .map((code) => resourceByCode.get(code))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    const matching = listed.filter((row) => cabinMatchesGuest(row.sexAudience, guestSex));
    if (listed.length > 0 && matching.length === 0) {
      sexFailures.push({
        orderId: order.id,
        procedureCode: order.procedureCode,
        procedureName: order.procedureName,
        reason: "cabin_sex",
        ymd: today,
      });
    }
    order.resources = matching.map((row) => ({
      id: row.id,
      capacity: row.capacity,
      role: order.physicalRole,
    }));
    order.dayEndHour = resolveEffectiveDayEndHour(order.typeHours, {
      procedureExtendedEndHour: order.extendedEndHour,
      resourceExtendedEndHour: resourceByCode.get(order.resourceCodeList[0] ?? "")?.extendedEndHour,
    });
  }

  const typeIds = [...new Set(scanOrders.map((order) => order.procedureTypeId))];
  const staffByTypeAndYmd = await loadStaffByDayForScan(typeIds, today, horizonEndYmd);
  const staffIds = [...new Set([...staffByTypeAndYmd.values()].flat().map((person) => person.id))];
  const resourceIds = [...new Set(scanOrders.flatMap((order) => order.resources.map((row) => row.id)))];
  const allocations = await loadOccupancyForScan(resourceIds, staffIds, today, horizonEndYmd);

  const scanned = scanProcedureSlots({
    orders: scanOrders.filter((order) => !sexFailures.some((row) => row.orderId === order.id)),
    now,
    slotMinutes,
    packageCap: 12,
    horizonEndYmd,
    closedYmds,
    staffByTypeAndYmd,
    rules,
    rotationRules,
    compatibilityRules,
    patientSlots,
    rotationContext,
    allocations,
  });

  const failures = [...untyped, ...sexFailures, ...scanned.failures];
  const missingCabinNames = [
    ...new Set(failures.filter((row) => row.reason === "no_cabin").map((row) => row.procedureName)),
  ];
  if (opts?.atomic && failures.length > 0) {
    return { placed: 0, placedIds: [], missingCabinNames, failures };
  }

  const prescribedByPractitionerId = opts?.confirmedByUserId
      ? (
          await prisma.practitioner.findFirst({
            where: { userId: opts.confirmedByUserId },
            select: { id: true },
          })
        )?.id ?? null
      : null;
  const orderById = new Map(orders.map((order) => [order.id, order]));
  for (const row of scanned.planned) {
    const order = orderById.get(row.orderId);
    const accessCode = order?.accessCode?.trim() || (await generateUniqueAccessCode(row.organizationId));
    await prisma.procedureOrder.update({
      where: { id: row.orderId },
      data: {
        status: "SCHEDULED",
        scheduledAt: row.slotStart,
        endsAt: row.slotEnd,
        resourceId: row.resourceId,
        confirmedAt: new Date(),
        confirmedByUserId: opts?.confirmedByUserId,
        prescribedByPractitionerId,
        accessCode,
        bodyPart: row.bodyPart ?? undefined,
      },
    });
    await replaceProcedureAllocations(row.orderId, [
      {
        role: row.physicalRole,
        resourceId: row.resourceId,
        startsAt: row.slotStart,
        endsAt: row.slotEnd,
      },
      {
        role: "STAFF",
        practitionerId: row.staffId,
        startsAt: row.slotStart,
        endsAt: row.slotEnd,
      },
    ]);
  }

  return {
    placed: scanned.planned.length,
    placedIds: scanned.planned.map((row) => row.orderId),
    missingCabinNames,
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

export async function loadOccupancyForScan(
  resourceIds: string[],
  staffIds: string[],
  fromYmd: string,
  horizonEndYmd: string,
): Promise<ScanAllocation[]> {
  if (resourceIds.length === 0 && staffIds.length === 0) return [];
  const from = bakuDayBounds(fromYmd).start;
  const to = bakuDayBounds(horizonEndYmd).start;
  const lookback = new Date(from.getTime() - 240 * 60_000);
  const rows = await prisma.procedureAllocation.findMany({
    where: {
      startsAt: { lt: to },
      endsAt: { gt: lookback },
      procedureOrder: { status: { notIn: ["CANCELLED", "NO_SHOW", "PROPOSED", "UNPAID_MISSED"] } },
      OR: [
        ...(resourceIds.length
          ? [{ role: { in: ["LOCATION" as const, "EQUIPMENT" as const] }, resourceId: { in: resourceIds } }]
          : []),
        ...(staffIds.length ? [{ role: "STAFF" as const, practitionerId: { in: staffIds } }] : []),
      ],
    },
    select: {
      role: true,
      resourceId: true,
      practitionerId: true,
      startsAt: true,
      endsAt: true,
      procedureOrderId: true,
      procedureOrder: { select: { procedureType: { select: { resourceGapMinutes: true } } } },
    },
  });
  return rows.map((row) => ({
    role: row.role,
    resourceId: row.resourceId,
    practitionerId: row.practitionerId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    procedureOrderId: row.procedureOrderId,
    resourceGapMinutes: row.procedureOrder.procedureType?.resourceGapMinutes ?? 5,
  }));
}

export async function loadStaffByDayForScan(
  typeIds: string[],
  fromYmd: string,
  horizonEndYmd: string,
): Promise<Map<string, ScanStaff[]>> {
  const out = new Map<string, ScanStaff[]>();
  if (typeIds.length === 0 || fromYmd >= horizonEndYmd) return out;

  const skills = await prisma.practitionerSkill.findMany({
    where: {
      procedureTypeId: { in: typeIds },
      active: true,
      practitioner: { active: true, staffKind: { in: ["DOCTOR", "NURSE", "BATH", "MASSAGE"] } },
    },
    include: { practitioner: { select: { id: true, fullName: true, code: true } } },
  });
  const skilledByType = new Map<string, ScanStaff[]>();
  for (const typeId of typeIds) skilledByType.set(typeId, []);
  for (const skill of skills) {
    const list = skilledByType.get(skill.procedureTypeId) ?? [];
    list.push(skill.practitioner);
    skilledByType.set(skill.procedureTypeId, list);
  }
  const needsFallback = typeIds.some((typeId) => (skilledByType.get(typeId) ?? []).length === 0);
  const fallback = needsFallback
    ? await prisma.practitioner.findMany({
        where: { active: true, staffKind: { in: ["DOCTOR", "NURSE", "BATH", "MASSAGE"] } },
        orderBy: { code: "asc" },
        take: 20,
        select: { id: true, fullName: true, code: true },
      })
    : [];
  for (const typeId of typeIds) {
    if ((skilledByType.get(typeId) ?? []).length === 0) skilledByType.set(typeId, fallback);
  }

  const months = new Set<string>();
  let cursor = fromYmd;
  while (cursor < horizonEndYmd) {
    months.add(cursor.slice(0, 7));
    cursor = addBakuDays(cursor, 1);
  }
  const rosters = await prisma.staffDutyRoster.findMany({
    where: {
      organizationId: requestOrganizationId(),
      staffKind: "NURSE",
      yearMonth: { in: [...months] },
    },
    include: {
      lines: {
        include: { practitioner: { select: { id: true, code: true, fullName: true, active: true } } },
      },
      dayOverrides: {
        include: { practitioner: { select: { id: true, code: true, fullName: true, active: true } } },
      },
    },
  });
  const personIds = new Set<string>(fallback.map((person) => person.id));
  for (const roster of rosters) {
    for (const line of roster.lines) {
      if (line.practitioner?.active) personIds.add(line.practitioner.id);
    }
    for (const ov of roster.dayOverrides) {
      if (ov.practitioner?.active) personIds.add(ov.practitioner.id);
    }
  }
  const from = bakuDayBounds(fromYmd).start;
  const to = bakuDayBounds(horizonEndYmd).start;
  const [absences, dayOffs] = await Promise.all([
    personIds.size
      ? prisma.staffAbsence.findMany({
          where: { practitionerId: { in: [...personIds] }, startsOn: { lte: to }, endsOn: { gte: from } },
          select: { practitionerId: true, startsOn: true, endsOn: true },
        })
      : [],
    personIds.size
      ? prisma.practitionerScheduleException.findMany({
          where: {
            practitionerId: { in: [...personIds] },
            kind: "DAY_OFF",
            date: { gte: from, lt: to },
          },
          select: { practitionerId: true, date: true },
        })
      : [],
  ]);
  const absenceByPerson = new Map<string, Array<{ startsOn: Date; endsOn: Date }>>();
  for (const row of absences) {
    const list = absenceByPerson.get(row.practitionerId) ?? [];
    list.push(row);
    absenceByPerson.set(row.practitionerId, list);
  }
  const dayOffKey = new Set(dayOffs.map((row) => `${row.practitionerId}|${bakuDateKey(row.date)}`));

  const ymds: string[] = [];
  cursor = fromYmd;
  while (cursor < horizonEndYmd) {
    ymds.push(cursor);
    cursor = addBakuDays(cursor, 1);
  }
  for (const typeId of typeIds) {
    const skilled = skilledByType.get(typeId) ?? [];
    for (const ymd of ymds) {
      const yearMonth = ymd.slice(0, 7);
      const roster = rosters.find((row) => row.yearMonth === yearMonth) ?? null;
      const postedList = (roster?.lines ?? [])
        .filter((line) => line.procedureTypeId === typeId && line.practitioner?.active)
        .map((line) => line.practitioner!)
        .map((person) => ({ id: person.id, code: person.code, fullName: person.fullName }));
      const absentIds = postedList
        .filter(
          (person) =>
            dayOffKey.has(`${person.id}|${ymd}`) ||
            isAbsentOnYmd(absenceByPerson.get(person.id) ?? [], ymd),
        )
        .map((person) => person.id);
      const ov = roster?.dayOverrides.find(
        (row) => row.procedureTypeId === typeId && bakuDateKey(row.dutyDate) === ymd && row.practitioner?.active,
      );
      const dayOverride = ov?.practitioner
        ? { id: ov.practitioner.id, code: ov.practitioner.code, fullName: ov.practitioner.fullName }
        : null;
      const people = resolveDutyCandidates({
        rosterStatus: roster?.status ?? null,
        postedPractitionerId: postedList[0]?.id ?? null,
        posted: postedList[0] ?? null,
        postedStaff: postedList,
        absentIds,
        postedAbsent: postedList.length > 0 && absentIds.length === postedList.length,
        skilled,
        dayOverridePractitionerId: dayOverride?.id ?? null,
        dayOverride,
      });
      out.set(`${typeId}|${ymd}`, people);
    }
  }
  return out;
}
