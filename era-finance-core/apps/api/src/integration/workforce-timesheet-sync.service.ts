import { Injectable, Logger } from "@nestjs/common";
import {
  satelliteWorkforceTimesheetApprovedSchema,
} from "@era/contracts";
import { Decimal, TimesheetEntryType } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { SubscriptionAccessService } from "../subscription/subscription-access.service";
import { TimesheetService } from "../hr/timesheet.service";

function parseDateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
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

    for (const row of event.payload.rows) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          organizationId,
          OR: [
            { cpEmploymentId: row.cpEmploymentId },
            ...(row.financeEmployeeId
              ? [{ id: row.financeEmployeeId }]
              : []),
          ],
        },
      });
      if (!employee) continue;

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
          type: TimesheetEntryType.WORK,
          hours: new Decimal(row.hours),
        },
        update: {
          type: TimesheetEntryType.WORK,
          hours: new Decimal(row.hours),
        },
      });
      mirrored += 1;
    }

    return { meta: { mirrored } };
  }
}
