import { runCronForEachTenant } from "@era/satellite-kit";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { listCronOrganizationIdsFromDb, fetchAutoPoolOrganizationIds } from "@/lib/cron-organization-ids";
import { prisma } from "@/lib/prisma";
import { sendNotification, createBookingSlots } from "@/integration/control-plane-platform.client";
import { platformNotificationsEnabled } from "@/lib/platform-notify";
import { nextServiceAppointmentDay } from "@/lib/production-calendar";

/**
 * Scan aged OPEN work orders → notify + booking slots.
 * SHARED: ERA_CRON_ORGANIZATION_IDS override or DB User DISTINCT (DEDICATED = process bind).
 */
export async function POST(req: Request) {
  try {
    const gate = await runCronForEachTenant(
      {
        satelliteKey: "industry_auto_service",
        authorization: req.headers.get("authorization"),
        cronSecretEnv: "PLATFORM_CRON_SECRET",
        listOrganizationIds: listCronOrganizationIdsFromDb,
        fetchPoolOrganizationIds: fetchAutoPoolOrganizationIds,
      },
      async (organizationId) => {
        const dueBefore = new Date(Date.now() - 180 * 24 * 3600_000);

        const workOrders = await prisma.workOrder.findMany({
          where: {
            status: "OPEN",
            createdAt: { lte: dueBefore },
          },
          take: 50,
        });

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

          const tomorrowIso = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
          const workingIso = await nextServiceAppointmentDay(tomorrowIso);
          const slotStart = new Date(`${workingIso}T10:00:00.000Z`);
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
        return Response.json({ error: "satellite_unbound" }, { status: 503 });
      }
      return jsonOk({ skipped: true, reason: gate.reason, moduleKey: gate.moduleKey });
    }

    return jsonOk({ byOrganization: gate.results });
  } catch (err) {
    return handleRouteError(err);
  }
}
