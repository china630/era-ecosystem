import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { reprintReceipt } from "@/domain/cashier/cashier-settle.service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return denied;

    const { id } = await params;
    const receipt = await reprintReceipt(id);
    return jsonOk(receipt);
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return jsonError(err.message, 404);
    }
    return handleRouteError(err);
  }
}
