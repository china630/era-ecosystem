import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertLabOrderDataScope } from "@/lib/auth/clinic-data-scope";
import { createPortalLink, createShipment, createPromotion, createCustomDomain } from "@/integration/control-plane-platform.client";
import { labPublishDenied } from "@/lib/lab-order-status-gates";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { findLabOrderWithPatientVisit, markLabOrderPublished } from "@/domain/lab/lab-order-write.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  homeDelivery: z.boolean().optional(),
  customHostname: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/lab-orders/:id/publish", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_PUBLISH);
    if (denied) return denied;

    const { id } = httpReq.params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const body = bodySchema.parse((httpReq.body ?? {}));
    const order = await findLabOrderWithPatientVisit(id);
    if (!order) return sendJson(httpRes, { error: "Lab order not found" }, 404);
    const { labAwaitingPaymentDenied } = await import("@/domain/lab/lab-order-pay-gate");
    const unpaid = labAwaitingPaymentDenied(order);
    if (unpaid) return sendJson(httpRes, { error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    const publishBlock = labPublishDenied(order.status, Boolean(order.resultJson));
    if (publishBlock) return sendJson(httpRes, { error: publishBlock }, 400);

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

    return sendJson(httpRes, { ...published, portalUrl });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
