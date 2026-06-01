import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
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
    const created = await prisma.$transaction(
      body.rows.map((row) =>
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
    return jsonOk({ imported: created.length }, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
