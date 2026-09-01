import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS);
    if (denied) return denied;

    const { id } = await params;
    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: { patientRef: true, visit: true },
    });
    if (!order) return jsonError("Lab order not found", 404);
    if (order.status !== "ORDERED") {
      return jsonError(`Cannot collect from status ${order.status}`, 400);
    }

    const collected = await prisma.labOrder.update({
      where: { id },
      data: { status: "COLLECTED", collectedAt: new Date() },
      include: { patientRef: true, visit: true },
    });
    return jsonOk(collected);
  } catch (err) {
    return handleRouteError(err);
  }
}
