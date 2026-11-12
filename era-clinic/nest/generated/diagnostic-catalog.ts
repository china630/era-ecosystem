import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { filterAndSortCatalogItems, getDiagnosticCatalog } from "@/domain/catalog/diagnostic-catalog";
import { getCatalogFavorites } from "@/domain/catalog/catalog-favorites.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const querySchema = z.object({
  kinds: z.string().optional(),
  search: z.string().optional(),
  applyFavorites: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/diagnostic-catalog", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CATALOG_READ);
    if (denied) return denied;

        const url = new URL(req.url);
    const query = querySchema.parse({
      kinds: url.searchParams.get("kinds") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      applyFavorites: url.searchParams.get("applyFavorites") ?? undefined,
    });

    const catalog = await getDiagnosticCatalog();
    const favorites = await getCatalogFavorites();
    const kinds = query.kinds
      ? query.kinds.split(",").map((k) => k.trim()).filter(Boolean)
      : undefined;

    const items = query.applyFavorites
      ? filterAndSortCatalogItems(catalog.items, favorites.keys, favorites.mode, {
          kinds,
          search: query.search,
        })
      : filterAndSortCatalogItems(catalog.items, [], "first", {
          kinds,
          search: query.search,
        });

    return sendJson(httpRes, {
      version: catalog.version,
      metaFields: catalog.metaFields,
      groups: catalog.groups,
      items,
      favorites,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
