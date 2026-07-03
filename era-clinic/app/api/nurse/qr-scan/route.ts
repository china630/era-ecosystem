import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getRouteSession, requireClinicRole } from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { verifyGuestQrToken } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(8),
  date: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [CLINIC_ROLE.NURSE, CLINIC_ROLE.DOCTOR]);
    if (denied) return denied;

    const body = schema.parse(await req.json());
    const payload = await verifyGuestQrToken(body.token.trim());
    if (!payload?.globalPersonId) {
      return jsonError("Invalid or expired guest QR token", 400);
    }

    const day = body.date ? new Date(`${body.date}T00:00:00`) : new Date();
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);

    const patient = await prisma.patientRef.findFirst({
      where: { globalPersonId: payload.globalPersonId },
    });
    if (!patient) return jsonError("Guest not registered in clinic", 404);

    const orders = await prisma.procedureOrder.findMany({
      where: {
        patientRefId: patient.id,
        scheduledAt: { gte: day, lt: next },
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      },
      include: { patientRef: true },
      orderBy: { scheduledAt: "asc" },
    });

    return jsonOk({
      globalPersonId: payload.globalPersonId,
      patientRefId: patient.id,
      patientName: patient.fullName,
      orders,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
