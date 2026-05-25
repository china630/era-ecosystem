import { z } from "zod";
import { SATELLITE_CRM_LEAD_CONVERTED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  counterpartyId: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return jsonError("Lead not found", 404);
    if (lead.stage === "WON") return jsonOk(lead);

    const converted = await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: {
          stage: "WON",
          convertedAt: new Date(),
          counterpartyId: body.counterpartyId ?? lead.counterpartyId,
        },
      });
      await tx.leadStageHistory.create({
        data: {
          leadId: id,
          fromStage: lead.stage,
          toStage: "WON",
        },
      });
      return updated;
    });

    await dispatchSatelliteEvent({
      type: SATELLITE_CRM_LEAD_CONVERTED,
      payload: {
        leadId: converted.id,
        counterpartyId: converted.counterpartyId ?? undefined,
        channel: converted.channel,
        estimatedAmount: converted.estimatedAmount
          ? Number(converted.estimatedAmount)
          : undefined,
        currency: "AZN",
      },
    });

    return jsonOk(converted);
  } catch (err) {
    return handleRouteError(err);
  }
}
