import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertLabOrderDataScope } from "@/lib/auth/clinic-data-scope";
import { createPortalLink, createShipment, createPromotion, createCustomDomain } from "@/integration/control-plane-platform.client";
import { labPublishDenied } from "@/lib/lab-order-status-gates";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { findLabOrderWithPatientVisit, markLabOrderPublished } from "@/domain/lab/lab-order-write.service";


const bodySchema = z.object({
  homeDelivery: z.boolean().optional(),
  customHostname: z.string().optional(),
});

@Controller()
export class LabOrdersIdPublishController {

  @UseGuards(ClinicApiGuard)
  @Post("api/lab-orders/:id/publish")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_PUBLISH);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const body = bodySchema.parse((httpReq.body ?? {}));
    const order = await findLabOrderWithPatientVisit(id);
    if (!order) throw new HttpException({ error: "Lab order not found" }, 404);
    const { labAwaitingPaymentDenied } = await import("@/domain/lab/lab-order-pay-gate");
    const unpaid = labAwaitingPaymentDenied(order);
    if (unpaid) throw new HttpException({ error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    const publishBlock = labPublishDenied(order.status, Boolean(order.resultJson));
    if (publishBlock) throw new HttpException({ error: publishBlock }, 400);

    const organizationId = requestOrganizationId();
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
      await trySendPlatformNotification(
        {
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
        },
        { organizationId },
      );
      if (phone.includes("@")) {
        await trySendPlatformNotification(
          {
            templateKey: "clinic.lab.results.ready",
            channel: "EMAIL",
            messageClass: "TRANSACTIONAL",
            recipient: phone,
            sourceEntityType: "lab_order",
            sourceEntityId: order.id,
            subject: "Lab results ready",
            body: portalUrl
              ? `Your lab results are ready: ${portalUrl}`
              : "Your lab results are ready in the patient portal.",
            payload: { portalUrl },
          },
          { organizationId },
        );
      }
    }

    const published = await markLabOrderPublished(id, portalUrl ?? null);

    return { ...published, portalUrl };
  
        });
  }
}
