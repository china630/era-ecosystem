import {
  jsonOk,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CATALOG_READ);
    if (denied) return denied;

    const rows = await prisma.procedureType.findMany({
      orderBy: { code: "asc" },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
