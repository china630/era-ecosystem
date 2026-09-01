import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertLabOrderDataScope } from "@/lib/auth/clinic-data-scope";
import { prisma } from "@/lib/prisma";
import { writeLabResultsForOrder } from "@/domain/lab/lab-order-write.service";

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

/** Editable while COLLECTED/IN_PROGRESS/RESULT_READY — re-entry allowed until PUBLISHED. */
const EDITABLE_STATUSES = ["COLLECTED", "IN_PROGRESS", "RESULT_READY"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS);
    if (denied) return denied;

    const { id } = await params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const body = bodySchema.parse(await req.json());
    const order = await prisma.labOrder.findUnique({ where: { id } });
    if (!order) return jsonError("Lab order not found", 404);
    if (!EDITABLE_STATUSES.includes(order.status)) {
      return jsonError(`Cannot enter results from status ${order.status}`, 400);
    }

    const result = await writeLabResultsForOrder(id, body.lines);
    if (!result) return jsonError("Lab order not found", 404);

    return jsonOk({
      ...result.order,
      hasCritical: result.hasCritical,
      resultLines: result.enrichedLines,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
