import { z } from "zod";
import { createToolCheckout, findOpenToolCheckout, findToolById, returnToolCheckout } from "@/lib/tool.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const bodySchema = z.object({
  toolId: z.string(),
  checkedOutBy: z.string(),
  return: z.boolean().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/tools/checkout", async (httpReq, httpRes) => {
    if (!(await enterAutoStaff(httpReq, httpRes))) return;
    try {
      const session = await autoNestSession(httpReq);
      const web = await runWithAutoTenant(session, async () => {
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
    const tool = await findToolById(body.toolId);
    if (!tool) return sendJson(httpRes, { error: "Tool not found" }, 404);

    if (body.return) {
      const open = await findOpenToolCheckout(body.toolId);
      if (!open) return sendJson(httpRes, { error: "No open checkout" }, 404);
      const updated = await returnToolCheckout(open.id);
      return sendJson(httpRes, updated);
    }

    const checkout = await createToolCheckout(body.toolId, body.checkedOutBy);
    return sendJson(httpRes, checkout, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
