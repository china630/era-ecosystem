import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  cancelProcedureOrder,
  mapAttendanceHttpStatus,
  ProcedureAttendanceError,
} from "@/domain/procedure/procedure-attendance.service";
import { evaluateAndPublishCapacity } from "@/lib/capacity.service";
import { prisma } from "@/lib/prisma";
import {
  cancelPaidExtraWithFolioReverse,
  cancelUnpaidExtra,
} from "@/domain/sanatorium/extras-assign.service";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";

const schema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_RECEPTION);
    if (denied) return denied;

    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));
    const existing = await prisma.procedureOrder.findUnique({ where: { id } });
    if (existing?.status === "PENDING_PAY" && existing.inPackage === false) {
      await cancelUnpaidExtra(id, session!.sub);
      void evaluateAndPublishCapacity().catch(() => null);
      return jsonOk({ ok: true, status: "CANCELLED" });
    }
    if (
      existing &&
      existing.inPackage === false &&
      existing.extraTicketIssuedAt &&
      (existing.status === "SCHEDULED" || existing.status === "PROPOSED")
    ) {
      const reversed = await cancelPaidExtraWithFolioReverse(id, session!.sub);
      void evaluateAndPublishCapacity().catch(() => null);
      return jsonOk({ ok: true, status: "CANCELLED", ...reversed });
    }

    const updated = await cancelProcedureOrder(
      id,
      { userId: session!.sub, canOverrideCheckIn: false },
      body.reason,
    );
    void evaluateAndPublishCapacity().catch(() => null);
    return jsonOk(updated);
  } catch (err) {
    if (err instanceof ProcedureAttendanceError) {
      return jsonError(err.message, mapAttendanceHttpStatus(err), { code: err.code });
    }
    if (err instanceof PackageAssignError) {
      return jsonError(err.message, err.status, { code: err.code });
    }
    return handleRouteError(err);
  }
}
