import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { patientCardDiagnosisWriteDenied } from "@/lib/patient-card-gates";
import {
  addEpisodeDiagnosis,
  deleteEpisodeDiagnosis,
  listEpisodeDiagnoses,
} from "@/domain/icd/diagnosis-write.service";

const createSchema = z.object({
  icdCodeId: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
});

async function openEpisodeForPatient(patientRefId: string) {
  return prisma.clinicalEpisode.findFirst({
    where: { patientRefId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await ctx.params;
    const episode = await openEpisodeForPatient(id);
    if (!episode) return jsonOk({ items: [], episodeId: null });
    return jsonOk({
      items: await listEpisodeDiagnoses(episode.id),
      episodeId: episode.id,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await ctx.params;
    const episode = await openEpisodeForPatient(id);
    const denied = patientCardDiagnosisWriteDenied(Boolean(episode));
    if (denied || !episode) {
      return jsonError(denied ?? "No open sanatorium episode", 409, { code: "NO_OPEN_EPISODE" });
    }
    const body = createSchema.parse(await req.json());
    const row = await addEpisodeDiagnosis(episode.id, {
      ...body,
      recordedByUserId: session.sub,
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id: patientRefId } = await ctx.params;
    const diagnosisId = new URL(req.url).searchParams.get("id");
    if (!diagnosisId) return jsonError("id required", 400);
    await deleteEpisodeDiagnosis(diagnosisId, patientRefId);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
