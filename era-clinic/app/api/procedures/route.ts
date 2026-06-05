import { z } from "zod";
import {
  jsonOk,
  handleRouteError,
  getRouteSession,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [
      CLINIC_ROLE.NURSE,
      CLINIC_ROLE.DOCTOR,
      CLINIC_ROLE.RECEPTION,
    ]);
    if (denied) return denied;
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const day = date ? new Date(date) : new Date();
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);

    const orders = await prisma.procedureOrder.findMany({
      where: {
        scheduledAt: { gte: day, lt: next },
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      },
      include: { patientRef: true },
      orderBy: { scheduledAt: "asc" },
    });
    return jsonOk(orders);
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  patientRefId: z.string(),
  procedureCode: z.string(),
  procedureName: z.string(),
  scheduledAt: z.string().datetime(),
  patientOrigin: z.enum(["WALK_IN", "IN_HOUSE"]).default("WALK_IN"),
  reservationId: z.string().optional(),
  amountNet: z.number().nonnegative().optional(),
});

export async function POST(req: Request) {
  try {
    await getRouteSession();
    const body = createSchema.parse(await req.json());
    const order = await prisma.procedureOrder.create({
      data: {
        patientRefId: body.patientRefId,
        procedureCode: body.procedureCode,
        procedureName: body.procedureName,
        scheduledAt: new Date(body.scheduledAt),
        patientOrigin: body.patientOrigin,
        reservationId: body.reservationId,
        amountNet: body.amountNet ?? 0,
      },
      include: { patientRef: true },
    });
    return jsonOk(order, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
