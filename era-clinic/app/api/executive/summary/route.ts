import {
  getRouteSession,
  hasBusinessOwnerRole,
  jsonOk,
  jsonError,
  handleRouteError,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getCapacitySummary } from "@/lib/capacity.service";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

function resolveDayBounds(dateParam?: string) {
  const ymd = dateParam?.trim() || todayBakuYmd();
  const { start, end } = bakuDayBounds(ymd);
  return { ymd, start, end };
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

    const { ymd, start: today, end: tomorrow } = resolveDayBounds(dateParam);

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
      date: ymd,
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
