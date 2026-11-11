import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireFnbSubmodule } from "@/lib/fnb-module-gate";
import { getBuffetForecastPackReport } from "@/lib/buffet-forecast-pack.service";
import { patchBuffetCostSettings } from "@/lib/buffet-cost-settings.service";
import { parseBuffetForecastPack } from "@/lib/buffet-forecast-pack";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z
  .object({
    forecastPack: z
      .object({
        keySkuNorms: z
          .array(
            z.object({
              sku: z.string().min(1),
              name: z.string().min(1),
              unit: z.string().min(1),
              qtyPerGuestNight: z.number().min(0),
              aznPerGuestNight: z.number().min(0),
            }),
          )
          .min(1)
          .optional(),
        bands: z
          .array(
            z.object({
              code: z.string().min(1),
              minGuestNights: z.number().int().min(0),
              maxGuestNights: z.number().int().min(0).nullable(),
            }),
          )
          .min(1)
          .optional(),
      })
      .refine((v) => v.keySkuNorms != null || v.bands != null, {
        message: "forecastPack requires keySkuNorms and/or bands",
      }),
  })
  .strict();



/** Save key-SKU norms / bands into org buffet cost settings. */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/buffet/forecast-pack", async (httpReq, httpRes) => {
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
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const overrideRaw = url.searchParams.get("guestNights");
    if (!from || !to) return sendJson(httpRes, { error: "from and to are required" }, 400);
    let guestNightsOverride: number | undefined;
    if (overrideRaw != null && overrideRaw !== "") {
      const n = Number(overrideRaw);
      if (!Number.isFinite(n) || n < 0) {
        return sendJson(httpRes, { error: "guestNights must be a non-negative number" }, 400);
      }
      guestNightsOverride = Math.floor(n);
    }
    const report = await getBuffetForecastPackReport({
      fromYmd: from,
      toYmd: to,
      guestNightsOverride,
    });
    return sendJson(httpRes, report);
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      ((err as { code?: string }).code === "BAD_DATE" ||
        (err as { code?: string }).code === "DATE_ORDER")
    ) {
      const msg = (err as unknown as { message?: unknown }).message;
      return sendJson(httpRes, { error: typeof msg === "string" ? msg : "Invalid date range" }, 400);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/buffet/forecast-pack", async (httpReq, httpRes) => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.ADMIN_BUFFET);
    if (denied) return denied;
    await requireFnbSubmodule("fnb_buffet_planner", session?.organizationId);
    const body = patchSchema.parse(httpReq.body);
    const forecastPack = parseBuffetForecastPack(body.forecastPack);
    const settings = await patchBuffetCostSettings({ forecastPack });
    return sendJson(httpRes, { forecastPack: settings.forecastPack });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
