import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  WORKFORCE_TIMESHEET_APPROVED,
  satelliteWorkforceTimesheetBatchImportedSchema,
} from "@era/contracts";
import {
  Prisma,
  WorkforceAbsenceKind,
  WorkforceAbsenceStatus,
  WorkforceEmploymentStatus,
  WorkforceTimesheetEntryStatus,
  WorkforceTimesheetEntryType,
  WorkforceTimesheetStatus,
} from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { SatelliteEventsService } from "../../satellite-events/satellite-events.service";
import { WorkforceAuditService } from "./workforce-audit.service";
import { WorkforceEmploymentsService } from "./workforce-employments.service";
import { WorkforceEntitlementService } from "./workforce-entitlement.service";
import { WorkforceScopeService } from "./workforce-scope.service";
import type { WorkforceTimesheetBatchItemDto } from "./dto/workforce-timesheet.dto";

function parseDateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function monthBoundsUtc(year: number, month: number): {
  start: Date;
  end: Date;
  lastDay: number;
} {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month - 1, lastDay));
  return { start, end, lastDay };
}

function dayDateUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekendUtc(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

function defaultHoursForType(t: WorkforceTimesheetEntryType): Prisma.Decimal {
  if (t === WorkforceTimesheetEntryType.OFF) {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(8);
}

function typeForAbsenceKind(
  kind: WorkforceAbsenceKind,
): WorkforceTimesheetEntryType {
  switch (kind) {
    case WorkforceAbsenceKind.SICK:
      return WorkforceTimesheetEntryType.SICK;
    case WorkforceAbsenceKind.UNPAID:
    case WorkforceAbsenceKind.ADMINISTRATIVE:
      return WorkforceTimesheetEntryType.OFF;
    case WorkforceAbsenceKind.BUSINESS_TRIP:
      return WorkforceTimesheetEntryType.BUSINESS_TRIP;
    default:
      return WorkforceTimesheetEntryType.VACATION;
  }
}

function autofillTypeForDay(workDate: Date): WorkforceTimesheetEntryType {
  return isWeekendUtc(workDate)
    ? WorkforceTimesheetEntryType.OFF
    : WorkforceTimesheetEntryType.WORK;
}

function entryKey(employmentId: string, workDate: Date): string {
  return `${employmentId}|${isoDay(workDate)}`;
}

function isCellImmutable(existing: {
  lockedFromAbsence?: boolean;
  status?: WorkforceTimesheetEntryStatus | string;
} | null | undefined): boolean {
  if (!existing) return false;
  if (existing.lockedFromAbsence) return true;
  return existing.status === WorkforceTimesheetEntryStatus.APPROVED;
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err != null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

@Injectable()
export class WorkforceTimesheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: WorkforceEntitlementService,
    private readonly scope: WorkforceScopeService,
    private readonly audit: WorkforceAuditService,
    private readonly satelliteEvents: SatelliteEventsService,
    private readonly employments: WorkforceEmploymentsService,
  ) {}

  async handleBatchImported(raw: unknown): Promise<{ created: number }> {
    const event = satelliteWorkforceTimesheetBatchImportedSchema.parse(raw);
    const organizationId = event.payload.organizationId;
    await this.entitlement.assertWorkforceHub(organizationId);
    let created = 0;

    for (const row of event.payload.entries) {
      if (!row.cpEmploymentId) continue;
      const employment = await this.prisma.workforceEmployment.findFirst({
        where: { id: row.cpEmploymentId, organizationId, status: "ACTIVE" },
      });
      if (!employment) continue;
      const workDate = parseDateOnly(row.workDate);
      const year = workDate.getUTCFullYear();
      const month = workDate.getUTCMonth() + 1;
      const sheet = await this.ensureSheet(organizationId, year, month);
      if (sheet.status === WorkforceTimesheetStatus.APPROVED) continue;
      const existing = await this.prisma.workforceTimesheetEntry.findUnique({
        where: {
          timesheetId_employmentId_workDate: {
            timesheetId: sheet.id,
            employmentId: employment.id,
            workDate,
          },
        },
      });
      if (isCellImmutable(existing)) continue;
      await this.prisma.workforceTimesheetEntry.upsert({
        where: {
          timesheetId_employmentId_workDate: {
            timesheetId: sheet.id,
            employmentId: employment.id,
            workDate,
          },
        },
        create: {
          organizationId,
          timesheetId: sheet.id,
          employmentId: employment.id,
          workDate,
          hours: new Prisma.Decimal(row.hours),
          type: WorkforceTimesheetEntryType.WORK,
          source: "construction_csv",
          sourceRef: row.sourceEntryId ?? row.workerRef,
          status: "DRAFT",
        },
        update: {
          hours: new Prisma.Decimal(row.hours),
          source: "construction_csv",
          sourceRef: row.sourceEntryId ?? row.workerRef,
        },
      });
      created += 1;
    }
    return { created };
  }

  async getOrCreateMonth(organizationId: string, year: number, month: number) {
    await this.entitlement.assertWorkforceHub(organizationId);
    this.assertYearMonth(year, month);
    const sheet = await this.ensureSheet(organizationId, year, month);
    return this.getFull(organizationId, sheet.id);
  }

  async autofill(organizationId: string, timesheetId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const ts = await this.requireSheet(organizationId, timesheetId);
    this.assertDraft(ts);
    const { year, month } = ts;
    const { lastDay } = monthBoundsUtc(year, month);
    const employments = await this.activeEmployments(organizationId);
    const existingRows = await this.prisma.workforceTimesheetEntry.findMany({
      where: { timesheetId, organizationId },
    });
    const existingMap = new Map(
      existingRows.map((e) => [entryKey(e.employmentId, e.workDate), e]),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const emp of employments) {
        for (let d = 1; d <= lastDay; d++) {
          const workDate = dayDateUtc(year, month, d);
          const existing = existingMap.get(entryKey(emp.id, workDate));
          if (isCellImmutable(existing)) continue;
          const type = autofillTypeForDay(workDate);
          const hours = defaultHoursForType(type);
          await tx.workforceTimesheetEntry.upsert({
            where: {
              timesheetId_employmentId_workDate: {
                timesheetId,
                employmentId: emp.id,
                workDate,
              },
            },
            create: {
              organizationId,
              timesheetId,
              employmentId: emp.id,
              workDate,
              type,
              hours,
              source: "ops_grid",
              status: "DRAFT",
            },
            update: { type, hours, lockedFromAbsence: false },
          });
        }
      }
    });
    return this.getFull(organizationId, timesheetId);
  }

  async syncAbsences(organizationId: string, timesheetId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const ts = await this.requireSheet(organizationId, timesheetId);
    this.assertDraft(ts);
    const { year, month } = ts;
    const { start: monthStart, end: monthEnd, lastDay } = monthBoundsUtc(
      year,
      month,
    );
    const absences = await this.prisma.workforceAbsence.findMany({
      where: {
        organizationId,
        status: WorkforceAbsenceStatus.APPROVED,
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
    });
    const startIso = isoDay(monthStart);
    const endIso = isoDay(monthEnd);

    const covered = new Set<string>();
    for (const a of absences) {
      const absFrom = isoDay(a.startDate);
      const absTo = isoDay(a.endDate);
      for (let d = 1; d <= lastDay; d++) {
        const workDate = dayDateUtc(year, month, d);
        const di = isoDay(workDate);
        if (di < absFrom || di > absTo || di < startIso || di > endIso) {
          continue;
        }
        covered.add(entryKey(a.employmentId, workDate));
      }
    }

    const existingRows = await this.prisma.workforceTimesheetEntry.findMany({
      where: { timesheetId, organizationId },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const e of existingRows) {
        if (!e.lockedFromAbsence) continue;
        if (e.status === WorkforceTimesheetEntryStatus.APPROVED) continue;
        const key = entryKey(e.employmentId, e.workDate);
        if (covered.has(key)) continue;
        const type = autofillTypeForDay(e.workDate);
        await tx.workforceTimesheetEntry.update({
          where: { id: e.id },
          data: {
            lockedFromAbsence: false,
            type,
            hours: defaultHoursForType(type),
            source: "ops_grid",
          },
        });
      }

      for (const a of absences) {
        const type = typeForAbsenceKind(a.kind);
        const hours = defaultHoursForType(type);
        const absFrom = isoDay(a.startDate);
        const absTo = isoDay(a.endDate);
        for (let d = 1; d <= lastDay; d++) {
          const workDate = dayDateUtc(year, month, d);
          const di = isoDay(workDate);
          if (di < absFrom || di > absTo || di < startIso || di > endIso) {
            continue;
          }
          const existing = existingRows.find(
            (e) =>
              e.employmentId === a.employmentId &&
              isoDay(e.workDate) === di,
          );
          if (existing?.status === WorkforceTimesheetEntryStatus.APPROVED) {
            continue;
          }
          await tx.workforceTimesheetEntry.upsert({
            where: {
              timesheetId_employmentId_workDate: {
                timesheetId,
                employmentId: a.employmentId,
                workDate,
              },
            },
            create: {
              organizationId,
              timesheetId,
              employmentId: a.employmentId,
              workDate,
              type,
              hours,
              lockedFromAbsence: true,
              source: "absence_sync",
              status: "DRAFT",
            },
            update: { type, hours, lockedFromAbsence: true },
          });
        }
      }
    });
    return this.getFull(organizationId, timesheetId);
  }

  /**
   * After absence cancel: unlock overlapping DRAFT cells and restore weekday/weekend type.
   */
  async unlockAbsenceRange(
    organizationId: string,
    employmentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const from = isoDay(startDate);
    const to = isoDay(endDate);
    const rows = await this.prisma.workforceTimesheetEntry.findMany({
      where: {
        organizationId,
        employmentId,
        lockedFromAbsence: true,
        status: WorkforceTimesheetEntryStatus.DRAFT,
        workDate: {
          gte: parseDateOnly(from),
          lte: parseDateOnly(to),
        },
      },
      include: { timesheet: true },
    });
    for (const e of rows) {
      if (e.timesheet.status === WorkforceTimesheetStatus.APPROVED) continue;
      const type = autofillTypeForDay(e.workDate);
      await this.prisma.workforceTimesheetEntry.update({
        where: { id: e.id },
        data: {
          lockedFromAbsence: false,
          type,
          hours: defaultHoursForType(type),
          source: "ops_grid",
        },
      });
    }
  }

  async batchUpdate(
    organizationId: string,
    timesheetId: string,
    batches: WorkforceTimesheetBatchItemDto[],
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const ts = await this.requireSheet(organizationId, timesheetId);
    this.assertDraft(ts);
    const { year, month } = ts;
    const { lastDay } = monthBoundsUtc(year, month);
    const existingRows = await this.prisma.workforceTimesheetEntry.findMany({
      where: { timesheetId, organizationId },
    });
    const existingMap = new Map(
      existingRows.map((e) => [entryKey(e.employmentId, e.workDate), e]),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const b of batches) {
        if (b.fromDay > b.toDay) {
          throw new BadRequestException("fromDay cannot be greater than toDay");
        }
        if (b.fromDay < 1 || b.toDay > lastDay) {
          throw new BadRequestException("Day range is outside the month");
        }
        const emp = await tx.workforceEmployment.findFirst({
          where: { id: b.employmentId, organizationId },
        });
        if (!emp) {
          throw new BadRequestException(`Employment ${b.employmentId} not found`);
        }
        const hrs =
          b.hours != null
            ? new Prisma.Decimal(b.hours)
            : defaultHoursForType(b.type);
        for (let d = b.fromDay; d <= b.toDay; d++) {
          const workDate = dayDateUtc(year, month, d);
          const existing = existingMap.get(entryKey(b.employmentId, workDate));
          if (isCellImmutable(existing)) continue;
          await tx.workforceTimesheetEntry.upsert({
            where: {
              timesheetId_employmentId_workDate: {
                timesheetId,
                employmentId: b.employmentId,
                workDate,
              },
            },
            create: {
              organizationId,
              timesheetId,
              employmentId: b.employmentId,
              workDate,
              type: b.type,
              hours: hrs,
              source: "ops_grid",
              status: "DRAFT",
            },
            update: { type: b.type, hours: hrs, lockedFromAbsence: false },
          });
        }
      }
    });
    return this.getFull(organizationId, timesheetId);
  }

  async approveMonth(
    organizationId: string,
    timesheetId: string,
    actorUserId: string,
  ) {
    await this.entitlement.assertWorkforceHub(organizationId);
    const ts = await this.requireSheet(organizationId, timesheetId);
    if (ts.status === WorkforceTimesheetStatus.APPROVED) {
      throw new ConflictException("Timesheet already approved");
    }
    const entries = await this.prisma.workforceTimesheetEntry.findMany({
      where: { timesheetId, organizationId },
      include: { employment: true },
    });
    if (entries.length === 0) {
      throw new BadRequestException(
        "Cannot approve an empty timesheet; autofill or enter attendance first",
      );
    }
    await this.prisma.$transaction([
      this.prisma.workforceTimesheet.update({
        where: { id: timesheetId },
        data: { status: WorkforceTimesheetStatus.APPROVED },
      }),
      this.prisma.workforceTimesheetEntry.updateMany({
        where: { timesheetId, organizationId },
        data: { status: "APPROVED" },
      }),
    ]);
    await this.emitApproved(organizationId, actorUserId, entries);
    await this.audit.log({
      organizationId,
      actorUserId,
      action: "TIMESHEET_APPROVE",
      entityType: "TIMESHEET",
      entityId: timesheetId,
      payload: { count: entries.length, year: ts.year, month: ts.month },
    });
    return this.getFull(organizationId, timesheetId);
  }

  async listDraft(organizationId: string) {
    await this.entitlement.assertWorkforceHub(organizationId);
    return this.prisma.workforceTimesheetEntry.findMany({
      where: { organizationId, status: "DRAFT" },
      include: {
        employment: { include: { orgUnit: true, position: true } },
      },
      orderBy: { workDate: "asc" },
      take: 500,
    });
  }

  async approveBatch(
    _organizationId: string,
    _actorUserId: string,
    _entryIds: string[],
  ): Promise<never> {
    throw new GoneException({
      statusCode: 410,
      code: "TIMESHEET_USE_MONTH_APPROVE",
      message:
        "Cherry-pick timesheet approve is retired. Use POST /timesheets/:id/approve for the month.",
    });
  }

  async getEntry(organizationId: string, id: string) {
    const row = await this.prisma.workforceTimesheetEntry.findFirst({
      where: { id, organizationId },
      include: { employment: true },
    });
    if (!row) throw new NotFoundException("Timesheet entry not found");
    return row;
  }

  private async getFull(organizationId: string, timesheetId: string) {
    const ts = await this.requireSheet(organizationId, timesheetId);
    const employments = await this.prisma.workforceEmployment.findMany({
      where: { organizationId, status: WorkforceEmploymentStatus.ACTIVE },
      include: { orgUnit: true, position: true },
      orderBy: [{ hireDate: "asc" }, { createdAt: "asc" }],
    });
    const persons = await this.employments.resolvePersonProfiles(
      organizationId,
      employments.map((e) => e.globalPersonId),
    );
    const entries = await this.prisma.workforceTimesheetEntry.findMany({
      where: { timesheetId, organizationId },
      orderBy: [{ employmentId: "asc" }, { workDate: "asc" }],
    });
    return {
      timesheet: ts,
      employments,
      persons,
      entries: entries.map((e) => ({
        ...e,
        hours: e.hours != null ? e.hours.toString() : "0",
        workDate: isoDay(e.workDate),
      })),
    };
  }

  private async ensureSheet(
    organizationId: string,
    year: number,
    month: number,
  ) {
    let ts = await this.prisma.workforceTimesheet.findFirst({
      where: { organizationId, year, month },
    });
    if (ts) return ts;
    try {
      return await this.prisma.workforceTimesheet.create({
        data: {
          organizationId,
          year,
          month,
          status: WorkforceTimesheetStatus.DRAFT,
        },
      });
    } catch (err) {
      if (!isPrismaUniqueViolation(err)) throw err;
      ts = await this.prisma.workforceTimesheet.findFirst({
        where: { organizationId, year, month },
      });
      if (!ts) throw err;
      return ts;
    }
  }

  private async requireSheet(organizationId: string, timesheetId: string) {
    const ts = await this.prisma.workforceTimesheet.findFirst({
      where: { id: timesheetId, organizationId },
    });
    if (!ts) throw new NotFoundException("Timesheet not found");
    return ts;
  }

  private assertDraft(ts: { status: WorkforceTimesheetStatus }) {
    if (ts.status !== WorkforceTimesheetStatus.DRAFT) {
      throw new ForbiddenException("Timesheet is approved and read-only");
    }
  }

  private assertYearMonth(year: number, month: number) {
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      throw new BadRequestException("year must be 1900–2100");
    }
    if (month < 1 || month > 12) {
      throw new BadRequestException("month must be 1–12");
    }
  }

  private activeEmployments(organizationId: string) {
    return this.prisma.workforceEmployment.findMany({
      where: { organizationId, status: WorkforceEmploymentStatus.ACTIVE },
      select: { id: true },
    });
  }

  private async emitApproved(
    organizationId: string,
    actorUserId: string,
    entries: Array<{
      id: string;
      employmentId: string;
      workDate: Date;
      hours: Prisma.Decimal;
      type: WorkforceTimesheetEntryType;
      employment: {
        globalPersonId: string;
        financeEmployeeId: string | null;
      };
    }>,
  ) {
    const link = await this.scope.resolveScopeForCommercialOrg(organizationId);
    const approvedAt = new Date().toISOString();
    const rows = entries.map((e) => ({
      cpTimesheetEntryId: e.id,
      cpEmploymentId: e.employmentId,
      globalPersonId: e.employment.globalPersonId,
      financeEmployeeId: e.employment.financeEmployeeId ?? undefined,
      workDate: isoDay(e.workDate),
      hours: Number(e.hours),
      type: e.type,
    }));
    await this.satelliteEvents.enqueue({
      type: WORKFORCE_TIMESHEET_APPROVED,
      organizationId: link.workforceScope.anchorOrganizationId,
      correlationId: `ts-approve:${Date.now()}`,
      occurredAt: approvedAt,
      payload: {
        organizationId: link.workforceScope.anchorOrganizationId,
        cpTimesheetEntryIds: entries.map((e) => e.id),
        approvedByUserId: actorUserId,
        approvedAt,
        rows,
      },
    });
  }
}
