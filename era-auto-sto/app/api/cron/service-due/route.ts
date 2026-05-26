import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { sendNotification, createBookingSlots } from "@/integration/control-plane-platform.client";
import { platformNotificationsEnabled } from "@/lib/platform-notify";

const CRON_SECRET = process.env.PLATFORM_CRON_SECRET ?? "";

export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const organizationId = process.env.ERA_SATELLITE_ORGANIZATION_ID ?? "";
    const dueBefore = new Date(Date.now() - 180 * 24 * 3600_000);

    const workOrders = await prisma.workOrder.findMany({
      where: {
        status: "OPEN",
        createdAt: { lte: dueBefore },
      },
      take: 50,
    });

    if (!platformNotificationsEnabled()) {
      return jsonOk({ scanned: workOrders.length, sent: 0, skipped: "platform_env_unset" });
    }

    let sent = 0;
    for (const wo of workOrders) {
      if (!wo.vehiclePlate || !organizationId) continue;

      const slotStart = new Date(Date.now() + 24 * 3600_000);
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

    return jsonOk({ scanned: workOrders.length, sent });
  } catch (err) {
    return handleRouteError(err);
  }
}
