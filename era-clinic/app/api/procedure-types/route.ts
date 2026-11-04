import {
  jsonOk,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { overlayProcedureTypeNames } from "@/domain/catalog/catalog-display-name.service";
import { readUiLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CATALOG_READ);
    if (denied) return denied;

    const rows = await prisma.procedureType.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
    });
    const locale = await readUiLocale(req);
    const named = await overlayProcedureTypeNames(rows, locale);
    const deptCodes = [
      ...new Set(named.map((row) => row.departmentCode).filter((code): code is string => Boolean(code))),
    ];
    const inactiveDepts = new Set(
      deptCodes.length
        ? (
            await prisma.serviceDepartment.findMany({
              where: { code: { in: deptCodes }, active: false },
              select: { code: true },
            })
          ).map((row) => row.code)
        : [],
    );
    return jsonOk(
      named.filter((row) => !row.departmentCode || !inactiveDepts.has(row.departmentCode)),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
