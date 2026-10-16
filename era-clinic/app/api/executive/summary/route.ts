import {
  getSatelliteSession,
  hasBusinessOwnerRole,
  jsonOk,
  jsonError,
  handleRouteError,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getCapacitySummary } from "@/lib/capacity.service";
import { executiveDayBlocks } from "@/domain/ops/executive-day.service";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

function resolveDayBounds(dateParam?: string) {
  const ymd = dateParam?.trim() || todayBakuYmd();
  const { start, end } = bakuDayBounds(ymd);
  return { ymd, start, end };
}

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
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

    const [visitsToday, openLabOrders, blocks, capacity] = await Promise.all([
      prisma.visit.count({ where: visitWhere }),
      prisma.labOrder.count({
        where: { status: { not: "COMPLETED" } },
      }),
      executiveDayBlocks({
        from: today,
        to: tomorrow,
      }),
      getCapacitySummary(today),
    ]);

    return jsonOk({
      date: ymd,
      practitionerId: practitionerId ?? null,
      visitsToday,
      blocks,
      openLabOrders,
      currency: "AZN",
      capacity,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
