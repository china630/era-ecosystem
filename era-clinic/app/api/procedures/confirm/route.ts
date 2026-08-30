import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import {
  fifoConfirmBlockedReason,
  procedureConfirmHttpStatus,
} from "@/lib/sanatorium-fifo-gates";
import { day1ConfirmSoftWarn } from "@/lib/sanatorium-day1";
import { placeConfirmedProcedures } from "@/lib/treatment-planner.service";

const bodySchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1),
});

/** Doctor confirms PROPOSED orders → FIFO place on resources. */
export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const body = bodySchema.parse(await req.json());

    const selected = await prisma.procedureOrder.findMany({
      where: { id: { in: body.orderIds }, status: "PROPOSED" },
      select: { id: true, patientRefId: true, sequenceIndex: true },
    });
    if (selected.length === 0) {
      return jsonError("No PROPOSED orders to confirm", 404);
    }
    const patientRefId = selected[0].patientRefId;
    const proposedForPatient = await prisma.procedureOrder.findMany({
      where: { patientRefId, status: "PROPOSED" },
      select: { id: true, sequenceIndex: true },
      orderBy: [{ sequenceIndex: "asc" }, { scheduledAt: "asc" }],
    });
    const fifoBlock = fifoConfirmBlockedReason({
      confirmingIds: body.orderIds,
      proposedForPatient,
    });
    if (fifoBlock) {
      return jsonError(fifoBlock, procedureConfirmHttpStatus(fifoBlock));
    }

    // Soft warn only — never 4xx for >3 (contra / doctor may need 4).
    const softWarn = day1ConfirmSoftWarn(body.orderIds.length);

    const placed = await placeConfirmedProcedures(body.orderIds, {
      confirmedByUserId: session.sub,
    });
    return jsonOk({
      placed,
      orderIds: body.orderIds,
      ...(softWarn ? { softWarn } : {}),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
