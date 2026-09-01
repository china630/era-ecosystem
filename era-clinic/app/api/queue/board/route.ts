import {
  jsonOk,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_QUEUE);
    if (denied) return denied;

    const tickets = await prisma.queueTicket.findMany({
      where: { status: { in: ["WAITING", "CALLED"] } },
      include: {
        visit: { include: { patientRef: true, practitioner: true } },
      },
      orderBy: [{ status: "asc" }, { queueNumber: "asc" }],
      take: 50,
    });
    return jsonOk({ tickets });
  } catch (err) {
    return handleRouteError(err);
  }
}
