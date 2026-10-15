import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { applyPackageAutoBlocks } from "@/domain/sanatorium/package-auto-apply.service";
import { prisma } from "@/lib/prisma";

/**
 * Super-admin: move the course onto the current package version, then create missing auto visits and labs.
 * Permission: api:procedures.confirm
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
    );
    if (denied) return denied;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;

    const result = await applyPackageAutoBlocks(id, { trigger: "MANUAL_RETRY" });
    return jsonOk(result);
  } catch (err) {
    if (err instanceof Error) {
      const episode = await prisma.clinicalEpisode.findUnique({
        where: { id },
        select: { patientRef: { select: { fullName: true } } },
      });
      const name = episode?.patientRef?.fullName?.trim();
      if (name && !err.message.startsWith(name)) {
        err.message = `${name}: ${err.message}`;
      }
    }
    return handleRouteError(err);
  }
}
