import { NextResponse } from "next/server";
import { trySendPlatformNotification, runCronForEachTenant } from "@era/satellite-kit";
import { listCronOrganizationIdsFromDb, fetchHotelPoolOrganizationIds } from "@/lib/cron-organization-ids";

/**
 * v1.1 — scheduled email reports hook (WA0345+).
 * Invoke via external cron: POST /api/admin/reports/email-cron?secret=...
 *
 * Locale: no UI session. Uses HOTEL_REPORT_EMAIL_LOCALE (az|ru|en), else az.
 * Body is a ZIP download link, not an Frx/PDF attachment.
 */
/** SEC-HOT-02: no default cron secret in production */
export async function POST(req: Request) {
  const configured = process.env.HOTEL_EMAIL_CRON_SECRET?.trim();
  const secret =
    configured ||
    (process.env.NODE_ENV === "production" ? "" : "hotel-email-cron-dev");
  const url = new URL(req.url);
  if (!secret || url.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gate = await runCronForEachTenant(
    {
      satelliteKey: "industry_hotel_pms",
      moduleKey: "hotel_core",
      listOrganizationIds: listCronOrganizationIdsFromDb,
        fetchPoolOrganizationIds: fetchHotelPoolOrganizationIds,
    },
    async (organizationId) => {
      const to = process.env.HOTEL_REPORT_EMAIL_TO ?? "manager@demo.local";
      const rawLocale = (process.env.HOTEL_REPORT_EMAIL_LOCALE ?? "az").trim();
      const locale = rawLocale === "ru" || rawLocale === "en" || rawLocale === "az" ? rawLocale : "az";
      const businessDate = new Date().toISOString().slice(0, 10);
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
      return NextResponse.json({ error: "satellite_unbound" }, { status: 503 });
    }
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: gate.reason,
      moduleKey: gate.moduleKey,
    });
  }

  return NextResponse.json({
    ok: true,
    sentAt: new Date().toISOString(),
    byOrganization: gate.results,
  });
}
