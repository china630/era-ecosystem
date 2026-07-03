import { prisma } from "@/lib/prisma";
import { validateProcedureCompatibility } from "@/lib/procedure-compatibility.service";
import { isElectiveSchedulingAllowed, nextSchedulingDay } from "@/lib/production-calendar";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 17;
const LUNCH_START_HOUR = 13;
const LUNCH_END_HOUR = 14;

type PlannedSlot = {
  procedureCode: string;
  procedureName: string;
  durationMin: number;
  resourceCode?: string | null;
  bodyPart?: import("@prisma/client").BodyPart | null;
  afterLunchAllowed: boolean;
  minGapMinutes: number;
  sequenceIndex: number;
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
      status: { not: "CANCELLED" },
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    },
  });
  return count > 0;
}

/** @internal exported for unit tests */
export function skipLunch(slot: Date): Date {
  const h = slot.getHours();
  if (h >= LUNCH_START_HOUR && h < LUNCH_END_HOUR) {
    const out = new Date(slot);
    out.setHours(LUNCH_END_HOUR, 0, 0, 0);
    return out;
  }
  return slot;
}

/** @internal exported for unit tests */
export async function nextWorkSlot(cursor: Date): Promise<Date> {
  let d = new Date(cursor);
  d = skipLunch(d);
  if (d.getHours() >= WORK_END_HOUR) {
    d.setDate(d.getDate() + 1);
    d.setHours(WORK_START_HOUR, 0, 0, 0);
    d = await nextSchedulingDay(d);
    d.setHours(WORK_START_HOUR, 0, 0, 0);
  }
  if (d.getHours() < WORK_START_HOUR) {
    d.setHours(WORK_START_HOUR, 0, 0, 0);
  }
  if (!(await isElectiveSchedulingAllowed(d))) {
    const next = await nextSchedulingDay(d);
    next.setHours(WORK_START_HOUR, 0, 0, 0);
    return next;
  }
  return d;
}

export async function planProgramFifo(
  instanceId: string,
  startsOn: Date,
): Promise<number> {
  const { schedulingSlotMinutes: slotMinutes } = await getSchedulingSettings();
  const instance = await prisma.programInstance.findUnique({
    where: { id: instanceId },
    include: {
      procedureLines: true,
      episode: { include: { patientRef: true } },
      template: { include: { procedures: true } },
    },
  });
  if (!instance?.episode?.patientRefId) return 0;

  const patientRefId = instance.episode.patientRefId;
  const contraindications = await prisma.patientContraindication.findMany({
    where: { patientRefId },
  });
  const blockedParts = new Set(contraindications.map((c) => c.bodyPart));

  const rules = await prisma.procedureRule.findMany();
  const types = await prisma.procedureType.findMany();
  const typeByCode = new Map(types.map((t) => [t.code, t]));

  const planned: PlannedSlot[] = [];
  let seq = 0;
  for (const line of instance.procedureLines) {
    const meta = instance.template.procedures.find(
      (p) => p.procedureCode === line.procedureCode,
    );
    const pt = typeByCode.get(line.procedureCode);
    if (pt?.bodyPart && blockedParts.has(pt.bodyPart)) continue;

    for (let i = 0; i < line.quotaTotal; i++) {
      planned.push({
        procedureCode: line.procedureCode,
        procedureName: meta?.procedureName ?? pt?.name ?? line.procedureCode,
        durationMin: pt?.durationMin ?? slotMinutes,
        resourceCode: pt?.resourceCode,
        bodyPart: pt?.bodyPart ?? null,
        afterLunchAllowed: pt?.afterLunchAllowed ?? true,
        minGapMinutes: meta?.minGapMinutes ?? 0,
        sequenceIndex: seq++,
      });
    }
  }

  const resources = await prisma.resource.findMany();
  const resourceByCode = new Map(resources.map((r) => [r.code, r]));

  const scheduledPatient: { code: string; start: Date; end: Date }[] = [];
  let cursor = new Date(startsOn);
  cursor.setHours(WORK_START_HOUR, 0, 0, 0);
  let created = 0;

  for (const item of planned) {
    const resource =
      (item.resourceCode && resourceByCode.get(item.resourceCode)) ??
      resources.find((r) => r.kind === "EQUIPMENT") ??
      resources[0];
    if (!resource) continue;

    const duration = item.durationMin;
    let slotStart = await nextWorkSlot(cursor);
    if (!item.afterLunchAllowed && slotStart.getHours() >= LUNCH_END_HOUR) {
      slotStart.setDate(slotStart.getDate() + 1);
      slotStart.setHours(WORK_START_HOUR, 0, 0, 0);
    }

    for (let attempt = 0; attempt < 96; attempt++) {
      const slotEnd = addMinutes(slotStart, duration);
      if (await hasProcedureSameDay(patientRefId, item.procedureCode, slotStart)) {
        slotStart = addMinutes(slotStart, slotMinutes);
        slotStart = await nextWorkSlot(slotStart);
        continue;
      }

      const bookings = await prisma.resourceBooking.findMany({
        where: {
          resourceId: resource.id,
          startsAt: { lt: slotEnd },
          endsAt: { gt: slotStart },
        },
      });
      const busy = bookings.length >= resource.capacity;
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
        if (rule.kind === "SEQUENCE_GAP" && rule.afterCode === item.procedureCode) {
          const prev = scheduledPatient.find((s) => s.code === rule.beforeCode);
          if (prev) {
            const gapMs = slotStart.getTime() - prev.end.getTime();
            if (gapMs < (rule.minGapMinutes ?? 0) * 60_000) return false;
          }
        }
        return true;
      });

      const compatViolations = await validateProcedureCompatibility({
        candidateCode: item.procedureCode,
        startAt: slotStart,
        endAt: slotEnd,
        existing: scheduledPatient.map((s) => ({
          procedureCode: s.code,
          startAt: s.start,
          endAt: s.end,
        })),
      });
      const compatOk = compatViolations.length === 0;

      if (!busy && ruleOk && compatOk) {
        const order = await prisma.procedureOrder.create({
          data: {
            patientRefId,
            procedureCode: item.procedureCode,
            procedureName: item.procedureName,
            procedureTypeId: typeByCode.get(item.procedureCode)?.id,
            scheduledAt: slotStart,
            endsAt: slotEnd,
            sequenceIndex: item.sequenceIndex,
            bodyPart: item.bodyPart ?? undefined,
            resourceId: resource.id,
            patientOrigin: instance.episode.patientOrigin,
            reservationId: instance.reservationId ?? undefined,
            status: "SCHEDULED",
          },
        });
        await prisma.resourceBooking.create({
          data: {
            resourceId: resource.id,
            procedureOrderId: order.id,
            startsAt: slotStart,
            endsAt: slotEnd,
          },
        });
        scheduledPatient.push({
          code: item.procedureCode,
          start: slotStart,
          end: slotEnd,
        });
        cursor = addMinutes(slotEnd, item.minGapMinutes);
        created++;
        break;
      }
      slotStart = addMinutes(slotStart, slotMinutes);
      slotStart = await nextWorkSlot(slotStart);
    }
  }

  return created;
}
