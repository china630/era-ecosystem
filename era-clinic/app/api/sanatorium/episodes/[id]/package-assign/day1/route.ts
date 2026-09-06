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
  PackageAssignError,
  day1AutoAssign,
} from "@/domain/sanatorium/package-assign.service";

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
    const result = await day1AutoAssign(id, {
      confirmedByUserId: session.sub,
    });
    return jsonOk(result);
  } catch (err) {
    if (err instanceof PackageAssignError) {
      return jsonError(err.message, err.status, { code: err.code });
    }
    return handleRouteError(err);
  }
}
