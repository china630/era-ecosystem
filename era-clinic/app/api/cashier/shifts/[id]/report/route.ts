import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { computeShiftReport } from "@/domain/cashier/cashier-shift.service";
import { prisma } from "@/lib/prisma";

/** X-report: live totals for an open (or any) shift without closing. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return denied;

    const { id } = await params;
    const shift = await prisma.clinicShift.findUnique({ where: { id } });
    if (!shift) return jsonError("Shift not found", 404);
    const report = await computeShiftReport(id);
    return jsonOk({ shift, report, kind: "X" });
  } catch (err) {
    return handleRouteError(err);
  }
}
