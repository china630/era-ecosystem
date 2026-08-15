import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { settleVisitBill } from "@/domain/cashier/cashier-settle.service";

const paySchema = z.object({
  shiftId: z.string().optional(),
  payments: z
    .array(
      z.object({
        method: z.string().min(1),
        amount: z.number().nonnegative(),
      }),
    )
    .optional(),
  extraDiscount: z.number().nonnegative().optional(),
  forceLocal: z.boolean().optional(),
  paymentMethod: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ visitId: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [CLINIC_ROLE.RECEPTION]);
    if (denied) return denied;

    const { visitId } = await params;
    const body = paySchema.parse(await req.json());

    let payments = body.payments;
    if (!payments && body.paymentMethod) {
      // amount filled inside settle as full amountNet via default CASH path;
      // pass single method by forcing default after peek — settle defaults CASH.
      payments = undefined;
    }

    const result = await settleVisitBill({
      visitId,
      shiftId: body.shiftId,
      payments,
      extraDiscount: body.extraDiscount,
      forceLocal: body.forceLocal,
      userId: session?.sub ?? null,
    });
    return jsonOk(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("not found")) return jsonError(err.message, 404);
      if (
        err.message.includes("must equal") ||
        err.message.includes("No reservation") ||
        err.message.includes("Shift")
      ) {
        return jsonError(err.message, 400);
      }
    }
    return handleRouteError(err);
  }
}
