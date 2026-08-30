import { jsonOk, jsonError, handleRouteError, getRouteSession } from "@/lib/api-utils";
import { listPatientEpisodes } from "@/domain/sanatorium/episode-resolve";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
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
    return jsonOk({ items: await listPatientEpisodes(id) });
  } catch (err) {
    return handleRouteError(err);
  }
}
