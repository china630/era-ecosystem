import { NextResponse } from "next/server";
import { trySendPlatformNotification, runCronForEachTenant } from "@era/satellite-kit";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { fetchHotelPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * v1.1 — scheduled email reports hook (WA0345+).
 * Invoke via external cron: POST /api/admin/reports/email-cron?secret=...
 *
 * Locale: no UI session. Uses HOTEL_REPORT_EMAIL_LOCALE (az|ru|en), else az.
 * Body is a ZIP download link, not an Frx/PDF attachment.
 */
/** SEC-HOT-02: no default cron secret in production */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/admin/reports/email-cron", async (httpReq, httpRes) => {
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

  const configured = process.env.HOTEL_EMAIL_CRON_SECRET?.trim();
  const secret =
    configured ||
    (process.env.NODE_ENV === "production" ? "" : "hotel-email-cron-dev");
  const url = new URL(req.url);
  if (!secret || url.searchParams.get("secret") !== secret) {
    return sendJson(httpRes, { error: "Unauthorized" }, 401);
  }

  const gate = await runCronForEachTenant(
    {
      satelliteKey: "industry_hotel_pms",
      moduleKey: "hotel_core",
      fetchPoolOrganizationIds: fetchHotelPoolOrganizationIds,
    },
    async (organizationId) => {
      const to = process.env.HOTEL_REPORT_EMAIL_TO ?? "manager@demo.local";
      const rawLocale = (process.env.HOTEL_REPORT_EMAIL_LOCALE ?? "az").trim();
      const locale = rawLocale === "ru" || rawLocale === "en" || rawLocale === "az" ? rawLocale : "az";
      const businessDate = todayBakuYmd();
      const origin = (
        process.env.ERA_HOTEL_PMS_ORIGIN ||
        process.env.HOTEL_PUBLIC_URL ||
        "http://127.0.0.1:3201"
      ).replace(/\/$/, "");
      const zipUrl = `${origin}/api/reports/pack/download?businessDate=${businessDate}&lang=${locale}`;

      await trySendPlatformNotification({
        templateKey: "hotel_daily_ops",
        channel: "EMAIL",
        messageClass: "TRANSACTIONAL",
        recipient: to,
        sourceEntityType: "hotel_daily_report",
        sourceEntityId: businessDate,
        subject: "ERA Hotel — nightly report pack",
        body: `Nightly report pack ZIP (locale=${locale}): ${zipUrl}`,
      });
      return { organizationId, queued: true, recipient: to, zipUrl, locale };
    },
  );
  if (!gate.ok) {
    if (gate.status === 503) {
      return sendJson(httpRes, { error: gate.reason }, 503);
    }
    return sendJson(httpRes, {
      ok: true,
      skipped: true,
      reason: gate.reason,
      moduleKey: gate.moduleKey,
    });
  }

  return sendJson(httpRes, {
    ok: true,
    sentAt: new Date().toISOString(),
    byOrganization: gate.results,
  });

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
