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
      orderBy: { code: "asc" },
    });
    const locale = await readUiLocale(req);
    return jsonOk(await overlayProcedureTypeNames(rows, locale));
  } catch (err) {
    return handleRouteError(err);
  }
}
