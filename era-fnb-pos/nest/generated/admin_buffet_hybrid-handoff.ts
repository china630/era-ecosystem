import { z } from "zod";
import { jsonError } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { buildHybridHandoffPack } from "@/lib/buffet-hybrid-handoff.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * F&B → Finance HYBRID handoff pack (Phase A).
 * POS sale/COMP + staff net + Forecast theoretical → financeHandoffQuery.
 */
const querySchema = z.object({
  outletId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffGrossAzn: z.coerce.number().min(0).optional(),
});

function mapHandoffError(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "OUTLET_NOT_FOUND") return jsonError("Outlet not found", 404);
    if (code === "INVALID_DATE_RANGE" || code === "DATE_ORDER" || code === "BAD_DATE") {
      return jsonError("from must be on or before to (YYYY-MM-DD)", 400);
    }
  }
  return null;
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/buffet/hybrid-handoff", async (httpReq, httpRes) => {
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

  try {
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      outletId: url.searchParams.get("outletId"),
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      staffGrossAzn: url.searchParams.get("staffGrossAzn") ?? undefined,
    });
    if (parsed.from > parsed.to) {
      return sendJson(httpRes, { error: "from must be on or before to (YYYY-MM-DD)" }, 400);
    }
    const staffOverride = url.searchParams.has("staffGrossAzn");
    const pack = await buildHybridHandoffPack({
      outletId: parsed.outletId,
      fromYmd: parsed.from,
      toYmd: parsed.to,
      staffGrossAzn: parsed.staffGrossAzn,
      staffGrossOverride: staffOverride,
      financeWebUrl: await (async () => {
        const {
          getFnbIntegrationSettings,
          normalizePublicOrigin,
        } = await import("@/lib/fnb-integration-settings");
        const s = await getFnbIntegrationSettings();
        return normalizePublicOrigin(s.financeWebUrl);
      })(),
    });
    return sendJson(httpRes, pack);
  } catch (err) {
    return mapHandoffError(err) ?? handleRouteError(err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
