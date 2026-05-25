import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recalculateTicketTotals } from "@/lib/ticket-helpers";
import { FB_ROLES, getSessionFromRequest, requireAnyRole } from "@/lib/session";

const splitSchema = z.object({
  lineIds: z.array(z.string()).min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request);
  const denied = requireAnyRole(session, [FB_ROLES.WAITER, FB_ROLES.MANAGER]);
  if (denied) return denied;

  const { id } = await params;
  const body = splitSchema.parse(await request.json());

  const source = await prisma.ticket.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!source) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }
  if (!["OPEN", "HELD"].includes(source.status)) {
    return NextResponse.json({ error: "Ticket is not open" }, { status: 400 });
  }

  const lineSet = new Set(body.lineIds);
  const toMove = source.lines.filter((l) => lineSet.has(l.id));
  if (toMove.length === 0) {
    return NextResponse.json({ error: "No matching lines" }, { status: 400 });
  }
  if (toMove.length === source.lines.filter((l) => l.kitchenStatus !== "VOID").length) {
    return NextResponse.json(
      { error: "Leave at least one active line on the original ticket" },
      { status: 400 },
    );
  }

  const splitTicket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        outletId: source.outletId,
        tableId: null,
        covers: source.covers,
        guestName: source.guestName,
        discountPercent: 0,
        subtotalAzn: 0,
        totalAzn: 0,
      },
    });
    await tx.ticketLine.updateMany({
      where: { id: { in: toMove.map((l) => l.id) } },
      data: { ticketId: created.id },
    });
    return created;
  });

  await recalculateTicketTotals(id);
  const updatedSplit = await recalculateTicketTotals(splitTicket.id);
  const updatedSource = await prisma.ticket.findUnique({
    where: { id },
    include: { lines: true, table: true, outlet: true },
  });

  return NextResponse.json(
    { source: updatedSource, split: updatedSplit },
    { status: 201 },
  );
}
