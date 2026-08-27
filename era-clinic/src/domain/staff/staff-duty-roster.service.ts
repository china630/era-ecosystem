import type { PractitionerStaffKind, StaffAbsenceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { bakuYmd } from "@/domain/appointment/practitioner-schedule.service";
import {
  isAbsentOnYmd,
  isYearMonth,
  previousYearMonth,
  resolveDutyCandidates,
  StaffDutyError,
  yearMonthOfYmd,
  yearMonthYmdBounds,
  type DutyCandidate,
} from "@/domain/staff/staff-kind";

const BAKU_OFFSET = "+04:00";

function bakuMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${BAKU_OFFSET}`);
}

export function assertYearMonth(yearMonth: string): string {
  if (!isYearMonth(yearMonth)) {
    throw new StaffDutyError("yearMonth must be YYYY-MM");
  }
  return yearMonth;
}

async function listProcedureTypesOrdered() {
  return prisma.procedureType.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

async function listStaff(staffKind: PractitionerStaffKind) {
  return prisma.practitioner.findMany({
    where: { active: true, staffKind },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      code: true,
      fullName: true,
      specialty: true,
      staffKind: true,
      skills: {
        where: { active: true },
        select: { procedureTypeId: true },
      },
    },
  });
}

export async function listAbsencesOverlappingMonth(
  yearMonth: string,
  practitionerIds: string[],
) {
  if (practitionerIds.length === 0) return [];
  const { fromYmd, toYmd } = yearMonthYmdBounds(yearMonth);
  const from = bakuMidnight(fromYmd);
  const to = bakuMidnight(toYmd);
  return prisma.staffAbsence.findMany({
    where: {
      practitionerId: { in: practitionerIds },
      startsOn: { lte: to },
      endsOn: { gte: from },
    },
    orderBy: { startsOn: "asc" },
  });
}

export async function listDayOffsInMonth(yearMonth: string, practitionerIds: string[]) {
  if (practitionerIds.length === 0) return [];
  const { fromYmd, toYmd } = yearMonthYmdBounds(yearMonth);
  const from = bakuMidnight(fromYmd);
  const to = bakuMidnight(toYmd);
  return prisma.practitionerScheduleException.findMany({
    where: {
      practitionerId: { in: practitionerIds },
      kind: "DAY_OFF",
      date: { gte: from, lte: to },
    },
    select: { practitionerId: true, date: true, note: true },
    orderBy: { date: "asc" },
  });
}

function absenceWarningsForPractitioner(
  practitionerId: string,
  absences: Array<{
    practitionerId: string;
    kind: StaffAbsenceKind;
    startsOn: Date;
    endsOn: Date;
    note: string | null;
  }>,
  dayOffs: Array<{ practitionerId: string; date: Date; note: string | null }>,
) {
  const ranges = absences
    .filter((a) => a.practitionerId === practitionerId)
    .map((a) => ({
      kind: a.kind,
      from: a.startsOn.toISOString().slice(0, 10),
      to: a.endsOn.toISOString().slice(0, 10),
      note: a.note,
    }));
  const offs = dayOffs
    .filter((d) => d.practitionerId === practitionerId)
    .map((d) => ({
      kind: "DAY_OFF" as const,
      from: bakuYmd(d.date),
      to: bakuYmd(d.date),
      note: d.note,
    }));
  return [...ranges, ...offs];
}

async function seedLinesFromPrevious(
  rosterId: string,
  yearMonth: string,
  staffKind: PractitionerStaffKind,
): Promise<string | null> {
  type PrevDutyLine = {
    procedureTypeId: string;
    practitionerId: string | null;
    stable: boolean;
    note: string | null;
  };
  const types = await listProcedureTypesOrdered();
  const prev = await prisma.staffDutyRoster.findUnique({
    where: {
      organizationId_yearMonth_staffKind: {
        organizationId: requestOrganizationId(),
        yearMonth: previousYearMonth(yearMonth),
        staffKind,
      },
    },
    include: { lines: true },
  });
  const prevByType = new Map<string, PrevDutyLine>(
    (prev?.lines ?? []).map((l: PrevDutyLine) => [l.procedureTypeId, l]),
  );
  await prisma.staffDutyLine.createMany({
    data: types.map((pt, idx) => {
      const copied = prevByType.get(pt.id);
      return {
        rosterId,
        procedureTypeId: pt.id,
        practitionerId: copied?.practitionerId ?? null,
        stable: copied?.stable ?? false,
        sortOrder: idx,
        note: copied?.note ?? null,
      };
    }),
  });
  return prev?.yearMonth ?? null;
}

export async function getOrCreateDutyRoster(input: {
  yearMonth: string;
  staffKind?: PractitionerStaffKind;
}) {
  const yearMonth = assertYearMonth(input.yearMonth);
  const staffKind = input.staffKind ?? "NURSE";
  const organizationId = requestOrganizationId();

  let roster = await prisma.staffDutyRoster.findUnique({
    where: {
      organizationId_yearMonth_staffKind: { organizationId, yearMonth, staffKind },
    },
  });

  if (!roster) {
    roster = await prisma.staffDutyRoster.create({
      data: { yearMonth, staffKind, status: "DRAFT" },
    });
    if (!roster) throw new Error("Failed to ensure staff duty roster");
    const copiedFrom = await seedLinesFromPrevious(roster.id, yearMonth, staffKind);
    if (copiedFrom) {
      roster = await prisma.staffDutyRoster.update({
        where: { id: roster.id },
        data: { copiedFromYearMonth: copiedFrom },
      });
    }
  } else {
    await syncMissingProcedureLines(roster.id);
  }
  if (!roster) throw new Error("Failed to ensure staff duty roster");

  return loadRosterView(roster.id, yearMonth, staffKind);
}

async function syncMissingProcedureLines(rosterId: string) {
  const types = await listProcedureTypesOrdered();
  const existing = await prisma.staffDutyLine.findMany({
    where: { rosterId },
    select: { procedureTypeId: true },
  });
  const have = new Set(existing.map((l) => l.procedureTypeId));
  const missing = types.filter((pt) => !have.has(pt.id));
  if (missing.length === 0) return;
  await prisma.staffDutyLine.createMany({
    data: missing.map((pt, idx) => ({
      rosterId,
      procedureTypeId: pt.id,
      sortOrder: existing.length + idx,
    })),
  });
}

async function loadRosterView(
  rosterId: string,
  yearMonth: string,
  staffKind: PractitionerStaffKind,
) {
  const roster = await prisma.staffDutyRoster.findUniqueOrThrow({
    where: { id: rosterId },
    include: {
      lines: {
        include: {
          procedureType: { select: { id: true, code: true, name: true } },
          practitioner: {
            select: { id: true, code: true, fullName: true, staffKind: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  const staff = await listStaff(staffKind);
  const staffIds = staff.map((s) => s.id);
  const [absences, dayOffs] = await Promise.all([
    listAbsencesOverlappingMonth(yearMonth, staffIds),
    listDayOffsInMonth(yearMonth, staffIds),
  ]);

  return {
    roster: {
      id: roster.id,
      yearMonth: roster.yearMonth,
      staffKind: roster.staffKind,
      status: roster.status,
      approvedAt: roster.approvedAt,
      approvedByUserId: roster.approvedByUserId,
      copiedFromYearMonth: roster.copiedFromYearMonth,
      note: roster.note,
    },
    lines: roster.lines.map((line: {
      id: string;
      procedureTypeId: string;
      procedureType: { code: string; name: string };
      practitionerId: string | null;
      practitioner: { fullName: string } | null;
      stable: boolean;
      note: string | null;
    }) => ({
      id: line.id,
      procedureTypeId: line.procedureTypeId,
      procedureCode: line.procedureType.code,
      procedureName: line.procedureType.name,
      practitionerId: line.practitionerId,
      practitionerName: line.practitioner?.fullName ?? null,
      stable: line.stable,
      note: line.note,
      warnings: line.practitionerId
        ? absenceWarningsForPractitioner(line.practitionerId, absences, dayOffs)
        : [],
    })),
    staff: staff.map((s) => ({
      id: s.id,
      code: s.code,
      fullName: s.fullName,
      specialty: s.specialty,
      skillProcedureTypeIds: s.skills.map((sk) => sk.procedureTypeId),
      warnings: absenceWarningsForPractitioner(s.id, absences, dayOffs),
    })),
    absences: absences.map((a) => ({
      id: a.id,
      practitionerId: a.practitionerId,
      kind: a.kind,
      startsOn: a.startsOn.toISOString().slice(0, 10),
      endsOn: a.endsOn.toISOString().slice(0, 10),
      note: a.note,
    })),
  };
}

export type DutyLineWrite = {
  procedureTypeId: string;
  practitionerId?: string | null;
  stable?: boolean;
  note?: string | null;
};

export async function saveDutyRoster(input: {
  yearMonth: string;
  staffKind?: PractitionerStaffKind;
  lines: DutyLineWrite[];
  note?: string | null;
}) {
  const yearMonth = assertYearMonth(input.yearMonth);
  const staffKind = input.staffKind ?? "NURSE";
  const view = await getOrCreateDutyRoster({ yearMonth, staffKind });
  const staffIds = new Set(view.staff.map((s) => s.id));

  for (const line of input.lines) {
    if (line.practitionerId && !staffIds.has(line.practitionerId)) {
      throw new StaffDutyError("Assigned staff must match roster staffKind");
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const line of input.lines) {
      await tx.staffDutyLine.upsert({
        where: {
          rosterId_procedureTypeId: {
            rosterId: view.roster.id,
            procedureTypeId: line.procedureTypeId,
          },
        },
        create: {
          rosterId: view.roster.id,
          procedureTypeId: line.procedureTypeId,
          practitionerId: line.practitionerId ?? null,
          stable: line.stable ?? false,
          note: line.note ?? null,
        },
        update: {
          practitionerId: line.practitionerId ?? null,
          stable: line.stable ?? false,
          note: line.note ?? null,
        },
      });
    }
    if (input.note !== undefined) {
      await tx.staffDutyRoster.update({
        where: { id: view.roster.id },
        data: { note: input.note },
      });
    }
  });

  return loadRosterView(view.roster.id, yearMonth, staffKind);
}

export async function approveDutyRoster(input: {
  yearMonth: string;
  staffKind?: PractitionerStaffKind;
  approvedByUserId: string;
}) {
  const yearMonth = assertYearMonth(input.yearMonth);
  const staffKind = input.staffKind ?? "NURSE";
  const view = await getOrCreateDutyRoster({ yearMonth, staffKind });
  await prisma.staffDutyRoster.update({
    where: { id: view.roster.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      approvedByUserId: input.approvedByUserId,
    },
  });
  return loadRosterView(view.roster.id, yearMonth, staffKind);
}

export async function copyDutyRosterFromPrevious(input: {
  yearMonth: string;
  staffKind?: PractitionerStaffKind;
}) {
  const yearMonth = assertYearMonth(input.yearMonth);
  const staffKind = input.staffKind ?? "NURSE";
  const view = await getOrCreateDutyRoster({ yearMonth, staffKind });
  const prev = await prisma.staffDutyRoster.findUnique({
    where: {
      organizationId_yearMonth_staffKind: {
        organizationId: requestOrganizationId(),
        yearMonth: previousYearMonth(yearMonth),
        staffKind,
      },
    },
    include: { lines: true },
  });
  if (!prev) {
    throw new StaffDutyError("No previous month roster to copy");
  }
  await prisma.$transaction(async (tx) => {
    await tx.staffDutyLine.deleteMany({ where: { rosterId: view.roster.id } });
    await tx.staffDutyLine.createMany({
      data: prev.lines.map((l: {
        procedureTypeId: string;
        practitionerId: string | null;
        stable: boolean;
        sortOrder: number;
        note: string | null;
      }) => ({
        rosterId: view.roster.id,
        procedureTypeId: l.procedureTypeId,
        practitionerId: l.practitionerId,
        stable: l.stable,
        sortOrder: l.sortOrder,
        note: l.note,
      })),
    });
    await tx.staffDutyRoster.update({
      where: { id: view.roster.id },
      data: { copiedFromYearMonth: prev.yearMonth, status: "DRAFT" },
    });
  });
  return loadRosterView(view.roster.id, yearMonth, staffKind);
}

export async function createStaffAbsence(input: {
  practitionerId: string;
  kind: StaffAbsenceKind;
  startsOn: string;
  endsOn: string;
  note?: string | null;
}) {
  if (input.endsOn < input.startsOn) {
    throw new StaffDutyError("endsOn must be on or after startsOn");
  }
  return prisma.staffAbsence.create({
    data: {
      practitionerId: input.practitionerId,
      kind: input.kind,
      startsOn: bakuMidnight(input.startsOn),
      endsOn: bakuMidnight(input.endsOn),
      note: input.note ?? null,
    },
  });
}

export async function deleteStaffAbsence(id: string) {
  await prisma.staffAbsence.delete({ where: { id } });
}

export async function isPractitionerAbsentOn(practitionerId: string, at: Date): Promise<boolean> {
  const ymd = bakuYmd(at);
  const day = bakuMidnight(ymd);
  const [absences, dayOff] = await Promise.all([
    prisma.staffAbsence.findMany({
      where: {
        practitionerId,
        startsOn: { lte: day },
        endsOn: { gte: day },
      },
      select: { startsOn: true, endsOn: true },
    }),
    prisma.practitionerScheduleException.findFirst({
      where: { practitionerId, kind: "DAY_OFF", date: day },
      select: { id: true },
    }),
  ]);
  if (dayOff) return true;
  return isAbsentOnYmd(absences, ymd);
}

/** Posted nurse for an approved month roster, if any. */
export async function resolvePostedStaffForSlot(input: {
  procedureTypeId: string;
  at: Date;
  staffKind?: PractitionerStaffKind;
}): Promise<{
  rosterStatus: "DRAFT" | "APPROVED" | null;
  posted: DutyCandidate | null;
  postedAbsent: boolean;
}> {
  const staffKind = input.staffKind ?? "NURSE";
  const yearMonth = yearMonthOfYmd(bakuYmd(input.at));
  const roster = await prisma.staffDutyRoster.findUnique({
    where: {
      organizationId_yearMonth_staffKind: {
        organizationId: requestOrganizationId(),
        yearMonth,
        staffKind,
      },
    },
    include: {
      lines: {
        where: { procedureTypeId: input.procedureTypeId },
        include: {
          practitioner: { select: { id: true, code: true, fullName: true, active: true } },
        },
      },
    },
  });
  if (!roster) {
    return { rosterStatus: null, posted: null, postedAbsent: false };
  }
  const line = roster.lines[0];
  const posted =
    line?.practitioner && line.practitioner.active
      ? {
          id: line.practitioner.id,
          code: line.practitioner.code,
          fullName: line.practitioner.fullName,
        }
      : null;
  const postedAbsent = posted
    ? await isPractitionerAbsentOn(posted.id, input.at)
    : false;
  return { rosterStatus: roster.status, posted, postedAbsent };
}

export function applyDutyFilter(
  skilled: DutyCandidate[],
  duty: Awaited<ReturnType<typeof resolvePostedStaffForSlot>>,
): DutyCandidate[] {
  return resolveDutyCandidates({
    rosterStatus: duty.rosterStatus,
    postedPractitionerId: duty.posted?.id ?? null,
    posted: duty.posted,
    postedAbsent: duty.postedAbsent,
    skilled,
  });
}
