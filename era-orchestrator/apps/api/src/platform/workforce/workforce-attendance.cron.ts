import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { WorkforceAttendancePunchStatus } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { bakuYmd, utcFromYmd } from "./roster-cycle.util";
import { WorkforceAttendanceService } from "./workforce-attendance.service";

/** Stable UUID for cron audit rows (not a real platform user). */
export const ATTENDANCE_CRON_ACTOR_ID = "00000000-0000-4000-8000-a77e00000006";

/**
 * Nightly Asia/Baku slice: pair yesterday's mapped punches into DRAFT timesheet.
 * Manual rebuild remains available for HR.
 */
@Injectable()
export class WorkforceAttendanceCronService {
  private readonly log = new Logger(WorkforceAttendanceCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: WorkforceAttendanceService,
  ) {}

  @Cron("15 0 * * *", { timeZone: "Asia/Baku" })
  async nightlyRebuild(): Promise<void> {
    const now = new Date();
    const todayBaku = bakuYmd(now);
    const todayUtc = utcFromYmd(todayBaku).getTime();
    const yesterday = new Date(todayUtc - 24 * 60 * 60 * 1000);
    const ymd = bakuYmd(yesterday);

    const windowStart = new Date(yesterday.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd = new Date(todayUtc + 24 * 60 * 60 * 1000 - 1);

    const orgRows = await this.prisma.workforceAttendancePunch.findMany({
      where: {
        status: {
          in: [
            WorkforceAttendancePunchStatus.MAPPED,
            WorkforceAttendancePunchStatus.OPEN,
            WorkforceAttendancePunchStatus.PAIRED,
          ],
        },
        employmentId: { not: null },
        occurredAt: { gte: windowStart, lte: windowEnd },
      },
      select: { organizationId: true },
      distinct: ["organizationId"],
    });

    for (const row of orgRows) {
      try {
        const summary = await this.attendance.rebuild(
          row.organizationId,
          ATTENDANCE_CRON_ACTOR_ID,
          ymd,
          ymd,
          { usePlannedIfOpen: false },
        );
        this.log.log(
          `attendance nightly rebuild org=${row.organizationId} day=${ymd} pairs=${summary.pairsWritten} cells=${summary.cellsUpserted}`,
        );
      } catch (err) {
        this.log.warn(
          `attendance nightly rebuild failed org=${row.organizationId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
