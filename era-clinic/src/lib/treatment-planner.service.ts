import { prisma } from "@/lib/prisma";
import { validateProcedureCompatibility } from "@/lib/procedure-compatibility.service";
import { isElectiveSchedulingAllowed, nextSchedulingDay } from "@/lib/production-calendar";
import { bakuDayBounds } from "@/domain/ops/day-summary.service";
import { bakuDateKey } from "@/domain/patient/patient-timeline.service";
import {
  DEFAULT_WORK_HOURS,
  alignDurationToSlotMinutes,
  getSchedulingSettings,
  getTenantWorkHours,
  resolveEffectiveDayEndHour,
  type TenantWorkHours,
} from "@/domain/settings/scheduling-settings";
import {
  countResourceAllocations,
  findSkilledFreePractitioner,
  replaceProcedureAllocations,
  resolvePhysicalResource,
} from "@/domain/procedure/procedure-allocation.service";
import {
  evaluateRotation,
  type RotationContextSlot,
} from "@/lib/procedure-rotation.service";
import { resolveProcedureSubstitution } from "@/lib/procedure-substitution.service";

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
  minGapMinutes: number;
  sequenceIndex: number;
  extendedEndHour?: number | null;
};

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60_000);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function dayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** @internal exported for unit tests */
export function effectiveProcedureGapMinutes(
  templateGap: number | null | undefined,
  defaultGapMinutes: number,
): number {
  return Math.max(templateGap ?? 0, defaultGapMinutes);
}

/** Validates minimum gap between consecutive same-day patient procedures. */
export async function validatePatientConsecutiveGap(input: {
  patientRefId: string;
  startAt: Date;
  endAt: Date;
  excludeOrderId?: string;
  minGapMinutes?: number;
}): Promise<string | null> {
  const settings = await getSchedulingSettings();
  const minGap = input.minGapMinutes ?? settings.defaultProcedureGapMinutes;
  if (minGap <= 0) return null;

  const { start, end } = bakuDayBounds(bakuDateKey(input.startAt));
  const orders = await prisma.procedureOrder.findMany({
    where: {
      patientRefId: input.patientRefId,
      scheduledAt: { gte: start, lt: end },
      status: { notIn: ["CANCELLED", "NO_SHOW", "PROPOSED"] },
      ...(input.excludeOrderId ? { id: { not: input.excludeOrderId } } : {}),
    },
    select: { scheduledAt: true, endsAt: true },
    orderBy: { scheduledAt: "asc" },
  });

  type Slot = { start: Date; end: Date };
  const timeline: Slot[] = [
    ...orders.map((o) => ({
      start: o.scheduledAt,
      end: o.endsAt ?? o.scheduledAt,
    })),
    { start: input.startAt, end: input.endAt },
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1];
    const curr = timeline[i];
    const gapMs = curr.start.getTime() - prev.end.getTime();
    if (gapMs < minGap * 60_000) {
      return `Minimum ${minGap} min gap required between consecutive procedures`;
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
  const { start, end } = dayBounds(day);
  const count = await prisma.procedureOrder.count({
    where: {
      patientRefId,
      procedureCode,
      scheduledAt: { gte: start, lt: end },
      status: { notIn: ["CANCELLED", "PROPOSED"] },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
  });
  return count > 0;
}

/** @internal exported for unit tests */
export function skipLunch(slot: Date, hours: TenantWorkHours = DEFAULT_WORK_HOURS): Date {
  const h = slot.getHours();
  if (h >= hours.lunchStartHour && h < hours.lunchEndHour) {
    const out = new Date(slot);
    out.setHours(hours.lunchEndHour, 0, 0, 0);
    return out;
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
  const lunchStart = new Date(s);
  lunchStart.setHours(hours.lunchStartHour, 0, 0, 0);
  const lunchEnd = new Date(s);
  lunchEnd.setHours(hours.lunchEndHour, 0, 0, 0);
  const end = new Date(s.getTime() + durationMin * 60_000);
  if (s.getTime() < lunchEnd.getTime() && end.getTime() > lunchStart.getTime()) {
    const out = new Date(s);
    out.setHours(hours.lunchEndHour, 0, 0, 0);
    return out;
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
  if (d.getHours() >= endHour) {
    d.setDate(d.getDate() + 1);
    d.setHours(hours.dayStartHour, 0, 0, 0);
    d = await nextSchedulingDay(d);
    d.setHours(hours.dayStartHour, 0, 0, 0);
  }
  if (d.getHours() < hours.dayStartHour) {
    d.setHours(hours.dayStartHour, 0, 0, 0);
  }
  if (!(await isElectiveSchedulingAllowed(d))) {
    const next = await nextSchedulingDay(d);
    next.setHours(hours.dayStartHour, 0, 0, 0);
    return next;
  }
  return d;
}

async function expandProposedSlots(instanceId: string): Promise<{
  patientRefId: string;
  patientOrigin: "WALK_IN" | "IN_HOUSE";
  reservationId: string | null;
  startsOn: Date;
  slots: PlannedSlot[];
}> {
  const settings = await getSchedulingSettings();
  const { schedulingSlotMinutes: slotMinutes, defaultProcedureGapMinutes } = settings;
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
      startsOn: new Date(),
      slots: [],
    };
  }

  const patientRefId = instance.episode.patientRefId;
  const contraindications = await prisma.patientContraindication.findMany({
    where: { patientRefId },
  });
  const blockedParts = new Set(contraindications.map((c) => c.bodyPart));

  const types = await prisma.procedureType.findMany({
    include: { requirements: true },
  });
  const typeByCode = new Map(types.map((t) => [t.code, t]));

  const planned: PlannedSlot[] = [];
  let seq = 0;
  for (const line of instance.procedureLines) {
    const meta = instance.template.procedures.find(
      (p) => p.procedureCode === line.procedureCode,
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
        minGapMinutes: effectiveProcedureGapMinutes(
          meta?.minGapMinutes,
          defaultProcedureGapMinutes,
        ),
        sequenceIndex: seq++,
        extendedEndHour: pt.extendedEndHour,
      });
    }
  }

  return {
    patientRefId,
    patientOrigin: instance.episode.patientOrigin,
    reservationId: instance.reservationId,
    startsOn: instance.startsOn,
    slots: planned,
  };
}

