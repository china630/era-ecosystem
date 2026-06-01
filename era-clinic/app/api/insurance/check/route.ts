import { z } from "zod";
import { financeEligibilityCheck } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";

const bodySchema = z.object({
  counterpartyId: z.string().uuid().optional(),
  policyNumber: z.string().optional(),
  patientFin: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const result = await financeEligibilityCheck(body, {
      authHeader: req.headers.get("authorization"),
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
