import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return denied;

    const { id } = await params;
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: {
        patientRef: true,
        practitioner: true,
        serviceLines: true,
      },
    });
    if (!visit) return jsonError("Visit not found", 404);
    return jsonOk(visit);
  } catch (err) {
    return handleRouteError(err);
  }
}
