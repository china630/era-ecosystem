import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { resolveEpisodeForPatient } from "@/domain/sanatorium/episode-resolve";
import { EPISODE_CLOSED, episodeWriteDenied } from "@/domain/sanatorium/episode-gates";
import {
  addComplaint,
  deleteEpisodeComplaint,
  listEpisodeComplaints,
  updateEpisodeComplaint,
} from "@/lib/services/sanatorium.service";

const createSchema = z.object({
  text: z.string().min(1).max(2000),
  episodeId: z.string().min(1).optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const { id } = await ctx.params;
    const episodeParam = new URL(req.url).searchParams.get("episode");
    const episode = await resolveEpisodeForPatient(id, episodeParam);
    if (!episode) return jsonOk({ items: [], episodeId: null, status: null });
    return jsonOk({
      items: await listEpisodeComplaints(episode.id),
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
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const { id } = await ctx.params;
    const body = createSchema.parse(await req.json());
    const episodeParam =
      body.episodeId ?? new URL(req.url).searchParams.get("episode");
    const episode = await resolveEpisodeForPatient(id, episodeParam);
    if (!episode) {
      return jsonError("No sanatorium episode", 409, { code: "NO_OPEN_EPISODE" });
    }
    const closed = episodeWriteDenied(episode.status);
    if (closed) return jsonError(closed, 409, { code: EPISODE_CLOSED });
    const row = await addComplaint(episode.id, body.text);
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
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const { id: patientRefId } = await ctx.params;
    const complaintId = new URL(req.url).searchParams.get("id");
    if (!complaintId) return jsonError("id required", 400);
    await deleteEpisodeComplaint(complaintId, patientRefId);
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
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

        const { id: patientRefId } = await ctx.params;
    const body = updateSchema.parse(await req.json());
    const row = await updateEpisodeComplaint(body.id, patientRefId, body.text);
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
