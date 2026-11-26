/** Lifted from era-hotel-pms/nest/generated/admin_reports_email-cron.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { trySendPlatformNotification, runCronForEachTenant } from "@era/satellite-kit";
import { todayBakuYmd } from "@era/satellite-kit/time";
import { fetchHotelPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

/**
 * v1.1 — scheduled email reports hook (WA0345+).
 * Invoke via external cron: POST /api/admin/reports/email-cron?secret=...
 *
 * Locale: no UI session. Uses HOTEL_REPORT_EMAIL_LOCALE (az|ru|en), else az.
 * Body is a ZIP download link, not an Frx/PDF attachment.
 */
/** SEC-HOT-02: no default cron secret in production */


@Controller()
export class AdminReportsEmailCronController {
  @Post("api/admin/reports/email-cron")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  const configured = process.env.HOTEL_EMAIL_CRON_SECRET?.trim();
  const secret =
    configured ||
    (process.env.NODE_ENV === "production" ? "" : "hotel-email-cron-dev");
  const url = requestUrl;
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
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
