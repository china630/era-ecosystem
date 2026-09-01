import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  closeShift,
  computeShiftReport,
} from "@/domain/cashier/cashier-shift.service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return denied;

    const { id } = await params;
    const report = await computeShiftReport(id);
    const shift = await closeShift(id, session?.sub ?? null);
    return jsonOk({ shift, report });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      return jsonError(err.message, 404);
    }
    if (err instanceof Error && err.message.includes("already closed")) {
      return jsonError(err.message, 400);
    }
    return handleRouteError(err);
  }
}
