import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { isConstructionWorkingDay } from "@/lib/production-calendar";
import { prisma } from "@/lib/prisma";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { WORKFORCE_TIMESHEET_BATCH_IMPORTED } from "@era/contracts";

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

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const accepted: typeof body.rows = [];
    const skipped: Array<{ row: (typeof body.rows)[number]; reason: string }> = [];
    const warnings: string[] = [];

    for (const row of body.rows) {
      const iso = row.workDate.slice(0, 10);
      const working = await isConstructionWorkingDay(iso);
      if (!working) {
        skipped.push({ row, reason: "NON_WORKING_DAY" });
        warnings.push(`${iso}: non-working day (${row.workerRef})`);
        continue;
      }
      accepted.push(row);
    }

    const created = await prisma.$transaction(
      accepted.map((row) =>
        prisma.timesheetEntry.create({
          data: {
            projectId: body.projectId,
            workerRef: row.workerRef,
            cpEmploymentId: row.cpEmploymentId ?? null,
            hours: row.hours,
            workDate: new Date(row.workDate),
            source: "CSV",
          },
        }),
      ),
    );

    const linked = created.filter((c) => c.cpEmploymentId);
    if (linked.length > 0) {
      await dispatchSatelliteEvent({
        type: WORKFORCE_TIMESHEET_BATCH_IMPORTED,
        payload: {
          organizationId: process.env.ERA_SATELLITE_ORGANIZATION_ID ?? "",
          projectId: body.projectId,
          entries: linked.map((c) => ({
            cpEmploymentId: c.cpEmploymentId ?? undefined,
            workerRef: c.workerRef,
            hours: Number(c.hours),
            workDate: c.workDate.toISOString().slice(0, 10),
            sourceEntryId: c.id,
          })),
        },
      });
    }

    return jsonOk(
      {
        imported: created.length,
        skipped: skipped.length,
        warnings,
        skippedRows: skipped,
        eventPublished: linked.length > 0,
      },
      201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
