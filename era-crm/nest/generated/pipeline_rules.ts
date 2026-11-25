import { z } from "zod";
import { LeadStage } from "@prisma/client";
import {
  createPipelineRule,
  listPipelineRules,
  updatePipelineRule,
} from "@/lib/pipeline-rules.service";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  name: z.string().min(1),
  triggerStage: z.nativeEnum(LeadStage).optional(),
  targetStage: z.nativeEnum(LeadStage),
  triggerType: z.string().optional(),
  configJson: z.record(z.unknown()).optional(),
  actionJson: z.record(z.unknown()).optional(),
  delayMinutes: z.number().int().nonnegative().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  actionJson: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/pipeline/rules", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    if (!session.organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const rules = await listPipelineRules(session.organizationId);
    return sendJson(httpRes, { rules });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/pipeline/rules/:id", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
      if (!session.organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);
      const body = patchSchema.parse(httpReq.body ?? {});
      const rule = await updatePipelineRule(
        session.organizationId,
        String(httpReq.params.id),
        body,
      );
      if (!rule) return sendJson(httpRes, { error: "Not found" }, 404);
      return sendJson(httpRes, rule);
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/pipeline/rules", async (httpReq, httpRes) => {
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
    if (!session.organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = bodySchema.parse(httpReq.body);
    const rule = await createPipelineRule(session.organizationId, body);
    return sendJson(httpRes, rule, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
