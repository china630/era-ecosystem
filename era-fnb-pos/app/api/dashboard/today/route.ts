import { bakuDayBounds, todayBakuYmd } from "@era/satellite-kit/time";
import { assertFnbEntitled, handleRouteError, jsonOk } from "@/lib/api-utils";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { TILL_READ_TICKETS } from "@/lib/auth/read-permission-sets";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

/** Café day board: Baku calendar day, closed-ticket revenue, open floor. */
export async function GET(request: Request) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessAnyPermission(session, TILL_READ_TICKETS);
    if (denied) return denied;

    const { start, end } = bakuDayBounds(todayBakuYmd());
    const [openedToday, openNow, occupiedTables, closed] = await Promise.all([
      prisma.ticket.count({
        where: { openedAt: { gte: start, lt: end }, status: { not: "VOID" } },
      }),
      prisma.ticket.count({ where: { status: { in: ["OPEN", "HELD"] } } }),
      prisma.posTable.count({ where: { status: "OCCUPIED" } }),
      prisma.ticket.findMany({
        where: {
          status: "CLOSED",
          closedAt: { gte: start, lt: end },
        },
        select: {
          totalAzn: true,
          lines: {
            where: { kitchenStatus: { not: "VOID" } },
            select: { description: true, qty: true },
          },
        },
      }),
    ]);

    let revenueAzn = 0;
    const qtyByName = new Map<string, number>();
    for (const ticket of closed) {
      revenueAzn += Number(ticket.totalAzn);
      for (const line of ticket.lines) {
        const name = line.description.trim() || "—";
        qtyByName.set(name, (qtyByName.get(name) ?? 0) + line.qty);
      }
    }

    const topDishes = [...qtyByName.entries()]
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return jsonOk({
      date: todayBakuYmd(),
      openedToday,
      openNow,
      occupiedTables,
      revenueAzn,
      topDishes,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
