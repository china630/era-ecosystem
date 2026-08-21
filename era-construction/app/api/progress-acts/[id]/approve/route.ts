import { satelliteOrganizationId } from "@era/satellite-kit";
import { SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED } from "@era/contracts";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api-utils";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import {
  createPortalLink,
  createPaymentLink,
  createBookingSlot,
  createPromotion,
  createCustomDomain,
} from "@/integration/control-plane-platform.client";
import { progressActReopenDenied } from "@/lib/progress-act-status";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  customHostname: z.string().max(253).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const { id } = await params;
    const act = await prisma.progressAct.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!act) return jsonError("Progress act not found", 404);
    // Idempotent approve; reopen / reverse is refused by progressActReopenDenied.
    if (act.status === "APPROVED" || progressActReopenDenied(act.status)) {
      return jsonOk(act);
    }

    const approved = await prisma.progressAct.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date() },
      include: { project: true },
    });

    await dispatchSatelliteEvent({
      type: SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED,
      payload: {
        projectId: approved.projectId,
        actId: approved.id,
        amountNet: Number(approved.amountNet),
        currency: "AZN",
        periodKey: approved.periodKey ?? undefined,
      },
    });

    const organizationId = satelliteOrganizationId();
    const amountNet = Number(approved.amountNet);
    let payUrl: string | undefined;
    if (organizationId && amountNet > 0) {
      try {
        const link = (await createPaymentLink(
          {
            amountAzn: amountNet,
            sourceEntityType: "construction_progress_act",
            sourceEntityId: approved.id,
            description: `Act ${approved.periodKey ?? approved.id}`,
          },
          { organizationId },
        )) as { paymentUrl?: string; portalPayUrl?: string };
        payUrl = link.paymentUrl ?? link.portalPayUrl;
      } catch {
        payUrl = undefined;
      }
      try {
        await createPortalLink(
          {
            entityType: "construction_progress_act",
            entityId: approved.id,
          },
          { organizationId },
        );
      } catch {
        // optional portal
      }
      try {
        await createBookingSlot(
          {
            resourceKey: "site-visit",
            resourceName: `Site visit ${approved.project.code}`,
            startsAt: new Date(Date.now() + 86400_000).toISOString(),
            endsAt: new Date(Date.now() + 90000_000).toISOString(),
            capacity: 4,
            metadata: { projectId: approved.projectId, actId: approved.id },
          },
          { organizationId },
        );
      } catch {
        // optional site visit slot
      }
      try {
        await createPromotion(
          {
            code: `CON-ACT-${approved.id.slice(0, 8)}`,
            name: "Construction act promotion",
            discountType: "PERCENT",
            discountValue: 5,
            metadata: { actId: approved.id, projectId: approved.projectId },
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
              metadata: { actId: approved.id },
            },
            { organizationId },
          );
        } catch {
          // optional domain
        }
      }
    }

    await trySendPlatformNotification({
      templateKey: "construction.act.approved",
      channel: "EMAIL",
      messageClass: "FINANCIAL",
      recipient: approved.project.code,
      sourceEntityType: "construction_progress_act",
      sourceEntityId: approved.id,
      body: `Progress act approved: ${amountNet.toFixed(2)} AZN${payUrl ? ` — ${payUrl}` : ""}`,
      payload: {
        projectId: approved.projectId,
        periodKey: approved.periodKey,
        payUrl,
      },
    });

    return jsonOk(approved);
  } catch (err) {
    return handleRouteError(err);
  }
}
