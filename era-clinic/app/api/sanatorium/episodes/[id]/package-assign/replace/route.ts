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
  PackageAssignError,
  replacePackageProcedures,
} from "@/domain/sanatorium/package-assign.service";
import { sessionHasClinicPermission } from "@/lib/auth/clinic-permission-check";

const schema = z.object({
  fromCode: z.string().min(1),
  toCode: z.string().min(1),
  qty: z.number().int().positive().max(40),
  assignBatchId: z.string().optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
});

export async function POST(
  req: Request,
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
    const body = schema.parse(await req.json());

    const isManager = sessionHasClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_FO_MANAGER,
    );

    const result = await replacePackageProcedures(
      id,
      body,
      {
        confirmedByUserId: session.sub,
        allowOutOfPackage: isManager,
      },
    );
    return jsonOk(result);
  } catch (err) {
    if (err instanceof PackageAssignError) {
      return jsonError(err.message, err.status, { code: err.code });
    }
    return handleRouteError(err);
  }
}
