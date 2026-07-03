import { jsonOk, jsonError, handleRouteError, getRouteSession, requireClinicRole } from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [CLINIC_ROLE.NURSE, CLINIC_ROLE.DOCTOR]);
    if (denied) return denied;

    const { id } = await params;
    const order = await prisma.procedureOrder.findUnique({ where: { id } });
    if (!order) return jsonError("Procedure not found", 404);
    if (order.status !== "SCHEDULED") {
      return jsonError(`Cannot start procedure in status ${order.status}`, 400);
    }

    const updated = await prisma.procedureOrder.update({
      where: { id },
      data: { status: "IN_PROGRESS" },
      include: { patientRef: true },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
