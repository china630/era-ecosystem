import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import {
  addEpisodeCareDoctor,
  listEpisodeCareDoctors,
  removeEpisodeCareDoctor,
} from "@/domain/sanatorium/episode-care-team.service";
import { EPISODE_CLOSED } from "@/domain/sanatorium/episode-gates";
import { instantiateIntakePackage } from "@/domain/patient/instantiate-intake.service";
import { resolveClinicDataScope } from "@/lib/auth/clinic-data-scope";
import { prisma } from "@/lib/prisma";

const addSchema = z.object({
  practitionerId: z.string().min(1),
});

/**
 * First care-team assign requires scope ALL (reception/admin).
 * Later adds: assigned doctor already on the team (or ALL).
 */
async function assertCareTeamMutateAccess(
  session: NonNullable<Awaited<ReturnType<typeof getRouteSession>>>,
  episodeId: string,
): Promise<Response | null> {
  const scope = await resolveClinicDataScope(
    session,
    CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
  );
  if (scope.mode === "ALL") return null;

  const count = await prisma.episodeCareDoctor.count({ where: { episodeId } });
  if (count === 0) {
    return jsonError("Episode not found", 404);
  }
  return assertEpisodeDataScope(session, episodeId);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ,
    );
    if (denied) return denied;
    const { id } = await params;

    const episode = await prisma.clinicalEpisode.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });
    if (!episode) return jsonError("Episode not found", 404);

    const scope = await resolveClinicDataScope(
      session,
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
    );
    if (scope.mode !== "ALL") {
      const scopeDenied = await assertEpisodeDataScope(session, id);
      if (scopeDenied) return scopeDenied;
    }

    const items = await listEpisodeCareDoctors(id);
    const taken = new Set(items.map((i) => i.practitionerId));
    const docs = await prisma.practitioner.findMany({
      where: {
        organizationId: episode.organizationId,
        active: true,
        staffKind: "DOCTOR",
      },
      orderBy: { fullName: "asc" },
      select: { id: true, code: true, fullName: true, specialty: true },
    });
    const candidates = docs.filter((d) => !taken.has(d.id));

    return jsonOk({ items, candidates });
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
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (denied) return denied;
    const { id } = await params;
    const accessDenied = await assertCareTeamMutateAccess(session, id);
    if (accessDenied) return accessDenied;

    const body = addSchema.parse(await req.json());
    const before = await prisma.episodeCareDoctor.count({ where: { episodeId: id } });
    try {
      const row = await addEpisodeCareDoctor({
        episodeId: id,
        practitionerId: body.practitionerId,
        assignedByUserId: session.sub,
      });
      if (before === 0) {
        await instantiateIntakePackage(id).catch(() => null);
      }
      return jsonOk(row);
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === EPISODE_CLOSED) {
        return jsonError((err as Error).message, 409, { code: EPISODE_CLOSED });
      }
      if (code === "INVALID_PRACTITIONER") {
        return jsonError((err as Error).message, 400, { code });
      }
      if (code === "CARE_DOCTOR_EXISTS") {
        return jsonError((err as Error).message, 409, { code });
      }
      if (code === "LAST_CARE_DOCTOR") {
        return jsonError((err as Error).message, 409, { code });
      }
      if (code === "NOT_FOUND") {
        return jsonError((err as Error).message, 404, { code });
      }
      throw err;
    }
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
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE,
    );
    if (denied) return denied;
    const { id } = await params;
    const accessDenied = await assertCareTeamMutateAccess(session, id);
    if (accessDenied) return accessDenied;

    const url = new URL(req.url);
    const practitionerId =
      url.searchParams.get("practitionerId")?.trim() ||
      (await req.json().catch(() => ({} as { practitionerId?: string }))).practitionerId;
    if (!practitionerId) {
      return jsonError("practitionerId required", 400);
    }

    try {
      await removeEpisodeCareDoctor({ episodeId: id, practitionerId });
      return jsonOk({ ok: true });
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      if (code === EPISODE_CLOSED) {
        return jsonError((err as Error).message, 409, { code: EPISODE_CLOSED });
      }
      if (code === "LAST_CARE_DOCTOR") {
        return jsonError((err as Error).message, 409, { code });
      }
      if (code === "NOT_FOUND") {
        return jsonError((err as Error).message, 404, { code });
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
