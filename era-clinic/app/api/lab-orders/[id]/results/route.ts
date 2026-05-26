import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { enrichResultLines, hasCriticalFlag } from "@/lib/lab-result-flags";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  lines: z
    .array(
      z.object({
        code: z.string(),
        value: z.string(),
        unit: z.string().optional(),
        refMin: z.string().optional(),
        refMax: z.string().optional(),
        flag: z.enum(["NORMAL", "HIGH", "LOW", "CRITICAL"]).optional(),
      }),
    )
    .min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: { patientRef: true, visit: true },
    });
    if (!order) return jsonError("Lab order not found", 404);
    if (!["COLLECTED", "IN_PROGRESS"].includes(order.status)) {
      return jsonError(`Cannot enter results from status ${order.status}`, 400);
    }

    const lines = enrichResultLines(body.lines);
    const updated = await prisma.labOrder.update({
      where: { id },
      data: {
        status: "RESULT_READY",
        resultJson: JSON.stringify(lines),
      },
      include: { patientRef: true, visit: true },
    });
    return jsonOk({
      ...updated,
      hasCritical: hasCriticalFlag(lines),
      resultLines: lines,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
