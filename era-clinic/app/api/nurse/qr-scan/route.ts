import { z } from "zod";
import { jsonOk, jsonError, handleRouteError, getRouteSession, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { verifyGuestQrToken } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(8),
  date: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_NURSE_QR_SCAN);
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
        status: { in: ["SCHEDULED", "CHECKED_IN"] },
      },
      include: { patientRef: true },
      orderBy: { scheduledAt: "asc" },
    });

    return jsonOk({
      globalPersonId: payload.globalPersonId,
      patientRefId: patient.id,
      patientName: patient.fullName,
      orders,
      /** Client must pass this token again on check-in (anti-fraud). */
      qrToken: body.token.trim(),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
