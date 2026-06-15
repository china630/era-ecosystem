import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { isConstructionWorkingDay } from "@/lib/production-calendar";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  projectId: z.string(),
  rows: z.array(
    z.object({
      workerRef: z.string(),
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
            hours: row.hours,
            workDate: new Date(row.workDate),
            source: "CSV",
          },
        }),
      ),
    );

    return jsonOk(
      {
        imported: created.length,
        skipped: skipped.length,
        warnings,
        skippedRows: skipped,
      },
      201,
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
