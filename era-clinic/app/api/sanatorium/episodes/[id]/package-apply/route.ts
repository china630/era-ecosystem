import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertEpisodeDataScope } from "@/lib/auth/clinic-data-scope";
import { applyPackageAutoBlocks } from "@/domain/sanatorium/package-auto-apply.service";

/**
 * Manual retry of package auto-apply (OPEN / doctor-gated blocks).
 * Permission: api:procedures.confirm
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
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
    );
    if (denied) return denied;
    const { id } = await params;
    const scopeDenied = await assertEpisodeDataScope(session, id);
    if (scopeDenied) return scopeDenied;

    const result = await applyPackageAutoBlocks(id, { trigger: "MANUAL_RETRY" });
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
