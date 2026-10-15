import { jsonOk, handleRouteError, getSatelliteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS);
    if (denied) return denied;
    const rows = await prisma.labBlankProfile.findMany({
      where: { active: true },
      select: { id: true, name: true, kind: true, serviceCode: true },
      orderBy: { name: "asc" },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
