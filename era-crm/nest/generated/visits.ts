import { z } from "zod";
import { SATELLITE_CRM_VISIT_LOGGED } from "@era/contracts";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { createVisit, findLeadById, listVisitsRecent } from "@/lib/visits.service";
import {
  assertLeadInScope,
  leadScopeWhere,
  resolveLeadScopeFromGrants,
} from "@/lib/integrations/lead-scope";
import { enterCrmStaff, crmNestSession, runWithCrmTenant, runWithNestHttp, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  leadId: z.string(),
  notes: z.string().optional(),
  visitedAt: z.string().datetime().optional(),
  addressLabel: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/visits", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
          if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
          const scope = resolveLeadScopeFromGrants({
            permissions: session.permissions ?? [],
            isOwner: session.isOwner === true,
          });
          const leadWhere = await leadScopeWhere(
            session.organizationId,
            session.sub,
            scope,
          );
          const visits = await listVisitsRecent(100, {
            organizationId: session.organizationId,
            lead: leadWhere,
          });
          return sendJson(httpRes, visits);
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/visits", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
          if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
          const body = createSchema.parse(httpReq.body);
          await assertLeadInScope({
            organizationId: session.organizationId,
            userId: session.sub,
            leadId: body.leadId,
            permissions: session.permissions ?? [],
            isOwner: session.isOwner === true,
          });
          const lead = await findLeadById(body.leadId, session.organizationId);
          if (!lead) return sendJson(httpRes, { error: "Lead not found" }, 404);

          const visit = await createVisit({
            organizationId: session.organizationId,
            leadId: body.leadId,
            notes: body.notes,
            addressLabel: body.addressLabel,
            latitude: body.latitude,
            longitude: body.longitude,
            visitedAt: body.visitedAt ? new Date(body.visitedAt) : new Date(),
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

          return sendJson(httpRes, visit, 201);
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
