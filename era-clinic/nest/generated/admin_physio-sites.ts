import { z } from "zod";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { createPhysioSite, listPhysioSites } from "@/domain/physio/physio-catalog.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  code: z.string().min(1),
  kind: z.enum(["USSR-817", "SHCHERBAK", "HYDRO", "LOCAL"]),
  prikaz817: z.number().int().nullable().optional(),
  laterality: z.boolean().optional(),
  titleAz: z.string().min(1),
  titleRu: z.string().min(1),
  titleEn: z.string().min(1),
  titleLa: z.string().min(1),
  boundary: z.string().nullable().optional(),
  coarse: z.array(z.string()).min(1),
  anatomyJson: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  aliases: z.array(z.string()).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/physio-sites", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const rows = await listPhysioSites({
      q: url.searchParams.get("q") ?? undefined,
      activeOnly: url.searchParams.get("activeOnly") === "1",
    });
    return sendJson(httpRes, rows);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/physio-sites", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = createSchema.parse(httpReq.body);
    const row = await createPhysioSite(body);
    await recordClinicAudit(
      { userId: guard.session.sub, request: req },
      "PhysioSite",
      row.id,
      "CREATE",
      { code: row.code },
    );
    return sendJson(httpRes, row, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
