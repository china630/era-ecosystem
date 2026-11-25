import { requestOrganizationId } from "@/lib/request-organization";
import { z } from "zod";
import { SATELLITE_CRM_LEAD_CONVERTED } from "@era/contracts";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { createPortalLink, createPaymentLink, createShipment, createBookingAppointment, createPromotion, createCustomDomain } from "@/integration/control-plane-platform.client";
import { buildConvertPartyPayload, validatePartyForStage } from "@/lib/lead-party";
import { convertLeadWon, findLeadById } from "@/lib/leads.service";
import { loadConvertSideEffects } from "@/lib/integrations/convert-settings";
import { assertLeadInScope } from "@/lib/integrations/lead-scope";
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

    await assertLeadInScope({
      organizationId: session.organizationId,
      userId: session.sub,
      leadId: String(id),
      permissions: session.permissions ?? [],
      isOwner: session.isOwner === true,
    });
    const lead = await findLeadById(id);
    if (!lead) return sendJson(httpRes, { error: "Lead not found" }, 404);
    if (lead.stage === "WON") return sendJson(httpRes, lead);

    const gateError = validatePartyForStage(lead, "WON");
    if (gateError) return sendJson(httpRes, { error: gateError }, 400);

    const converted = await convertLeadWon(id, lead.stage, {
      counterpartyId: body.counterpartyId ?? lead.counterpartyId,
      authorId: session.sub,
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

    void import("@/lib/integrations/clinic-lead-intent").then(
      ({ publishClinicLeadAppointmentIntent }) =>
        publishClinicLeadAppointmentIntent({
          organizationId: session.organizationId,
          leadId: converted.id,
          pipelineId: converted.pipelineId,
        }),
    );

    const organizationId = requestOrganizationId();
    const amountNet = converted.estimatedAmount
      ? Number(converted.estimatedAmount)
      : 0;
    const sideEffects = organizationId
      ? await loadConvertSideEffects(organizationId)
      : null;
    let payUrl: string | undefined;
    if (organizationId && sideEffects) {
      if (sideEffects.createPaymentLink && amountNet > 0) {
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
      if (sideEffects.createPortalLink) {
        try {
          await createPortalLink(
            { entityType: "crm_lead", entityId: converted.id },
            { organizationId },
          );
        } catch {
          // optional portal
        }
      }
      if (body.delivery === true && sideEffects.createShipment) {
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
      if (sideEffects.createBooking) {
        try {
          const offsetMs = Math.max(0, sideEffects.bookingOffsetDays) * 86400_000;
          await createBookingAppointment(
            {
              customerRef: converted.contactRef,
              customerName: converted.title,
              scheduledAt: new Date(Date.now() + offsetMs).toISOString(),
              resourceKey: "crm-follow-up",
              metadata: { leadId: converted.id },
            },
            { organizationId },
          );
        } catch {
          // optional follow-up appointment
        }
      }
      if (sideEffects.createPromotion) {
        try {
          await createPromotion(
            {
              code: `CRM-WON-${converted.id.slice(0, 8)}`,
              name: "CRM lead promotion",
              discountType: "PERCENT",
              discountValue: sideEffects.promotionPercent,
              metadata: { leadId: converted.id },
            },
            { organizationId },
          );
        } catch {
          // optional loyalty
        }
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

    // E5: persist payment-link status on lead (no PSP in CRM).
    if (payUrl) {
      try {
        const { prisma } = await import("@/lib/prisma");
        const prev = JSON.parse(converted.customJson || "{}") as Record<
          string,
          unknown
        >;
        const next = {
          ...prev,
          _paymentLink: payUrl,
          _paymentStatus: "LINK_ISSUED",
        };
        await prisma.lead.update({
          where: { id: converted.id },
          data: { customJson: JSON.stringify(next) },
        });
        (converted as { customJson?: string }).customJson = JSON.stringify(next);
      } catch {
        /* non-fatal */
      }
    }

    return sendJson(httpRes, converted);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
