import { z } from "zod";
import { financeEligibilityCheck } from "@era/satellite-kit";
import {
  jsonOk,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";

const bodySchema = z.object({
  counterpartyId: z.string().uuid().optional(),
  policyNumber: z.string().optional(),
  patientFin: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

    const body = bodySchema.parse(await req.json());
    const result = await financeEligibilityCheck(body, {
      authHeader: req.headers.get("authorization"),
    });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
