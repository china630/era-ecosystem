import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { completeProcedureOrder } from "@/domain/procedure/procedure-completion.service";
import {
  mapAttendanceHttpStatus,
  ProcedureAttendanceError,
} from "@/domain/procedure/procedure-attendance.service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_COMPLETE);
    if (denied) return denied;

    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      consumableLines?: Array<{ sku: string; qty: number; description?: string }>;
      amountNet?: number;
      confirmOverQuota?: boolean;
    };

    const result = await completeProcedureOrder(
      id,
      { userId: session!.sub, canOverrideCheckIn: false },
      body,
    );
    return jsonOk(result);
  } catch (err) {
    if (err instanceof ProcedureAttendanceError) {
      return jsonError(err.message, mapAttendanceHttpStatus(err), { code: err.code });
    }
    if (err instanceof Error && err.message.includes("quota exceeded")) {
      return jsonError(err.message, 409);
    }
    return handleRouteError(err);
  }
}
