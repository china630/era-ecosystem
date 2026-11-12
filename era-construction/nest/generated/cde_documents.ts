import { z } from "zod";
import { createDrawingRevision, listDrawingRevisions } from "@/lib/cde-documents.service";
import { enterConstructionStaff, constructionNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithConstructionTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  projectId: z.string(),
  drawingCode: z.string(),
  revision: z.string(),
  fileName: z.string().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/cde/documents", async (httpReq, httpRes) => {
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
    const projectId = new URL(req.url).searchParams.get("projectId");
    const rows = await listDrawingRevisions(projectId);
    return sendJson(httpRes, { documents: rows });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/cde/documents", async (httpReq, httpRes) => {
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
    const body = bodySchema.parse(httpReq.body);
    const row = await createDrawingRevision(body);
    return sendJson(httpRes, row, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
