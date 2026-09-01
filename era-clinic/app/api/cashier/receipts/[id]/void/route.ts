import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { voidReceipt } from "@/domain/cashier/cashier-settle.service";

const bodySchema = z.object({
  reason: z.string().min(3).max(500),
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
    const body = bodySchema.parse(await req.json());
    const receipt = await voidReceipt({
      receiptId: id,
      reason: body.reason,
      userId: session?.sub ?? null,
    });
    return jsonOk(receipt);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("not found")) return jsonError(err.message, 404);
      return jsonError(err.message, 400);
    }
    return handleRouteError(err);
  }
}
