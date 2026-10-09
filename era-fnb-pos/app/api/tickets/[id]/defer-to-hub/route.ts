import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseTableForTicket } from "@/lib/ticket-helpers";
import {
  payBlockedReason,
  resolveTicketSettlement,
} from "@/lib/billing-router";
import { postHotelSettlementPending } from "@/lib/settlement-hub-client";
import { getSatelliteSession } from "@/lib/session";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { assertHotelFnbFeature } from "@/lib/fnb-module-gate";
import { handleRouteError } from "@/lib/api-utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertHotelFnbFeature("defer-to-hub");
    const session = await getSatelliteSession();
    const denied = denyUnlessPermission(session, PERMISSIONS.DEFER_HUB);
    if (denied) return denied;

    const { id } = await params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { table: true, outlet: true, lines: { include: { menuItem: true } } },
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

    if (ticket.lines.length === 0) {
      return NextResponse.json({ error: "Finance SKU is required" }, { status: 400 });
    }
    for (const line of ticket.lines) {
      if (!line.menuItem?.financeSku?.trim()) {
        return NextResponse.json(
          { error: `Finance SKU is required for ${line.description}` },
          { status: 400 },
        );
      }
    }

    const payerLabel =
      ticket.walkInLabel?.trim() ||
      ticket.guestName?.trim() ||
      ticket.table?.code ||
      "Walk-in";

    const pendingIds: string[] = [];
    for (const line of ticket.lines) {
      const pending = await postHotelSettlementPending({
        sourceSystem: "FNB_POS",
        sourceRef: ticket.id,
        amount: Number(line.qty) * Number(line.unitPriceAzn),
        description: `${line.qty}x ${line.description}`,
        payerLabel,
        idempotencyKey: `ticket-${ticket.id}-${line.id}`,
        sku: line.menuItem?.financeSku?.trim(),
        qty: line.qty,
        revenueCode: "FOOD",
      });
      const pendingId = pending.id as string;
      if (pendingId) pendingIds.push(pendingId);
    }
    const pendingId = pendingIds[0] ?? "";
    await prisma.ticket.update({
      where: { id },
      data: {
        status: "PENDING_HUB",
        settlementPendingId: JSON.stringify(pendingIds),
      },
    });
    await releaseTableForTicket(id, ticket.tableId);

    return NextResponse.json({ ok: true, pendingId, settlement: "HOTEL_HUB" });
  } catch (err) {
    return handleRouteError(err);
  }
}
