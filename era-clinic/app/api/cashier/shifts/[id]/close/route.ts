import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
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
    const denied = requireClinicRole(session, [CLINIC_ROLE.RECEPTION]);
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
