import { requestOrganizationId } from "@/lib/request-organization";
import { SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED } from "@era/contracts";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import { createPortalLink, createPaymentLink, createBookingSlot, createPromotion, createCustomDomain } from "@/integration/control-plane-platform.client";
import { progressActReopenDenied } from "@/lib/progress-act-status";
import { approveProgressAct, findProgressActWithProject } from "@/lib/progress-acts.service";
import { z } from "zod";
import { enterConstructionStaff, constructionNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithConstructionTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  customHostname: z.string().max(253).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/progress-acts/:id/approve", async (httpReq, httpRes) => {
    if (!(await enterConstructionStaff(httpReq, httpRes))) return;
    try {
      const session = await constructionNestSession(httpReq);
      const web = await runWithConstructionTenant(session, async () => {
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
    const body = bodySchema.parse((httpReq.body ?? {}));
    const { id } = httpReq.params;
    const act = await findProgressActWithProject(id);
    if (!act) return sendJson(httpRes, { error: "Progress act not found" }, 404);
    // Idempotent approve; reopen / reverse is refused by progressActReopenDenied.
    if (act.status === "APPROVED" || progressActReopenDenied(act.status)) {
      return sendJson(httpRes, act);
    }

    const approved = await approveProgressAct(id);

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

    const organizationId = requestOrganizationId();
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

    return sendJson(httpRes, approved);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
