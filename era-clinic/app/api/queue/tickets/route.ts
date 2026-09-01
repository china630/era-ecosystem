import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  visitId: z.string(),
  desk: z.string().optional(),
});

async function nextQueueNumber(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const last = await prisma.queueTicket.findFirst({
    where: { createdAt: { gte: startOfDay } },
    orderBy: { queueNumber: "desc" },
    select: { queueNumber: true },
  });
  return (last?.queueNumber ?? 0) + 1;
}

export async function POST(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_QUEUE);
    if (denied) return denied;

    const body = createSchema.parse(await req.json());
    const visit = await prisma.visit.findUnique({ where: { id: body.visitId } });
    if (!visit) return jsonError("Visit not found", 404);

    const existing = await prisma.queueTicket.findFirst({
      where: { visitId: body.visitId, status: { in: ["WAITING", "CALLED"] } },
    });
    if (existing) return jsonOk(existing, 200);

    const ticket = await prisma.queueTicket.create({
      data: {
        visitId: body.visitId,
        queueNumber: await nextQueueNumber(),
        desk: body.desk,
      },
      include: {
        visit: { include: { patientRef: true, practitioner: true } },
      },
    });
    return jsonOk(ticket, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
