import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
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
    const placed = await placeConfirmedProcedures(body.orderIds, {
      confirmedByUserId: session.sub,
    });
    return jsonOk({ placed, orderIds: body.orderIds });
  } catch (err) {
    return handleRouteError(err);
  }
}
