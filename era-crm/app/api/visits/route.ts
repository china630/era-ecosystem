import { z } from "zod";
import { SATELLITE_CRM_VISIT_LOGGED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  leadId: z.string(),
  notes: z.string().optional(),
  visitedAt: z.string().datetime().optional(),
  addressLabel: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export async function GET() {
  try {
    const visits = await prisma.visit.findMany({
      include: { lead: true },
      orderBy: { visitedAt: "desc" },
      take: 100,
    });
    return jsonOk(visits);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
    if (!lead) return jsonError("Lead not found", 404);

    const visit = await prisma.visit.create({
      data: {
        leadId: body.leadId,
        notes: body.notes,
        addressLabel: body.addressLabel,
        latitude: body.latitude,
        longitude: body.longitude,
        visitedAt: body.visitedAt ? new Date(body.visitedAt) : new Date(),
      },
      include: { lead: { include: { owner: true } } },
    });

    await dispatchSatelliteEvent({
      type: SATELLITE_CRM_VISIT_LOGGED,
      payload: {
        visitId: visit.id,
        leadId: visit.leadId,
        channel: lead.channel,
        ownerId: lead.ownerId ?? undefined,
        estimatedAmount: lead.estimatedAmount
          ? Number(lead.estimatedAmount)
          : undefined,
      },
    });

    return jsonOk(visit, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
