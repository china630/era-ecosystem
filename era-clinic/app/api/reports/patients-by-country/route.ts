import {
  getSatelliteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

/** Patient registry counts grouped by citizenship (ISO alpha-2, empty = unknown). */
export async function GET() {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_DIAGNOSES);
    if (denied) return denied;
    if (!session?.organizationId) return jsonError("Unauthorized", 401);

    const grouped = await prisma.patientRef.groupBy({
      by: ["nationality"],
      where: { organizationId: session.organizationId },
      _count: { _all: true },
    });

    const items = grouped
      .map((row) => ({
        code: row.nationality?.trim().toUpperCase() || "",
        count: row._count._all,
      }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

    const total = items.reduce((sum, row) => sum + row.count, 0);
    return jsonOk({ items, total });
  } catch (err) {
    return handleRouteError(err);
  }
}
