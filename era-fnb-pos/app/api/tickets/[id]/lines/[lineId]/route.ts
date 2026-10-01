import { assertFnbEntitled, handleRouteError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  attachDayNos,
  recalculateTicketTotals,
  voidTicketIfNoLiveLines,
} from "@/lib/ticket-helpers";
import { getSessionFromRequest } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordFbAudit } from "@/lib/satellite-audit";
import { assertMenuItemNotSoldOut } from "@/lib/fnb-sold-out";

const qtySchema = z.object({
  qty: z.number().int().min(0),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> },
) {
  try {
    await assertFnbEntitled();
    const session = await getSessionFromRequest(request);
    const denied = denyUnlessPermission(session, PERMISSIONS.TICKETS_LINES);
    if (denied) return denied;

    const { id, lineId } = await params;
    const body = qtySchema.parse(await request.json());

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (!["OPEN", "HELD"].includes(ticket.status)) {
      return NextResponse.json({ error: "Ticket is not open" }, { status: 400 });
    }

    const line = await prisma.ticketLine.findFirst({
      where: { id: lineId, ticketId: id },
    });
    if (!line || line.kitchenStatus === "VOID") {
      return NextResponse.json({ error: "Line not found" }, { status: 404 });
    }

    if (body.qty > line.qty && line.menuItemId) {
      await assertMenuItemNotSoldOut({
        outletId: ticket.outletId,
        menuItemId: line.menuItemId,
      });
    }

    if (body.qty === 0) {
      await prisma.ticketLine.update({
        where: { id: lineId },
        data: { kitchenStatus: "VOID", notes: "till correction" },
      });
      await recordFbAudit(
        { userId: session?.sub, request },
        "TicketLine",
        lineId,
        "VOID",
        { ticketId: id, reason: "till correction", lineName: line.description },
      );
    } else {
      await prisma.ticketLine.update({
        where: { id: lineId },
        data: { qty: body.qty },
      });
    }

    const updated = await recalculateTicketTotals(id);
    const released = await voidTicketIfNoLiveLines(id);
    const fresh = await prisma.ticket.findUnique({
      where: { id },
      include: { lines: true, table: true },
    });
    const [withDay] = await attachDayNos([fresh ?? { ...updated, organizationId: ticket.organizationId }]);
    return NextResponse.json({ ...(withDay ?? fresh ?? updated), released });
  } catch (err) {
    return handleRouteError(err);
  }
}
