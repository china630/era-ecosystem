import { z } from "zod";
import {
  jsonError,
  jsonOk,
  handleRouteError,
  getRouteSession,
  requireClinicRole,
  hasClinicAdminRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { checkInProcedureOrder, mapAttendanceHttpStatus, ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";
import { prisma } from "@/lib/prisma";
import { satelliteOrganizationId } from "@era/satellite-kit";

const ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ACCESS_CODE_RE = new RegExp(`^[${ACCESS_CODE_ALPHABET}]{5}$`);

const schema = z.object({
  code: z
    .string()
    .trim()
    .length(5)
    .refine((v) => ACCESS_CODE_RE.test(v.toUpperCase()), {
      message: "Invalid access code format",
    }),
});

export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [
      CLINIC_ROLE.FLOOR,
      CLINIC_ROLE.NURSE,
      CLINIC_ROLE.DOCTOR,
    ]);
    if (denied) return denied;

    const { code } = schema.parse(await req.json());
    const normalized = code.toUpperCase();
    const organizationId = satelliteOrganizationId();

    const order = await prisma.procedureOrder.findFirst({
      where: {
        organizationId,
        accessCode: normalized,
        status: "SCHEDULED",
      },
      select: { id: true },
    });
    if (!order) {
      return jsonError("Procedure not found", 404);
    }

    const canOverride =
      hasClinicAdminRole(session!) || session!.role === CLINIC_ROLE.DOCTOR;

    const updated = await checkInProcedureOrder(
      order.id,
      { userId: session!.sub, canOverrideCheckIn: canOverride },
      { accessCode: normalized },
    );

    return jsonOk(updated);
  } catch (err) {
    if (err instanceof ProcedureAttendanceError) {
      return jsonError(err.message, mapAttendanceHttpStatus(err), { code: err.code });
    }
    return handleRouteError(err);
  }
}

