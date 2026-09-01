import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { dischargeAdmission } from "@/domain/inpatient/adt.service";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_INPATIENT);
    if (denied) return denied;

    const { id } = await params;
    const assignment = await prisma.bedAssignment.findUnique({
      where: { id },
      select: { admissionId: true, dischargedAt: true },
    });
    if (!assignment) return jsonError("Assignment not found", 404);
    if (assignment.dischargedAt) return jsonError("Already discharged", 400);
    if (!assignment.admissionId) return jsonError("Admission not linked", 400);
    const admission = await dischargeAdmission(assignment.admissionId);
    return jsonOk(admission);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    if (msg.includes("not found")) return jsonError(msg, 404);
    return handleRouteError(err);
  }
}
