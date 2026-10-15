import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
} from "@/lib/api-utils";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { prisma } from "@/lib/prisma";
import { applyPackageAutoBlocks } from "@/domain/sanatorium/package-auto-apply.service";

/**
 * Super-admin: re-apply the current package version on every OPEN course that already has a program.
 * Closed courses are left alone; they pick up the current template when opened.
 */
export async function POST() {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    if (!isPlatformSuperAdminUser({ email: session.email, login: session.login })) {
      return jsonError("Forbidden", 403);
    }

    const episodes = await prisma.clinicalEpisode.findMany({
      where: {
        status: "OPEN",
        programInstance: { isNot: null },
      },
      select: { id: true, patientRef: { select: { fullName: true } } },
    });

    let updated = 0;
    const failed: Array<{ id: string; name: string }> = [];
    for (const episode of episodes) {
      try {
        await applyPackageAutoBlocks(episode.id, { trigger: "MANUAL_RETRY" });
        updated += 1;
      } catch {
        failed.push({
          id: episode.id,
          name: episode.patientRef?.fullName?.trim() || episode.id,
        });
      }
    }
    return jsonOk({ updated, failed });
  } catch (err) {
    return handleRouteError(err);
  }
}
