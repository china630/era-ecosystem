import { Body, Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { TimesheetEntry } from "@prisma/client";
import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import { isConstructionWorkingDay } from "@/lib/production-calendar";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { WORKFORCE_TIMESHEET_BATCH_IMPORTED } from "@era/contracts";
import { createTimesheetEntriesBatch } from "@/lib/timesheets.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const bodySchema = z.object({
  projectId: z.string(),
  rows: z.array(
    z.object({
      workerRef: z.string(),
      cpEmploymentId: z.string().uuid().optional(),
      hours: z.number().min(0),
      workDate: z.string(),
    }),
  ),
});

@Controller("api/timesheets")
@UseGuards(ConstructionStaffGuard)
export class TimesheetsController {
  @Post("import")
  @HttpCode(201)
  import(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = bodySchema.parse(body);
      const accepted: typeof parsed.rows = [];
      const skipped: Array<{ row: (typeof parsed.rows)[number]; reason: string }> = [];
      const warnings: string[] = [];

      for (const row of parsed.rows) {
        const iso = row.workDate.slice(0, 10);
        const working = await isConstructionWorkingDay(iso);
        if (!working) {
          skipped.push({ row, reason: "NON_WORKING_DAY" });
          warnings.push(`${iso}: non-working day (${row.workerRef})`);
          continue;
        }
        accepted.push(row);
      }

      const created = await createTimesheetEntriesBatch(
        accepted.map((row) => ({
          projectId: parsed.projectId,
          workerRef: row.workerRef,
          cpEmploymentId: row.cpEmploymentId ?? null,
          hours: row.hours,
          workDate: new Date(row.workDate),
        })),
      );

      const linked = created.filter((c: TimesheetEntry) => c.cpEmploymentId);
      if (linked.length > 0) {
        await dispatchSatelliteEvent({
          type: WORKFORCE_TIMESHEET_BATCH_IMPORTED,
          payload: {
            organizationId: requestOrganizationId(),
            projectId: parsed.projectId,
            entries: linked.map((c: TimesheetEntry) => ({
              cpEmploymentId: c.cpEmploymentId ?? undefined,
              workerRef: c.workerRef,
              hours: Number(c.hours),
              workDate: c.workDate.toISOString().slice(0, 10),
              sourceEntryId: c.id,
            })),
          },
        });
      }

      return {
        imported: created.length,
        skipped: skipped.length,
        warnings,
        skippedRows: skipped,
        eventPublished: linked.length > 0,
      };
    });
  }
}
