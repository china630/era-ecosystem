import { NextResponse } from "next/server";
import { findActiveOutletByPublicSlug, isOutletPoolUnavailable, listActiveMenuCategoriesForOutlet, listSoldOutMenuItemIdsForOutlet } from "@/lib/public-outlet.service";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { assertPublicMenuQuota } from "@/lib/fnb-quota";
import { enterRequestTenant } from "@/lib/request-organization";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/public/menu/:slug", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    assertPublicMenuQuota(ip);
    const { slug } = httpReq.params;
    let outlet: Awaited<ReturnType<typeof findActiveOutletByPublicSlug>>;
    try {
      outlet = await findActiveOutletByPublicSlug(slug);
    } catch (err) {
      if (isOutletPoolUnavailable(err)) {
        return sendJson(httpRes, { error: "Organization registry unavailable" }, 503);
      }
      throw err;
    }
    if (!outlet) return sendJson(httpRes, { error: "Menu not found" }, 404);
    enterRequestTenant(outlet.organizationId);
    await requireFnbSubmodule("fnb_qr_menu", outlet.organizationId);

    const sold = await listSoldOutMenuItemIdsForOutlet(outlet.organizationId, outlet.id);
    const soldIds = new Set(sold.map((s) => s.menuItemId));

    const categories = await listActiveMenuCategoriesForOutlet(outlet.id);

    return sendJson(httpRes, {
      outlet: { name: outlet.name, code: outlet.code },
      orderEnabled: false,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        items: c.items
          .filter((i) => !soldIds.has(i.id))
          .map((i) => ({
            id: i.id,
            name: i.name,
            priceAzn: i.priceAzn,
            imageUrl: i.imageUrl,
          })),
      })),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/public/menu/:slug", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  return sendJson(httpRes, 
    { error: "Guest ordering is not enabled on QR menu", code: "QR_READ_ONLY" }, 405);

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
