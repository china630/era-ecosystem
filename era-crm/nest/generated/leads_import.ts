import { parseCsvText, parseWorkbook, runLeadImport } from "@/lib/leads-import.service";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/leads/import", async (httpReq, httpRes) => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { searchParams } = new URL(req.url);
    const mode =
      searchParams.get("mode") === "create-only" ? "create-only" : "upsert";
    const userId = session.sub;

    const form = await readNestForm(httpReq);
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return sendJson(httpRes, { error: "file required" }, 400);
    }

    const buffer = await file.arrayBuffer();
    const name = file.name.toLowerCase();
    let rows: string[][];
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      rows = parseWorkbook(buffer);
    } else {
      const text = new TextDecoder("utf-8").decode(buffer);
      rows = parseCsvText(text);
    }

    const result = await runLeadImport(rows, file.name, userId, mode);
    return sendJson(httpRes, result, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
