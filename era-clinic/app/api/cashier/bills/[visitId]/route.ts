import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { buildUnifiedBill } from "@/domain/cashier/cashier-bill.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ visitId: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return denied;

    const { visitId } = await params;
    const bill = await buildUnifiedBill(visitId);
    if (!bill) return jsonError("Visit not found", 404);
    return jsonOk(bill);
  } catch (err) {
    return handleRouteError(err);
  }
}
