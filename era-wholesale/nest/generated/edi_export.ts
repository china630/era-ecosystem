import { listB2BOrdersForEdiExport } from "@/lib/b2b-order.service";
import { enterWholesaleStaff, wholesaleNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithWholesaleTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/edi/export", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
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
    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "json";
    const apiKey = req.headers.get("x-api-key") ?? url.searchParams.get("apiKey");
    const expected = process.env.WHOLESALE_EDI_API_KEY ?? "wholesale-edi-demo";
    if (apiKey !== expected) {
      return sendJson(httpRes, { error: "Invalid API key" }, 401);
    }

    const orders = await listB2BOrdersForEdiExport();

    if (format === "csv") {
      const header = "orderId,status,createdAt,lineSku,qty";
      const rows = orders.flatMap((o) =>
        (o.pickList?.lines ?? []).map(
          (l) =>
            `${o.id},${o.status},${o.createdAt.toISOString()},${l.skuCode},${l.qtyOrdered}`,
        ),
      );
      const csv = [header, ...rows].join("\n");
      return new Response(csv, {
        headers: { "Content-Type": "text/csv" },
      });
    }

    return sendJson(httpRes, { orders });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
