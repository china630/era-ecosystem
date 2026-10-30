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

function resolveRangeBounds(input: { date?: string; from?: string; to?: string }) {
  const fromYmd = (input.from ?? input.date)?.trim() || todayBakuYmd();
  const toYmd = (input.to ?? input.date)?.trim() || fromYmd;
  const lo = fromYmd <= toYmd ? fromYmd : toYmd;
  const hi = fromYmd <= toYmd ? toYmd : fromYmd;
  const { start } = bakuDayBounds(lo);
  const { end } = bakuDayBounds(hi);
  return { ymd: hi, start, end };
}

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError("Unauthorized", 401);
    if (!hasBusinessOwnerRole(session)) {
      return jsonError("BUSINESS_OWNER required", 403);
    }

    const url = new URL(req.url);
    const { ymd, start, end } = resolveRangeBounds({
      date: url.searchParams.get("date") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    const visitWhere = {
      createdAt: { gte: start, lt: end },
    };

    const [visitsToday, openLabOrders, blocks, capacity] = await Promise.all([
      prisma.visit.count({ where: visitWhere }),
      prisma.labOrder.count({
        where: { status: { not: "COMPLETED" } },
      }),
      executiveDayBlocks({
        from: start,
        to: end,
      }),
      getCapacitySummary(start),
    ]);

    return jsonOk({
      date: ymd,
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
