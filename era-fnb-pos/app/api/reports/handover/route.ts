import { z } from "zod";
import { bakuDayBounds, todayBakuYmd } from "@era/satellite-kit/time";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { getSatelliteSession } from "@/lib/session";

const querySchema = z.object({
  outletId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Room list and cash act for one outlet day. Only checks already closed. Signatures stay on paper. */
export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_SALES);
    if (denied) return denied;
    const url = new URL(request.url);
    const q = querySchema.parse({
      outletId: url.searchParams.get("outletId") ?? undefined,
      date: url.searchParams.get("date") ?? undefined,
    });
    const outletId = q.outletId ?? (await getSelectedOutletId());
    if (!outletId) return jsonError("Select an outlet", 400);
    const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet) return jsonError("Outlet not found", 404);
    const ymd = q.date ?? todayBakuYmd();
    const { start, end } = bakuDayBounds(ymd);
    const closed = await prisma.ticket.findMany({
      where: { outletId, status: "CLOSED", closedAt: { gte: start, lt: end } },
      orderBy: { closedAt: "asc" },
    });
    const rooms = closed
      .filter((t) => t.tenderRoute === "ROOM" || t.roomChargeReservationId || t.roomNumberLabel)
      .map((t) => ({
        ticketId: t.id,
        room: t.roomNumberLabel || t.roomChargeReservationId,
        guest: t.guestName,
        amount: Number(t.totalAzn),
      }));
    const sum = (route: string) =>
      Math.round(
        closed
          .filter((t) => (t.tenderRoute || t.paymentMethod || "").toUpperCase() === route)
          .reduce((s, t) => s + Number(t.totalAzn), 0) * 100,
      ) / 100;
    return jsonOk({
      outlet: { id: outlet.id, code: outlet.code, name: outlet.name },
      businessDay: ymd,
      roomHandover: rooms,
      roomTotal: Math.round(rooms.reduce((s, r) => s + r.amount, 0) * 100) / 100,
      cashAct: {
        cash: sum("CASH"),
        ikram: sum("IKRAM"),
        limit: sum("LIMIT"),
        card: sum("CARD"),
      },
      signatures: "paper",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
