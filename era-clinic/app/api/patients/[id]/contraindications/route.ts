import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { BODY_PART_CODES } from "@/lib/body-part-codes";
import { prisma } from "@/lib/prisma";
import {
  EPISODE_CLOSED,
  episodeWriteDenied,
  NO_OPEN_EPISODE,
} from "@/domain/sanatorium/episode-gates";

const bodySchema = z.object({
  bodyPart: z.enum(BODY_PART_CODES),
  note: z.string().optional(),
  episodeId: z.string().min(1),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

    const { id } = await params;
    const url = new URL(req.url);
    const episodeId = url.searchParams.get("episode");
    const rows = await prisma.patientContraindication.findMany({
      where: {
        patientRefId: id,
        ...(episodeId ? { episodeId } : {}),
      },
    });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

    const { id: patientRefId } = await params;
    const url = new URL(req.url);
    const rowId = url.searchParams.get("id");
    if (!rowId) return jsonError("id required", 400);
    const existing = await prisma.patientContraindication.findFirst({
      where: { id: rowId, patientRefId },
      select: { id: true, episodeId: true, episode: { select: { status: true } } },
    });
    if (!existing) return jsonError("Not found", 404);
    if (existing.episodeId) {
      const closed = episodeWriteDenied(existing.episode?.status);
      if (closed) return jsonError(closed, 409, { code: EPISODE_CLOSED });
    }
    await prisma.patientContraindication.deleteMany({
      where: { id: rowId, patientRefId },
    });
    return jsonOk({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PATIENTS);
    if (denied) return denied;

    const { id } = await params;
    const body = bodySchema.parse(await req.json());
    const episode = await prisma.clinicalEpisode.findFirst({
      where: { id: body.episodeId, patientRefId: id },
      select: { id: true, status: true },
    });
    if (!episode) {
      return jsonError("Episode not found for patient", 404, { code: NO_OPEN_EPISODE });
    }
    const closed = episodeWriteDenied(episode.status);
    if (closed) {
      return jsonError(closed, 409, { code: EPISODE_CLOSED });
    }
    const row = await prisma.patientContraindication.create({
      data: {
        patientRefId: id,
        episodeId: episode.id,
        bodyPart: body.bodyPart,
        note: body.note,
      },
    });
    return jsonOk(row, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
