import { z } from "zod";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import {
  createPortalLink,
  createShipment,
  createPromotion,
  createCustomDomain,
} from "@/integration/control-plane-platform.client";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  homeDelivery: z.boolean().optional(),
  customHostname: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const order = await prisma.labOrder.findUnique({
      where: { id },
      include: { patientRef: true, visit: true },
    });
    if (!order) return jsonError("Lab order not found", 404);
    if (order.status !== "RESULT_READY") {
      return jsonError(`Cannot publish from status ${order.status}`, 400);
    }
    if (!order.resultJson) {
      return jsonError("Results required before publish", 400);
    }

    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID ?? "";
    const phone = order.patientRef.phone?.trim();
    let portalUrl: string | undefined;
    if (organizationId && phone) {
      try {
        const link = (await createPortalLink(
          {
            subjectType: "lab_order",
            subjectId: order.id,
            recipientPhone: phone,
            expiresInHours: 72,
          },
          { organizationId },
        )) as { url?: string; portalUrl?: string };
        portalUrl = link.url ?? link.portalUrl;
      } catch {
        portalUrl = undefined;
      }
      if (body.homeDelivery !== false) {
        try {
          await createShipment(
            {
              sourceEntityType: "lab_order",
              sourceEntityId: order.id,
              externalRef: phone,
              recipientPhone: phone,
            },
            { organizationId },
          );
        } catch {
          // optional courier delivery
        }
      }
      try {
        await createPromotion(
          {
            code: `CLI-LAB-${order.id.slice(0, 8)}`,
            name: "Clinic lab promotion",
            discountType: "PERCENT",
            discountValue: 5,
            metadata: { labOrderId: order.id },
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
              metadata: { labOrderId: order.id },
            },
            { organizationId },
          );
        } catch {
          // optional domain
        }
      }
      await trySendPlatformNotification({
        templateKey: "clinic.lab.results.ready",
        channel: "WHATSAPP",
        messageClass: "TRANSACTIONAL",
        recipient: phone,
        sourceEntityType: "lab_order",
        sourceEntityId: order.id,
        body: portalUrl
          ? `Lab results ready: ${portalUrl}`
          : "Lab results are ready in the patient portal.",
        payload: { portalUrl },
      });
    }

    const published = await prisma.labOrder.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        telehealthUrl: portalUrl ?? null,
      },
      include: { patientRef: true, visit: true },
    });

    return jsonOk({ ...published, portalUrl });
  } catch (err) {
    return handleRouteError(err);
  }
}
