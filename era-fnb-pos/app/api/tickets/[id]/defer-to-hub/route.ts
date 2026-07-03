import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseTableForTicket } from "@/lib/ticket-helpers";
import {
  payBlockedReason,
  resolveTicketSettlement,
} from "@/lib/billing-router";
import { postHotelSettlementPending } from "@/lib/settlement-hub-client";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(_request);
  const denied = requireAnyRole(session, [FB_ROLES.WAITER, FB_ROLES.MANAGER]);
  if (denied) return denied;

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { table: true, outlet: true, lines: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!["OPEN", "HELD"].includes(ticket.status)) {
    return NextResponse.json({ error: "Ticket is not open" }, { status: 400 });
  }

  const settlement = await resolveTicketSettlement(ticket);
  if (settlement !== "HOTEL_HUB") {
    const reason = payBlockedReason(settlement) ?? "Not eligible for reception defer";
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  const amount = Number(ticket.totalAzn);
  if (amount <= 0) {
    return NextResponse.json({ error: "Ticket total must be positive" }, { status: 400 });
  }

  const lineSummary = ticket.lines
    .map((l) => `${l.qty}x ${l.description}`)
    .join("; ")
    .slice(0, 500);
  const payerLabel =
    ticket.walkInLabel?.trim() ||
    ticket.guestName?.trim() ||
    ticket.table?.code ||
    "Walk-in";

  const pending = await postHotelSettlementPending({
    sourceSystem: "FNB_POS",
    sourceRef: ticket.id,
    amount,
    description: `FB ${ticket.outlet.code}: ${lineSummary || ticket.id}`,
    payerLabel,
    idempotencyKey: `ticket-${ticket.id}`,
  });

  const pendingId = pending.id as string;
  await prisma.ticket.update({
    where: { id },
    data: {
      status: "PENDING_HUB",
      settlementPendingId: pendingId,
    },
  });
  await releaseTableForTicket(id, ticket.tableId);

  return NextResponse.json({ ok: true, pendingId, settlement: "HOTEL_HUB" });
}
