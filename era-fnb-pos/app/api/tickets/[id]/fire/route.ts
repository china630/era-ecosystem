import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.WAITER, FB_ROLES.MANAGER]);
  if (denied) return denied;

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!["OPEN", "HELD"].includes(ticket.status)) {
    return NextResponse.json(
      { error: "Ticket is not open for fire" },
      { status: 400 },
    );
  }

  const result = await prisma.ticketLine.updateMany({
    where: { ticketId: id, kitchenStatus: "NEW" },
    data: { kitchenStatus: "FIRED" },
  });

  const updated = await prisma.ticket.findUnique({
    where: { id },
    include: { lines: true, table: true, outlet: true },
  });

  return NextResponse.json({
    ticket: updated,
    firedCount: result.count,
  });
}
