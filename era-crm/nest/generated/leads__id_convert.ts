import { requestOrganizationId } from "@/lib/request-organization";
import { z } from "zod";
import { SATELLITE_CRM_LEAD_CONVERTED } from "@era/contracts";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { createPortalLink, createPaymentLink, createShipment, createBookingAppointment, createPromotion, createCustomDomain } from "@/integration/control-plane-platform.client";
import { buildConvertPartyPayload, validatePartyForStage } from "@/lib/lead-party";
import { convertLeadWon, findLeadById } from "@/lib/leads.service";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  counterpartyId: z.string().optional(),
  delivery: z.boolean().optional(),
  customHostname: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/leads/:id/convert", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const body = bodySchema.parse((httpReq.body ?? {}));

    const lead = await findLeadById(id);
    if (!lead) return sendJson(httpRes, { error: "Lead not found" }, 404);
    if (lead.stage === "WON") return sendJson(httpRes, lead);

    const gateError = validatePartyForStage(lead, "WON");
    if (gateError) return sendJson(httpRes, { error: gateError }, 400);

    const converted = await convertLeadWon(id, lead.stage, {
      counterpartyId: body.counterpartyId ?? lead.counterpartyId,
    });

    await dispatchSatelliteEvent({
      type: SATELLITE_CRM_LEAD_CONVERTED,
      payload: {
        leadId: converted.id,
        counterpartyId: converted.counterpartyId ?? undefined,
        ...buildConvertPartyPayload(converted),
        channel: converted.channel,
        estimatedAmount: converted.estimatedAmount
          ? Number(converted.estimatedAmount)
          : undefined,
        currency: "AZN",
      },
    });

    const organizationId = requestOrganizationId();
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

    return sendJson(httpRes, converted);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
