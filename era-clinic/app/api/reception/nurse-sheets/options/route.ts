import { jsonError, jsonOk, handleRouteError, getSatelliteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listProcedureDeskStaff } from "@/domain/procedure/procedure-desk-staff";
import { requestOrganizationId } from "@/lib/request-organization";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.SCREEN_RECEPTION_EXTRA_TICKETS,
    );
    if (denied) return denied;
    const organizationId = requestOrganizationId();
    const [staff, procedures, inactiveDepts] = await Promise.all([
      listProcedureDeskStaff(),
      prisma.procedureType.findMany({
        where: { organizationId, active: true },
        select: { code: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.serviceDepartment.findMany({
        where: { organizationId, active: false },
        select: { code: true },
      }),
    ]);
    const off = new Set(inactiveDepts.map((row) => row.code));
    const catalog = off.size
      ? await prisma.serviceCatalogCache.findMany({
          where: { organizationId, code: { in: procedures.map((row) => row.code) } },
          select: { code: true, departmentCode: true },
        })
      : [];
    const hidden = new Set(
      catalog.filter((row) => row.departmentCode && off.has(row.departmentCode)).map((row) => row.code),
    );
    return jsonOk({
      staff: staff.map((row) => ({ id: row.id, fullName: row.fullName })),
      procedures: procedures.filter((row) => !hidden.has(row.code)),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
