import {
  getRouteSession,
  hasBusinessOwnerRole,
  jsonOk,
  jsonError,
  handleRouteError,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  try {
    const session = await getRouteSession();
    if (!session) return jsonError("Unauthorized", 401);
    if (!hasBusinessOwnerRole(session)) {
      return jsonError("BUSINESS_OWNER required", 403);
    }

    const today = startOfToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [visitsToday, labCompletedToday, openLabOrders] = await Promise.all([
      prisma.visit.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
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

    return jsonOk({
      date: today.toISOString().slice(0, 10),
      visitsToday,
      labRevenueToday,
      openLabOrders,
      currency: "AZN",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
