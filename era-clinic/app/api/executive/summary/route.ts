import {
  getRouteSession,
  hasBusinessOwnerRole,
  jsonOk,
  jsonError,
  handleRouteError,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getCapacitySummary } from "@/lib/capacity.service";

function startOfDay(input?: string): Date {
  const d = input ? new Date(`${input}T00:00:00`) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    if (!hasBusinessOwnerRole(session)) {
      return jsonError("BUSINESS_OWNER required", 403);
    }

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") ?? undefined;
    const practitionerId = url.searchParams.get("practitionerId") ?? undefined;

    const today = startOfDay(dateParam);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const visitWhere = {
      createdAt: { gte: today, lt: tomorrow },
      ...(practitionerId ? { practitionerId } : {}),
    };

    const [visitsToday, labCompletedToday, openLabOrders] = await Promise.all([
      prisma.visit.count({ where: visitWhere }),
      prisma.labOrder.findMany({
        where: {
          status: "COMPLETED",
          completedAt: { gte: today, lt: tomorrow },
        },
        select: { amountNet: true },
      }),
      prisma.labOrder.count({
        where: { status: { not: "COMPLETED" } },
      }),
    ]);

    const labRevenueToday = labCompletedToday.reduce(
      (sum, o) => sum + Number(o.amountNet),
      0,
    );

    const capacity = await getCapacitySummary(today);

    return jsonOk({
      date: today.toISOString().slice(0, 10),
      practitionerId: practitionerId ?? null,
      visitsToday,
      labRevenueToday,
      openLabOrders,
      currency: "AZN",
      capacity,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
