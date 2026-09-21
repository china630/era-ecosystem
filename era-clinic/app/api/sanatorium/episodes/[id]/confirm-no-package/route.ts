import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { prisma } from "@/lib/prisma";

/**
 * Ops signal: guest confirmed to have no medical package on this course.
 */
export async function POST(
  _req: Request,
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
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;

    const episode = await prisma.clinicalEpisode.findUnique({
      where: { id },
      select: { id: true, status: true, noPackageConfirmedAt: true },
    });
    if (!episode) return jsonError("Episode not found", 404);
    if (episode.status !== "OPEN") {
      return jsonError("Episode is closed", 409, { code: "EPISODE_CLOSED" });
    }

    const updated = await prisma.clinicalEpisode.update({
      where: { id },
      data: {
        noPackageConfirmedAt: episode.noPackageConfirmedAt ?? new Date(),
        noPackageConfirmedByUserId: session.sub,
      },
      select: {
        id: true,
        noPackageConfirmedAt: true,
        noPackageConfirmedByUserId: true,
      },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Undo the signal — the package arrived (or was confirmed by mistake), so
 * entitlement pricing takes over again instead of billing everything at list price.
 */
export async function DELETE(
  _req: Request,
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
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;

    const episode = await prisma.clinicalEpisode.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!episode) return jsonError("Episode not found", 404);

    const updated = await prisma.clinicalEpisode.update({
      where: { id },
      data: {
        noPackageConfirmedAt: null,
        noPackageConfirmedByUserId: null,
      },
      select: {
        id: true,
        noPackageConfirmedAt: true,
        noPackageConfirmedByUserId: true,
      },
    });
    return jsonOk(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
