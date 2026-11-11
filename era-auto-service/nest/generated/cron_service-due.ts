import { runCronForEachTenant } from "@era/satellite-kit";
import { addBakuDays, parseBakuDateTime, todayBakuYmd } from "@era/satellite-kit/time";
import { fetchAutoPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { sendNotification, createBookingSlots } from "@/integration/control-plane-platform.client";
import { platformNotificationsEnabled } from "@/lib/platform-notify";
import { nextServiceAppointmentDay } from "@/lib/production-calendar";
import { findAgedOpenWorkOrders } from "@/lib/work-order.service";
import { enterAutoStaff, autoNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithAutoTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Scan aged OPEN work orders → notify + booking slots.
 * SHARED: orch pool registry (kit). DEDICATED / ONPREM: process org.
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/cron/service-due", async (httpReq, httpRes) => {
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

  
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_auto_service",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
        fetchPoolOrganizationIds: fetchAutoPoolOrganizationIds,
      },
      async (organizationId) => {
        const dueBefore = new Date(Date.now() - 180 * 24 * 3600_000);

        const workOrders = await findAgedOpenWorkOrders(dueBefore);

        if (!platformNotificationsEnabled()) {
          return {
            organizationId,
            scanned: workOrders.length,
            sent: 0,
            skipped: "platform_env_unset" as const,
          };
        }

        let sent = 0;
        for (const wo of workOrders) {
          if (!wo.vehiclePlate) continue;

          const tomorrowIso = addBakuDays(todayBakuYmd(), 1);
          const workingIso = await nextServiceAppointmentDay(tomorrowIso);
          const slotStart = parseBakuDateTime(workingIso, "10:00:00");
          const slotEnd = new Date(slotStart.getTime() + 60 * 60_000);
          const slot = await createBookingSlots(
            {
              resourceKey: "service-bay",
              resourceName: "Service bay",
              startsAt: slotStart.toISOString(),
              endsAt: slotEnd.toISOString(),
              capacity: 4,
            },
            { organizationId },
          ).catch(() => null);

          const bookingLink =
            slot && typeof slot === "object" && "slot" in slot
              ? `${process.env.CONTROL_PLANE_URL ?? "http://127.0.0.1:4100"}/platform/booking/v1/appointments`
              : "https://booking.example/auto";

          await sendNotification(
            {
              templateKey: "auto.service.due",
              channel: "WHATSAPP",
              messageClass: "LIFECYCLE",
              recipient: wo.vehiclePlate,
              sourceEntityType: "work_order",
              sourceEntityId: wo.id,
              body: `ТО для ${wo.vehiclePlate}. Запись: ${bookingLink}`,
              payload: {
                vehiclePlate: wo.vehiclePlate,
                bookingLink,
                workOrderCode: wo.code,
              },
            },
            { organizationId },
          );
          sent++;
        }

        return { organizationId, scanned: workOrders.length, sent };
      },
    );

    if (!gate.ok) {
      if (gate.status === 401) return new Response("Unauthorized", { status: 401 });
      if (gate.status === 503) {
        return sendJson(httpRes, { error: gate.reason }, 503);
      }
      return sendJson(httpRes, { skipped: true, reason: gate.reason, moduleKey: gate.moduleKey });
    }

    return sendJson(httpRes, { byOrganization: gate.results });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
