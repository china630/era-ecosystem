import { listMenuItemsForExport } from "@/lib/menu.service";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requestOrganizationId } from "@/lib/request-organization";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/menu/export", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.MENU_MANAGE);
    if (denied) return denied;

    const items = await listMenuItemsForExport(requestOrganizationId());

    const rows: Array<Record<string, unknown>> = [];
    for (const item of items) {
      if (item.priceHistory.length === 0) {
        rows.push({
          plu: item.plu,
          name: item.name,
          category: item.category.name,
          priceAzn: Number(item.priceAzn),
          effectiveFrom: "",
          effectiveTo: "",
          reason: "current",
        });
        continue;
      }
      for (const h of item.priceHistory) {
        rows.push({
          plu: item.plu,
          name: item.name,
          category: item.category.name,
          priceAzn: Number(h.priceAzn),
          effectiveFrom: h.effectiveFrom.toISOString(),
          effectiveTo: h.effectiveTo ? h.effectiveTo.toISOString() : "",
          reason: h.reason ?? "",
        });
      }
    }

    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "menu");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(Uint8Array.from(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="era-kafe-menu.xlsx"',
      },
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
