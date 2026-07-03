import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { releaseTableForTicket } from "@/lib/ticket-helpers";

const bodySchema = z.object({
  pendingId: z.string().min(1),
  sourceRef: z.string().min(1),
  paymentMethod: z.string().optional(),
  fiscalReceiptId: z.string().nullable().optional(),
});

function verifyBridge(request: Request): boolean {
  const secret = process.env.POS_BRIDGE_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-pos-bridge-secret");
  const auth = request.headers.get("authorization");
  if (header === secret) return true;
  if (auth?.startsWith("Bearer ") && auth.slice(7) === secret) return true;
  return false;
}

export async function POST(request: Request) {
  if (!verifyBridge(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = bodySchema.parse(await request.json());
  const ticket = await prisma.ticket.findUnique({
    where: { id: body.sourceRef },
    include: { table: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (ticket.status === "CLOSED") {
    return NextResponse.json({ ok: true, alreadyClosed: true });
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      settlementPendingId: body.pendingId,
      hubFiscalReceiptId: body.fiscalReceiptId ?? null,
    },
  });
  await releaseTableForTicket(ticket.id, ticket.tableId);

  return NextResponse.json({ ok: true, ticketId: ticket.id, status: "CLOSED" });
}
