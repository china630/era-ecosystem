import { jsonOk, handleRouteError, getRouteSession, jsonError } from "@/lib/api-utils";
import { getPatientCardSummary } from "@/domain/patient/patient-card.service";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await ctx.params;
    const exists = await prisma.patientRef.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return jsonError("Not found", 404);
    const episodeId = new URL(req.url).searchParams.get("episode") ?? undefined;
    return jsonOk(await getPatientCardSummary(id, { episodeId }));
  } catch (err) {
    return handleRouteError(err);
  }
}
