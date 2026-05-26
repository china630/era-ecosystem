import { z } from "zod";
import { SATELLITE_CRM_LEAD_CONVERTED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import {
  createPortalLink,
  createPaymentLink,
  createShipment,
  createBookingAppointment,
  createPromotion,
  createCustomDomain,
} from "@/integration/control-plane-platform.client";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  counterpartyId: z.string().optional(),
  delivery: z.boolean().optional(),
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

    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim() ?? "";
    const amountNet = converted.estimatedAmount
      ? Number(converted.estimatedAmount)
      : 0;
    let payUrl: string | undefined;
    if (organizationId) {
      if (amountNet > 0) {
        try {
          const link = (await createPaymentLink(
            {
              amountAzn: amountNet,
              sourceEntityType: "crm_lead",
              sourceEntityId: converted.id,
              description: converted.title,
            },
            { organizationId },
          )) as { paymentUrl?: string; portalPayUrl?: string };
          payUrl = link.paymentUrl ?? link.portalPayUrl;
        } catch {
          payUrl = undefined;
        }
      }
      try {
        await createPortalLink(
          { entityType: "crm_lead", entityId: converted.id },
          { organizationId },
        );
      } catch {
        // optional portal
      }
      if (body.delivery === true) {
        try {
          await createShipment(
            {
              sourceEntityType: "crm_lead",
              sourceEntityId: converted.id,
              externalRef: converted.contactRef,
            },
            { organizationId },
          );
        } catch {
          // optional delivery
        }
      }
      try {
        await createBookingAppointment(
          {
            customerRef: converted.contactRef,
            customerName: converted.title,
            scheduledAt: new Date(Date.now() + 86400_000).toISOString(),
            resourceKey: "crm-follow-up",
            metadata: { leadId: converted.id },
          },
          { organizationId },
        );
      } catch {
        // optional follow-up appointment
      }
      try {
        await createPromotion(
          {
            code: `CRM-WON-${converted.id.slice(0, 8)}`,
            name: "CRM lead promotion",
            discountType: "PERCENT",
            discountValue: 5,
            metadata: { leadId: converted.id },
          },
          { organizationId },
        );
      } catch {
        // optional loyalty
      }
      if (body.customHostname?.trim()) {
        try {
          await createCustomDomain(
            {
              hostname: body.customHostname.trim(),
              metadata: { leadId: converted.id },
            },
            { organizationId },
          );
        } catch {
          // optional domain
        }
      }
    }

    await trySendPlatformNotification({
      templateKey: "crm.lead.converted",
      channel: "WHATSAPP",
      messageClass: "TRANSACTIONAL",
      recipient: converted.contactRef,
      sourceEntityType: "crm_lead",
      sourceEntityId: converted.id,
      body: `Lead converted: ${converted.title}${payUrl ? ` — ${payUrl}` : ""}`,
      payload: { channel: converted.channel, payUrl },
    });

    return jsonOk(converted);
  } catch (err) {
    return handleRouteError(err);
  }
}
