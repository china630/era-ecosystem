import {
  jsonOk,
  handleRouteError,
  getSatelliteSession,
  jsonError,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { getPatientCardSummary } from "@/domain/patient/patient-card.service";
import { readUiLocale } from "@/lib/request-locale";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const { id } = await ctx.params;
    const exists = await prisma.patientRef.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return jsonError("Not found", 404);
    const episodeId = new URL(req.url).searchParams.get("episode") ?? undefined;
    const locale = await readUiLocale(req);
    return jsonOk(await getPatientCardSummary(id, { episodeId, locale }));
  } catch (err) {
    return handleRouteError(err);
  }
}