/**
 * Build PROPOSED procedure orders from program quotas (no resource bookings).
 * Doctor must confirm before placeConfirmedProcedures places them on the matrix.
 */
export async function buildProposedPlan(instanceId: string): Promise<number> {
  const workHours = await getTenantWorkHours();
  const { patientRefId, patientOrigin, reservationId, startsOn, slots } =
    await expandProposedSlots(instanceId);
  if (!patientRefId || slots.length === 0) return 0;

  // Idempotent: drop previous unconfirmed PROPOSED for this reservation/patient from this program run
  await prisma.procedureOrder.deleteMany({
    where: {
      patientRefId,
      status: "PROPOSED",
      ...(reservationId ? { reservationId } : {}),
    },
  });

  let cursor = new Date(startsOn);
  cursor.setHours(workHours.dayStartHour, 0, 0, 0);
  let created = 0;

  for (const item of slots) {
    if (!item.procedureTypeId) continue;
    const proposedAt = await nextWorkSlot(cursor, workHours);
    await prisma.procedureOrder.create({
      data: {
        patientRefId,
        procedureCode: item.procedureCode,
        procedureName: item.procedureName,
        procedureTypeId: item.procedureTypeId,
        scheduledAt: proposedAt,
        endsAt: addMinutes(proposedAt, item.durationMin),
        sequenceIndex: item.sequenceIndex,
        bodyPart: item.bodyPart ?? undefined,
        patientOrigin,
        reservationId: reservationId ?? undefined,
        status: "PROPOSED",
      },
    });
    cursor = addMinutes(proposedAt, item.durationMin + item.minGapMinutes);
    created++;
  }

  return created;
}

/**
 * Place confirmed PROPOSED orders onto resources (FIFO).
 * Reads already-placed patient orders as rotation/compat context; does not move them.
 */
