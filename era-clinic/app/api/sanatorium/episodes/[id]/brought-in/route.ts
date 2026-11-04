import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { broughtInIsFresh } from "@/domain/lab/brought-in-result";
import { cancelLabOrder } from "@/domain/lab/lab-order-cancel.service";

const bodySchema = z.object({
  serviceCode: z.string().min(1),
  resultOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (denied) return denied;
    const { id } = await params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const body = bodySchema.parse(await req.json());
    const episode = await prisma.clinicalEpisode.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });
    if (!episode) return jsonError("Episode not found", 404);
    const service = await prisma.diagnosticService.findFirst({
      where: {
        organizationId: episode.organizationId,
        active: true,
        broughtInMaxDays: { not: null },
        OR: [{ code: body.serviceCode }, { serviceCode: body.serviceCode }],
      },
      select: { code: true, broughtInMaxDays: true },
    });
    if (!service || service.broughtInMaxDays == null) {
      return jsonError("This lab does not accept a brought-in blank", 400);
    }
    if (!body.resultOn) {
      await prisma.episodeBroughtInResult.deleteMany({
        where: { episodeId: id, serviceCode: service.code },
      });
      return jsonOk({ serviceCode: service.code, resultOn: null });
    }
    if (!broughtInIsFresh(body.resultOn, service.broughtInMaxDays)) {
      return jsonError("Brought-in blank is outside the accepted window", 400);
    }
    const orgId = episode.organizationId || requestOrganizationId();
    const row = await prisma.episodeBroughtInResult.upsert({
      where: { episodeId_serviceCode: { episodeId: id, serviceCode: service.code } },
      create: {
        organizationId: orgId,
        episodeId: id,
        serviceCode: service.code,
        resultOn: new Date(`${body.resultOn}T00:00:00.000Z`),
      },
      update: { resultOn: new Date(`${body.resultOn}T00:00:00.000Z`) },
    });
    const openOrders = await prisma.labOrder.findMany({
      where: {
        clinicalEpisodeId: id,
        status: "ORDERED",
        items: { some: { serviceCode: service.code } },
      },
      select: { id: true },
    });
    for (const order of openOrders) {
      await cancelLabOrder(order.id, { userId: session.sub, reason: "brought_in_blank" });
    }
    return jsonOk({ serviceCode: row.serviceCode, resultOn: body.resultOn });
  } catch (e) {
    return handleRouteError(e);
  }
}
