import { z } from "zod";
import { financeCodClearing } from "@era/satellite-kit";
import { jsonOk, handleRouteError, jsonError, getSatelliteSession } from "@/lib/api-utils";

const bodySchema = z.object({
  shipmentRef: z.string().min(1),
  totalCod: z.number().min(0),
  driverShare: z.number().min(0).optional(),
  hubShare: z.number().min(0).optional(),
});

export async function POST(req: Request) {
  try {
    if (!(await getSatelliteSession())) return jsonError("Unauthorized", 401);
    const body = bodySchema.parse(await req.json());
    const result = await financeCodClearing(body, {
      authHeader: req.headers.get("authorization"),
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
