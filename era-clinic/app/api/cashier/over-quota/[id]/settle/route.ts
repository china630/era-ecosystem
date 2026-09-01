import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { settleChargeLogLocally } from "@/domain/cashier/cashier-settle.service";

const bodySchema = z.object({
  shiftId: z.string().optional(),
  payments: z
    .array(
      z.object({
        method: z.string().min(1),
        amount: z.number().nonnegative(),
      }),
    )
    .optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return denied;

    const { id } = await params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const result = await settleChargeLogLocally({
      chargeLogId: id,
      shiftId: body.shiftId,
      payments: body.payments,
      userId: session?.sub ?? null,
    });
    return jsonOk(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("not found")) return jsonError(err.message, 404);
      return jsonError(err.message, 400);
    }
    return handleRouteError(err);
  }
}
