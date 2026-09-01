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
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return denied;
    const rows = await prisma.programTemplate.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, durationDays: true },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}
