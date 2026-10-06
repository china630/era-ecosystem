import {
  getSatelliteSession,
  handleRouteError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

/** Doctors for the procedure report filter. Same permission as the report itself. */
export async function GET() {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return denied;
    if (!session) return jsonOk({ items: [] });

    const rows = await prisma.practitioner.findMany({
      where: {
        organizationId: session.organizationId,
        staffKind: "DOCTOR",
        active: true,
      },
      select: { id: true, fullName: true, code: true },
      orderBy: { fullName: "asc" },
    });
    return jsonOk({
      items: rows.map((row) => ({
        id: row.id,
        fullName: row.fullName?.trim() || row.code,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
