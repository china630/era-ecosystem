import { z } from "zod";
import { financeCodClearing } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

const bodySchema = z.object({
  shipmentRef: z.string().min(1),
  totalCod: z.number().min(0),
  driverShare: z.number().min(0).optional(),
  hubShare: z.number().min(0).optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const result = await financeCodClearing(body, {
      authHeader: req.headers.get("authorization"),
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
