import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
  sessionHasClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  checkInProcedureOrder,
  mapAttendanceHttpStatus,
  ProcedureAttendanceError,
} from "@/domain/procedure/procedure-attendance.service";
import { getClinicSettings } from "@/domain/settings/settings.service";

const schema = z.object({
  qrToken: z.string().min(8).optional(),
  overrideReason: z.string().min(3).max(500).optional(),
  /** Matrix modal reception help path (tenant setting must allow it). */
  source: z.enum(["matrix"]).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    if (!session) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));
    const settings = await getClinicSettings();
    const matrixPath = body.source === "matrix";

    let canOverride = false;
    let overrideReason = body.overrideReason?.trim() || undefined;

    if (matrixPath) {
      const denied = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_PROCEDURES_RECEPTION,
      );
      if (denied) return denied;
      if (settings.receptionProcedureCheckIn !== true) {
        return jsonError("Forbidden", 403, { code: "FORBIDDEN" });
      }
      canOverride = true;
      if (!overrideReason && !body.qrToken) {
        overrideReason = "Reception matrix check-in";
      }
    } else {
      const denied = await requireClinicPermission(
        session,
        CLINIC_PERMISSION.API_PROCEDURES_CHECK_IN,
      );
      if (denied) return denied;
      canOverride =
        sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_DOCTOR) ||
        sessionHasClinicPermission(
          session,
          CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS,
        );
    }

    const updated = await checkInProcedureOrder(
      id,
      { userId: session.sub, canOverrideCheckIn: canOverride },
      {
        qrToken: body.qrToken,
        overrideReason,
      },
    );
    return jsonOk(updated);
  } catch (err) {
    if (err instanceof ProcedureAttendanceError) {
      return jsonError(err.message, mapAttendanceHttpStatus(err), { code: err.code });
    }
    return handleRouteError(err);
  }
}
