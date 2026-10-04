import { handleRouteError } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseTableForTicket } from "@/lib/ticket-helpers";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordFbAudit } from "@/lib/satellite-audit";

/** Cancel an unpaid check. Cashier (pay) or manager (void). Does not refund a closed check. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSatelliteSession();
    const denied = denyUnlessAnyPermission(session, [
      PERMISSIONS.TICKETS_PAY,
      PERMISSIONS.TICKETS_VOID,
    ]);
    if (denied) return denied;

    const { id } = await params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    if (!["OPEN", "HELD"].includes(ticket.status)) {
      return NextResponse.json({ error: "Ticket is not open" }, { status: 400 });
    }

    await prisma.ticketLine.updateMany({
      where: { ticketId: id, kitchenStatus: { not: "VOID" } },
      data: { kitchenStatus: "VOID", notes: "till correction" },
    });
    await prisma.ticket.update({
      where: { id },
      data: { status: "VOID", subtotalAzn: 0, totalAzn: 0, closedAt: new Date() },
    });
    await releaseTableForTicket(id, ticket.tableId);
    await recordFbAudit(
      { userId: session?.sub, request },
      "Ticket",
      id,
      "VOID",
      { reason: "till correction" },
    );

    return NextResponse.json({ id, status: "VOID", released: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
