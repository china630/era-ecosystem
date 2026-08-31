import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";
import { instantiateProgramFromTemplate } from "@/lib/sanatorium-scheduler.service";
import {
  addComplaint,
  addDiagnosis,
  closeWalkInEpisode,
  completeCheckupAndSchedule,
  createEpisodeLabOrder,
  getEpisode,
} from "@/lib/services/sanatorium.service";
import { ANAMNESIS_REQUIRED, episodeAnamnesisDenied } from "@/domain/sanatorium/episode-gates";

const complaintSchema = z.object({ text: z.string().min(1) });
const diagnosisSchema = z.object({
  icdCodeId: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
});
const labSchema = z.object({ testCode: z.string().min(1) });
const instantiateProgramSchema = z.object({
  programCode: z.string().min(1),
  startsOn: z.string().min(1),
});
const completeCheckupSchema = z.object({
  programCode: z.string().min(1).optional(),
  startsOn: z.string().min(1).optional(),
});
const patchSchema = z.object({
  anamnesisText: z.string().max(20000).optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const episode = await getEpisode(id);
    return jsonOk(episode);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const episode = await prisma.clinicalEpisode.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!episode) return jsonError("Episode not found", 404);
    const { EPISODE_CLOSED, episodeWriteDenied } = await import(
      "@/domain/sanatorium/episode-gates"
    );
    const closed = episodeWriteDenied(episode.status);
    if (closed) return jsonError(closed, 409, { code: EPISODE_CLOSED });

    const data: { anamnesisText?: string | null; anamnesisUpdatedAt?: Date | null } = {};
    if (body.anamnesisText !== undefined) {
      const trimmed = body.anamnesisText?.trim() || null;
      data.anamnesisText = trimmed;
      data.anamnesisUpdatedAt = trimmed ? new Date() : null;
    }
    const updated = await prisma.clinicalEpisode.update({
      where: { id },
      data,
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    if (action === "complaint") {
      const parsed = complaintSchema.parse(body);
      return jsonOk(await addComplaint(id, parsed.text));
    }
    if (action === "diagnosis") {
      const parsed = diagnosisSchema.parse(body);
      const session = await getRouteSession();
      return jsonOk(
        await addDiagnosis(id, {
          ...parsed,
          recordedByUserId: session?.sub ?? null,
        }),
      );
    }
    if (action === "lab") {
      const parsed = labSchema.parse(body);
      return jsonOk(await createEpisodeLabOrder(id, parsed.testCode));
    }
    if (action === "instantiate-program") {
      const parsed = instantiateProgramSchema.parse(body);
      const existing = await prisma.programInstance.findUnique({
        where: { episodeId: id },
      });
      if (existing) return jsonError("Program already assigned", 409);
      const episode = await prisma.clinicalEpisode.findUnique({ where: { id } });
      if (!episode) return jsonError("Episode not found", 404);
      const { episodeAnamnesisDenied, ANAMNESIS_REQUIRED } = await import(
        "@/domain/sanatorium/episode-gates"
      );
      const denied = episodeAnamnesisDenied(episode.anamnesisText);
      if (denied) return jsonError(denied, 409, { code: ANAMNESIS_REQUIRED });
      const instance = await instantiateProgramFromTemplate({
        episodeId: id,
        programCode: parsed.programCode,
        reservationId: episode.reservationId ?? undefined,
        startsOn: new Date(parsed.startsOn),
      });
      return jsonOk(instance);
    }
    if (action === "complete-checkup") {
      const parsed = completeCheckupSchema.parse(body);
      return jsonOk(
        await completeCheckupAndSchedule({
          episodeId: id,
          programCode: parsed.programCode,
          startsOn: parsed.startsOn ? new Date(parsed.startsOn) : undefined,
        }),
      );
    }
    if (action === "close") {
      const session = await getRouteSession();
      const denied = requireClinicRole(session, [CLINIC_ROLE.RECEPTION, CLINIC_ROLE.DOCTOR]);
      if (denied) return denied;
      return jsonOk(await closeWalkInEpisode(id));
    }

    return jsonError("Unknown action", 400);
  } catch (err) {
    return handleRouteError(err);
  }
}
