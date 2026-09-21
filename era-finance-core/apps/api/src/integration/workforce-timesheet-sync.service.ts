import { Injectable, Logger } from "@nestjs/common";
import {
  satelliteWorkforceTimesheetApprovedSchema,
} from "@era/contracts";
import { Decimal, TimesheetEntryType } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { TimesheetService } from "../hr/timesheet.service";
import { WorkforceMirrorMissingError } from "./workforce-mirror-missing.error";

function parseDateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function mapApprovedType(raw?: string): TimesheetEntryType {
  switch (raw) {
    case "VACATION":
      return TimesheetEntryType.VACATION;
    case "SICK":
      return TimesheetEntryType.SICK;
    case "OFF":
      return TimesheetEntryType.OFF;
    case "BUSINESS_TRIP":
      return TimesheetEntryType.BUSINESS_TRIP;
    default:
      return TimesheetEntryType.WORK;
  }
}

function dayDateUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

@Injectable()
export class WorkforceTimesheetSyncService {
  private readonly logger = new Logger(WorkforceTimesheetSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly timesheet: TimesheetService,
  ) {}

  private async hasHrFull(organizationId: string): Promise<boolean> {
    return this.subscriptionAccess.hasModule(organizationId, "hr_full");
  }

  async handleApproved(
    organizationId: string,
    raw: unknown,
  ): Promise<{ meta?: Record<string, unknown> }> {
    if (!(await this.hasHrFull(organizationId))) {
      this.logger.log(
        `Skip WORKFORCE_TIMESHEET_APPROVED org=${organizationId} (no hr_full)`,
      );
      return { meta: { skipped: true, reason: "no_hr_full" } };
    }

    const event = satelliteWorkforceTimesheetApprovedSchema.parse(raw);
    let mirrored = 0;
    let skippedNoEmployee = 0;
    /** Year-month keys that received at least one cell (approve those headers). */
    const touchedMonths = new Set<string>();

    for (const row of event.payload.rows) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { cpEmploymentId: row.cpEmploymentId },
            ...(row.financeEmployeeId
              ? [{ id: row.financeEmployeeId }]
              : []),
          ],
        },
      });
      if (!employee) {
        skippedNoEmployee += 1;
        continue;
      }

      const d = parseDateOnly(row.workDate);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      const { timesheet: ts } = await this.timesheet.getOrCreate(
        organizationId,
        year,
        month,
      );
      const dayDate = dayDateUtc(year, month, day);
      const entryType = mapApprovedType(row.type);
      await this.prisma.timesheetEntry.upsert({
        where: {
          timesheetId_employeeId_dayDate: {
            timesheetId: ts.id,
            employeeId: employee.id,
            dayDate,
          },
        },
        create: {
          timesheetId: ts.id,
          employeeId: employee.id,
          dayDate,
          type: entryType,
          hours: new Decimal(row.hours),
        },
        update: {
          type: entryType,
          hours: new Decimal(row.hours),
        },
      });
      mirrored += 1;
      touchedMonths.add(`${year}-${String(month).padStart(2, "0")}`);
    }

    if (event.payload.rows.length > 0 && mirrored === 0) {
      // Write-back / hire mirror still in flight — do not mark job idempotent.
      this.logger.error(
        `WORKFORCE_TIMESHEET_APPROVED org=${organizationId}: 0/${event.payload.rows.length} rows mirrored (no Employee) — retrying`,
      );
      throw new WorkforceMirrorMissingError(
        "employee_mirror_missing",
        `timesheet rows=${event.payload.rows.length} unmatched`,
      );
    }
    if (skippedNoEmployee > 0) {
      this.logger.warn(
        `WORKFORCE_TIMESHEET_APPROVED org=${organizationId}: skipped ${skippedNoEmployee} rows without Employee mirror`,
      );
    }

    // Wave 1 critical: CP approve must flip Finance header to APPROVED so
    // summarizeForPayroll can drive PayrollRun. Idempotent; does not unlock
    // Finance grid for writes (TIMESHEET_MASTER_IS_CP still applies).
    const approvedHeaders: string[] = [];
    for (const key of touchedMonths) {
      const [ys, ms] = key.split("-");
      const year = Number(ys);
      const month = Number(ms);
      const id = await this.timesheet.markApprovedFromCpMirror(
        organizationId,
        year,
        month,
      );
      if (id) approvedHeaders.push(id);
    }

    return {
      meta: {
        mirrored,
        skippedNoEmployee,
        approvedTimesheetIds: approvedHeaders,
      },
    };
  }
}
