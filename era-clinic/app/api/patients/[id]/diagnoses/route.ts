import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
} from "@/lib/api-utils";
import { patientCardDiagnosisWriteDenied } from "@/lib/patient-card-gates";
import {
  addEpisodeDiagnosis,
  deleteEpisodeDiagnosis,
  listEpisodeDiagnoses,
  updateEpisodeDiagnosis,
} from "@/domain/icd/diagnosis-write.service";
import { resolveEpisodeForPatient } from "@/domain/sanatorium/episode-resolve";
import { EPISODE_CLOSED, episodeWriteDenied } from "@/domain/sanatorium/episode-gates";

const createSchema = z.object({
  icdCodeId: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
  episodeId: z.string().min(1).optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  icdCodeId: z.string().min(1).optional(),
  note: z.string().max(500).optional().nullable(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await ctx.params;
    const episodeParam = new URL(req.url).searchParams.get("episode");
    const episode = await resolveEpisodeForPatient(id, episodeParam);
    if (!episode) return jsonOk({ items: [], episodeId: null, status: null });
    return jsonOk({
      items: await listEpisodeDiagnoses(episode.id),
      episodeId: episode.id,
      status: episode.status,
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
    const body = createSchema.parse(await req.json());
    const episodeParam =
      body.episodeId ?? new URL(req.url).searchParams.get("episode");
    const episode = await resolveEpisodeForPatient(id, episodeParam);
    const denied = patientCardDiagnosisWriteDenied(Boolean(episode && episode.status === "OPEN"));
    if (denied || !episode) {
      return jsonError(denied ?? "No open sanatorium episode", 409, { code: "NO_OPEN_EPISODE" });
    }
    const closed = episodeWriteDenied(episode.status);
    if (closed) return jsonError(closed, 409, { code: EPISODE_CLOSED });
    const row = await addEpisodeDiagnosis(episode.id, {
      icdCodeId: body.icdCodeId,
      note: body.note,
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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id: patientRefId } = await ctx.params;
    const body = updateSchema.parse(await req.json());
    const row = await updateEpisodeDiagnosis(body.id, patientRefId, {
      icdCodeId: body.icdCodeId,
      note: body.note,
    });
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
