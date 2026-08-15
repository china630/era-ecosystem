import type {
  PractitionerSchedulePattern,
  PractitionerScheduleExceptionKind,
  ScheduleParity,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BAKU_OFFSET = "+04:00";

/** Build a Date anchored at 00:00 Asia/Baku for a `YYYY-MM-DD` string. */
function bakuMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${BAKU_OFFSET}`);
}

export type ScheduleRuleInput = {
  pattern: PractitionerSchedulePattern;
  weekdays?: number[];
  parity?: ScheduleParity | null;
  cycleAnchor?: string | null;
  cycleLengthDays?: number | null;
  cycleOffsets?: number[];
  startMinute: number;
  endMinute: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  sortOrder?: number;
};

export type ScheduleExceptionInput = {
  date: string;
  kind: PractitionerScheduleExceptionKind;
  startMinute?: number | null;
  endMinute?: number | null;
  note?: string | null;
};

export type PractitionerScheduleInput = {
  rules: ScheduleRuleInput[];
  exceptions: ScheduleExceptionInput[];
};

export async function getPractitionerSchedule(practitionerId: string) {
  const [rules, exceptions] = await Promise.all([
    prisma.practitionerScheduleRule.findMany({
      where: { practitionerId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.practitionerScheduleException.findMany({
      where: { practitionerId },
      orderBy: { date: "asc" },
    }),
  ]);

  return {
    rules: rules.map((r) => ({
      id: r.id,
      pattern: r.pattern,
      weekdays: r.weekdaysJson ? (JSON.parse(r.weekdaysJson) as number[]) : [],
      parity: r.parity,
      cycleAnchor: r.cycleAnchor ? r.cycleAnchor.toISOString() : null,
      cycleLengthDays: r.cycleLengthDays,
      cycleOffsets: r.cycleOffsetsJson ? (JSON.parse(r.cycleOffsetsJson) as number[]) : [],
      startMinute: r.startMinute,
      endMinute: r.endMinute,
      effectiveFrom: r.effectiveFrom ? r.effectiveFrom.toISOString() : null,
      effectiveTo: r.effectiveTo ? r.effectiveTo.toISOString() : null,
      active: r.active,
      sortOrder: r.sortOrder,
    })),
    exceptions: exceptions.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      kind: e.kind,
      startMinute: e.startMinute,
      endMinute: e.endMinute,
      note: e.note,
    })),
  };
}

/** Replace-all: recreate the practitioner's rules + exceptions atomically. */
export async function replacePractitionerSchedule(
  practitionerId: string,
  input: PractitionerScheduleInput,
) {
  await prisma.$transaction(async (tx) => {
    await tx.practitionerScheduleRule.deleteMany({ where: { practitionerId } });
    await tx.practitionerScheduleException.deleteMany({ where: { practitionerId } });

    if (input.rules.length > 0) {
      await tx.practitionerScheduleRule.createMany({
        data: input.rules.map((r, idx) => ({
          practitionerId,
          pattern: r.pattern,
          weekdaysJson: r.weekdays && r.weekdays.length ? JSON.stringify(r.weekdays) : null,
          parity: r.parity ?? null,
          cycleAnchor: r.cycleAnchor ? bakuMidnight(r.cycleAnchor.slice(0, 10)) : null,
          cycleLengthDays: r.cycleLengthDays ?? null,
          cycleOffsetsJson:
            r.cycleOffsets && r.cycleOffsets.length ? JSON.stringify(r.cycleOffsets) : null,
          startMinute: r.startMinute,
          endMinute: r.endMinute,
          effectiveFrom: r.effectiveFrom ? bakuMidnight(r.effectiveFrom.slice(0, 10)) : null,
          effectiveTo: r.effectiveTo ? bakuMidnight(r.effectiveTo.slice(0, 10)) : null,
          sortOrder: r.sortOrder ?? idx,
        })),
      });
    }

    if (input.exceptions.length > 0) {
      await tx.practitionerScheduleException.createMany({
        data: input.exceptions.map((e) => ({
          practitionerId,
          date: bakuMidnight(e.date.slice(0, 10)),
          kind: e.kind,
          startMinute: e.startMinute ?? null,
          endMinute: e.endMinute ?? null,
          note: e.note?.trim() || null,
        })),
      });
    }
  });

  return getPractitionerSchedule(practitionerId);
}