export async function placeConfirmedProcedures(
  orderIds: string[],
  opts?: { confirmedByUserId?: string },
): Promise<number> {
  if (orderIds.length === 0) return 0;

  const settings = await getSchedulingSettings();
  const { schedulingSlotMinutes: slotMinutes, defaultProcedureGapMinutes } = settings;
  const workHours = await getTenantWorkHours();

  const orders = await prisma.procedureOrder.findMany({
    where: { id: { in: orderIds }, status: "PROPOSED" },
    include: { procedureType: { include: { requirements: true } } },
    orderBy: [{ sequenceIndex: "asc" }, { scheduledAt: "asc" }],
  });
  if (orders.length === 0) return 0;

  const patientRefId = orders[0].patientRefId;
  const rules = await prisma.procedureRule.findMany();
  const types = await prisma.procedureType.findMany({
    include: { requirements: true },
  });
  const typeByCode = new Map(types.map((t) => [t.code, t]));

  const existing = await prisma.procedureOrder.findMany({
    where: {
      patientRefId,
      status: { in: ["SCHEDULED", "CHECKED_IN", "COMPLETED"] },
    },
    select: {
      procedureCode: true,
      bodyPart: true,
      scheduledAt: true,
      endsAt: true,
    },
    orderBy: { scheduledAt: "asc" },
  });

  const scheduledPatient: {
    code: string;
    bodyPart?: string | null;
    start: Date;
    end: Date;
  }[] = existing.map((e) => ({
    code: e.procedureCode,
    bodyPart: e.bodyPart,
    start: e.scheduledAt,
    end: e.endsAt ?? e.scheduledAt,
  }));

  const rotationContext: RotationContextSlot[] = scheduledPatient.map((s) => ({
    procedureCode: s.code,
    bodyPart: s.bodyPart,
    startAt: s.start,
    endAt: s.end,
  }));

  let cursor =
    scheduledPatient.length > 0
      ? addMinutes(
          scheduledPatient[scheduledPatient.length - 1].end,
          defaultProcedureGapMinutes,
        )
      : new Date(orders[0].scheduledAt);
  cursor.setHours(
    Math.max(cursor.getHours(), workHours.dayStartHour),
    cursor.getMinutes(),
    0,
    0,
  );

  let placed = 0;
  const now = new Date();

  for (const order of orders) {
    const pt = order.procedureType ?? typeByCode.get(order.procedureCode);
    if (!pt) continue;

    const physicalReq = pt.requirements?.find(
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

    const resource = await resolvePhysicalResource({
      resourceCode: physicalReq?.resourceCode ?? pt.resourceCode,
      resourceKind: physicalReq?.resourceKind ?? pt.resourceKind ?? null,
    });
    if (!resource) continue;

    const duration = alignDurationToSlotMinutes(pt.durationMin ?? slotMinutes, slotMinutes);
    const dayEnd = resolveEffectiveDayEndHour(workHours, {
      procedureExtendedEndHour: pt.extendedEndHour,
      resourceExtendedEndHour: resource.extendedEndHour,
    });

    let slotStart = await nextWorkSlot(cursor, workHours, dayEnd);
    if (!pt.afterLunchAllowed && slotStart.getHours() >= workHours.lunchEndHour) {
      slotStart.setDate(slotStart.getDate() + 1);
      slotStart.setHours(workHours.dayStartHour, 0, 0, 0);
    }

    for (let attempt = 0; attempt < 96; attempt++) {
      slotStart = avoidLunchOverlap(slotStart, duration, workHours);
      if (!pt.afterLunchAllowed && slotStart.getHours() >= workHours.lunchEndHour) {
        slotStart.setDate(slotStart.getDate() + 1);
        slotStart.setHours(workHours.dayStartHour, 0, 0, 0);
        slotStart = await nextWorkSlot(slotStart, workHours, dayEnd);
        continue;
      }

      const slotEnd = addMinutes(slotStart, duration);
      if (slotEnd.getHours() > dayEnd || (slotEnd.getHours() === dayEnd && slotEnd.getMinutes() > 0)) {
        slotStart = addMinutes(slotStart, slotMinutes);
        slotStart = await nextWorkSlot(slotStart, workHours, dayEnd);
        continue;
      }

      if (await hasProcedureSameDay(patientRefId, order.procedureCode, slotStart, order.id)) {
        slotStart = addMinutes(slotStart, slotMinutes);
        slotStart = await nextWorkSlot(slotStart, workHours, dayEnd);
        continue;
      }

      const rotation = await evaluateRotation({
        candidateCode: order.procedureCode,
        bodyPart: order.bodyPart ?? pt.bodyPart,
        day: slotStart,
        context: rotationContext,
      });
      if (!rotation.ok) {
        // Shift to next day when consecutive-day rule blocks
        slotStart.setDate(slotStart.getDate() + 1);
        slotStart.setHours(workHours.dayStartHour, 0, 0, 0);
        slotStart = await nextWorkSlot(slotStart, workHours, dayEnd);
        continue;
      }

      const used = await countResourceAllocations(
        resource.id,
        slotStart,
        slotEnd,
        undefined,
        defaultProcedureGapMinutes,
      );
      const busy = used >= resource.capacity;

      const staffMode =
        pt.requirements?.find((r) => r.role === "STAFF")?.staffMode ?? "HARD";
      const staff = await findSkilledFreePractitioner({
        procedureTypeId: pt.id,
        startsAt: slotStart,
        endsAt: slotEnd,
        staffMode,
      });
      if (!staff) {
        slotStart = addMinutes(slotStart, slotMinutes);
        slotStart = await nextWorkSlot(slotStart, workHours, dayEnd);
        continue;
      }

      const ruleOk = rules.every((rule) => {
        if (rule.kind === "MUTUAL_EXCLUSION") {
          const hasBefore = scheduledPatient.some(
            (s) =>
              s.code === rule.beforeCode &&
              overlaps(s.start, s.end, slotStart, slotEnd),
          );
          const hasAfter = scheduledPatient.some(
            (s) =>
              s.code === rule.afterCode &&
              overlaps(s.start, s.end, slotStart, slotEnd),
          );
          if (hasBefore && hasAfter) return false;
        }
        if (rule.kind === "SEQUENCE_GAP" && rule.afterCode === order.procedureCode) {
          const prev = scheduledPatient.find((s) => s.code === rule.beforeCode);
          if (prev) {
            const gapMs = slotStart.getTime() - prev.end.getTime();
            if (gapMs < (rule.minGapMinutes ?? 0) * 60_000) return false;
          }
        }
        return true;
      });

      const compatViolations = await validateProcedureCompatibility({
        candidateCode: order.procedureCode,
        startAt: slotStart,
        endAt: slotEnd,
        existing: scheduledPatient.map((s) => ({
          procedureCode: s.code,
          startAt: s.start,
          endAt: s.end,
        })),
      });
      const compatOk = compatViolations.length === 0;

      const gapErr = await validatePatientConsecutiveGap({
        patientRefId,
        startAt: slotStart,
        endAt: slotEnd,
        excludeOrderId: order.id,
        minGapMinutes: defaultProcedureGapMinutes,
      });

      if (!busy && ruleOk && compatOk && !gapErr) {
        await prisma.procedureOrder.update({
          where: { id: order.id },
          data: {
            status: "SCHEDULED",
            scheduledAt: slotStart,
            endsAt: slotEnd,
            resourceId: resource.id,
            confirmedAt: now,
            confirmedByUserId: opts?.confirmedByUserId,
            bodyPart: order.bodyPart ?? pt.bodyPart ?? undefined,
          },
        });
        await replaceProcedureAllocations(order.id, [
          {
            role: physicalRole,
            resourceId: resource.id,
            startsAt: slotStart,
            endsAt: slotEnd,
          },
          {
            role: "STAFF",
            practitionerId: staff.id,
            startsAt: slotStart,
            endsAt: slotEnd,
          },
        ]);

        const placedSlot = {
          code: order.procedureCode,
          bodyPart: order.bodyPart ?? pt.bodyPart,
          start: slotStart,
          end: slotEnd,
        };
        scheduledPatient.push(placedSlot);
        rotationContext.push({
          procedureCode: placedSlot.code,
          bodyPart: placedSlot.bodyPart,
          startAt: placedSlot.start,
          endAt: placedSlot.end,
        });
        cursor = addMinutes(slotEnd, defaultProcedureGapMinutes);
        placed++;
        break;
      }
      slotStart = addMinutes(slotStart, slotMinutes);
      slotStart = await nextWorkSlot(slotStart, workHours, dayEnd);
    }
  }

  return placed;
}

/**
 * @deprecated Prefer buildProposedPlan + placeConfirmedProcedures.
 * Kept for callers that still expect one-shot schedule; now builds PROPOSED only.
 */
export async function planProgramFifo(
  instanceId: string,
  _startsOn: Date,
): Promise<number> {
  return buildProposedPlan(instanceId);
}
